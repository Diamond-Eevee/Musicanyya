// pnpm library:convert-ly <source-id> <item-id> [--replace] (contract fidelity-tools.md §1, §3.3-3.4): converts an
// approved source's LilyPond file into a library item's MusicXML. Before anything is written, two checks must pass:
//   1. the source's own MIDI agrees with our reading of the .ly (two independent readings of the same source);
//   2. the MusicXML written reads back as exactly that reading, on every aspect.
// Titles, composer and credit come from the item's sidecar and the source manifest, never from the .ly header.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildScore } from '../../../src/core/musicxml/build';
import { readXml } from '../../../src/core/musicxml/read';
import { type Aspect, compare, compareSound, describeDifference } from '../fidelity/compare';
import { fromMusicXml } from '../fidelity/from-musicxml';
import { fromMidi, readMidi } from '../fidelity/midi';
import { loadSources, type SourceManifest, sourceFile } from '../fidelity/sources';
import { fromLilyPond, readLilyPond } from './read';
import { toMusicXml } from './to-musicxml';

export interface CliIo {
  /** The repository root. */
  root: string;
  out: (line: string) => void;
}

const USAGE = 'usage: pnpm library:convert-ly <source-id> <item-id> [--replace]';
const ALL: Aspect[] = [
  'barCount',
  'barLengths',
  'repeats',
  'playedOrder',
  'pitch',
  'onset',
  'duration',
  'spelling',
  'graceNotes',
];

interface Sidecar {
  title?: string;
  composer?: string;
  provenance?: { origin?: string };
}

export function main(args: string[], io: CliIo): number {
  const replace = args.includes('--replace');
  const names = args.filter((a) => a !== '--replace');
  if (names.length !== 2 || names.some((a) => a.startsWith('--'))) {
    io.out(USAGE);
    return 2;
  }
  const [sourceId, itemId] = names as [string, string];
  try {
    return convert(sourceId, itemId, replace, io);
  } catch (e) {
    io.out(`error: ${(e as Error).message}`);
    return 1;
  }
}

function convert(sourceId: string, itemId: string, replace: boolean, io: CliIo): number {
  // loadSources refuses any manifest without the owner's approval, with a non-PD/CC0 licence, or with a changed file.
  const sourcesRoot = join(io.root, 'content/library/sources');
  const manifest = loadSources(sourcesRoot).get(sourceId);
  if (!manifest) {
    io.out(`no source "${sourceId}" under content/library/sources`);
    return 1;
  }
  const itemFile = join(io.root, 'public/library', `${itemId}.musicxml`);
  const sidecarFile = join(io.root, 'public/library', `${itemId}.json`);
  if (!existsSync(sidecarFile)) {
    io.out(`no library item "${itemId}" (public/library/${itemId}.json does not exist)`);
    return 1;
  }
  const sidecar = JSON.parse(readFileSync(sidecarFile, 'utf8')) as Sidecar;
  if (sidecar.provenance?.origin === 'authored' && !replace) {
    io.out(`${itemId} is authored (typed in by hand): pass --replace to overwrite it with the conversion`);
    return 1;
  }

  const notation = sourceFile(sourcesRoot, manifest, 'notation');
  if (notation?.file.format !== 'lilypond') {
    io.out(`source ${sourceId} has no LilyPond notation file`);
    return 1;
  }
  const { score: number } = notation.file;
  const score = readLilyPond(new TextDecoder().decode(notation.bytes), number !== undefined ? { score: number } : {});
  const reading = fromLilyPond(score);

  // Check 1: the source's MIDI, made by LilyPond from the same .ly, against our reading of the .ly.
  const sound = sourceFile(sourcesRoot, manifest, 'sound');
  if (!sound) {
    io.out(`source ${sourceId} has no sound file: the conversion cannot be cross-checked (contract §3.4)`);
    return 1;
  }
  const midi = readMidi(sound.bytes);
  const cross = compareSound(reading, fromMidi(midi, sound.file.midiNoteTracks ?? []), {
    order: sound.file.midiOrder ?? 'written',
    articulate: sound.file.midiArticulate ?? false,
  });
  const durations = cross.durations === 'notation only' ? ' (durations checked against the notation only)' : '';
  io.out(`notation vs sound: ${cross.differences.length} differences${durations}`);
  for (const d of cross.differences) io.out(`  ${describeDifference(d)}`);
  if (cross.differences.length > 0) {
    io.out('conversion refused: the MIDI does not agree with the reading of the .ly; nothing was written');
    return 1;
  }

  // Check 2: what we write reads back as the same music.
  // The source's own playback tempo, used only when the notation has no metronome mark (T096).
  const midiTempo = midi.tempos.filter((t) => t.tick === 0).at(-1)?.qpm;
  const { xml, dropped, playbackTempoUsed } = toMusicXml(score, {
    ...(sidecar.title !== undefined ? { title: sidecar.title } : {}),
    ...(sidecar.composer !== undefined ? { composer: sidecar.composer } : {}),
    rights: rights(manifest),
    source: manifest.url,
    ...(midiTempo !== undefined ? { playbackTempo: midiTempo } : {}),
  });
  const back = compare(fromMusicXml(xml), reading, ALL, { itemBars: 'all', sourceBars: 'all' });
  io.out(`conversion vs notation: ${back.length} differences`);
  for (const d of back) io.out(`  ${describeDifference(d)}`);
  if (back.length > 0) {
    io.out('conversion refused: the converter lost something (a converter bug); nothing was written');
    return 1;
  }

  writeFileSync(itemFile, xml);
  io.out(
    `wrote public/library/${itemId}.musicxml: ${reading.bars.length} bars, ${reading.notes.length} notes, ` +
      `${reading.graceNotes.length} grace notes`,
  );
  for (const d of dropped) io.out(`  dropped: ${d}`);
  if (playbackTempoUsed) {
    io.out(`  playback tempo ${midiTempo} from the source MIDI (no metronome mark in the notation; none printed)`);
    const later = midi.tempos.filter((t) => t.tick > 0 && t.qpm !== midiTempo);
    if (later.length > 0) io.out(`  the MIDI changes tempo ${later.length} times later; those changes are not written`);
  }
  const { score: loaded, report } = buildScore(readXml(xml).doc);
  const notices = [...new Set(report.entries.map((e) => e.code))].filter((c) => c !== 'defaultTempo');
  if (notices.length > 0) io.out(`  the app reports: ${notices.join(', ')}`);
  if (loaded.defaultTempoUsed) io.out('  no metronome mark in the notation: the app will use its default tempo');
  io.out('next: pnpm library:engrave, pnpm library:index, pnpm tsx tools/library/probe.ts, then update the sidecar');
  return 0;
}

/** The `<rights>` line: the licence and, when the manifest has one, the typesetter's credit. */
function rights(manifest: SourceManifest): string {
  const licence = manifest.licence === 'public-domain' ? 'Public domain' : 'CC0 1.0';
  const from = manifest.credit ?? `${manifest.work}, ${manifest.edition} (${manifest.publisher})`;
  return `${licence}. Converted from ${from}.`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2), { root: process.cwd(), out: (line) => console.log(line) });
}
