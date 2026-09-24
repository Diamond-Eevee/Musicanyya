// pnpm library:fidelity (contract fidelity-tools.md §1): validates every source and audit record and re-runs every
// check from the committed files. The report (docs/library-audit.md) and --check come with task T080.
//
//   pnpm library:fidelity                                   every record, one line each; exit 1 if any does not reproduce
//   pnpm library:fidelity --item <id>                       one record, every difference in full
//   pnpm library:fidelity --item <id> --file <path>         that record's checks against another MusicXML file
//   pnpm library:fidelity --inspect-midi <path> [--ly <p>] [--score <n>]  a MIDI file's tracks, to fill midiOrder/
//                                                           midiNoteTracks once (--score: which \score of the .ly)
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fromLilyPond, readLilyPond } from '../lilypond/read';
import { describeDifference } from './compare';
import { readMidi } from './midi';
import {
  type AuditRecord,
  type CheckResult,
  checkRecord,
  loadRecords,
  outcomeLabel,
  type RunContext,
  runRecord,
} from './records';
import { loadSources } from './sources';

export interface CliIo {
  /** The repository root. */
  root: string;
  out: (line: string) => void;
}

const USAGE =
  'usage: pnpm library:fidelity [--item <id> [--file <path>]] | --inspect-midi <path> [--ly <path>] [--score <n>]';
/** How many differences a one-line-per-item run shows before "... and N more". */
const SUMMARY_DIFFERENCES = 5;

export function main(args: string[], io: CliIo): number {
  const options = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i] as string;
    const value = args[i + 1];
    if (!['--item', '--file', '--inspect-midi', '--ly', '--score'].includes(key) || value === undefined) {
      io.out(USAGE);
      return 2;
    }
    options.set(key, value);
  }
  try {
    const midi = options.get('--inspect-midi');
    if (midi !== undefined) {
      const score = options.get('--score');
      return inspectMidi(
        resolve(io.root, midi),
        options.get('--ly'),
        score !== undefined ? Number(score) : undefined,
        io,
      );
    }
    if (options.has('--file') && !options.has('--item')) {
      io.out('--file needs --item <id>');
      return 2;
    }
    return runAudit(options.get('--item'), options.get('--file'), io);
  } catch (e) {
    io.out(`error: ${(e as Error).message}`);
    return 1;
  }
}

function runAudit(itemId: string | undefined, file: string | undefined, io: CliIo): number {
  const sourcesRoot = join(io.root, 'content/library/sources');
  const ctx: RunContext = {
    sources: loadSources(sourcesRoot),
    sourcesRoot,
    libraryRoot: join(io.root, 'public/library'),
    ...(file !== undefined ? { itemFile: resolve(io.root, file) } : {}),
  };
  const all = loadRecords(join(io.root, 'content/library/audit'));
  const records = itemId === undefined ? all : all.filter((r) => r.itemId === itemId);
  if (itemId !== undefined && records.length === 0) {
    io.out(`no audit record for ${itemId}`);
    return 1;
  }
  let failed = 0;
  for (const record of records) {
    const results = runRecord(record, ctx);
    // With --file the item is a scratch copy: only its differences matter, not the shelf's sidecar rules.
    const problems = file === undefined ? checkRecord(record, results, ctx) : [];
    const ok = results.every((r) => r.reproduced) && problems.length === 0;
    if (!ok) failed++;
    io.out(`${ok ? 'ok  ' : 'FAIL'} ${record.itemId}: ${outcomeLabel(record)}`);
    printResults(record, results, itemId !== undefined, io);
    for (const p of problems) io.out(`       rule: ${p}`);
  }
  io.out(`${records.length} records, ${failed} failed`);
  return failed === 0 ? 0 : 1;
}

function printResults(record: AuditRecord, results: CheckResult[], full: boolean, io: CliIo): void {
  results.forEach((result, i) => {
    const { check, differences } = result;
    const expected = check.method === 'visual' ? '' : ` (expected ${check.expectedDifferences})`;
    const source = check.method === 'theory' ? check.ruleSet : check.source;
    io.out(
      `       check ${i + 1} ${check.method} ${source}: ${differences.length} differences${expected}; ${result.detail}`,
    );
    const shown = full ? differences : differences.slice(0, SUMMARY_DIFFERENCES);
    for (const d of shown) io.out(`         ${describeDifference(d)}`);
    if (shown.length < differences.length)
      io.out(`         ... and ${differences.length - shown.length} more (--item ${record.itemId})`);
  });
}

function inspectMidi(path: string, lyOption: string | undefined, scoreNumber: number | undefined, io: CliIo): number {
  const file = readMidi(new Uint8Array(readFileSync(path)));
  io.out(`${path}: format ${file.format}, ${file.ppq} ticks per quarter`);
  const tracks = [...new Set(file.notes.map((n) => n.track))].sort((a, b) => a - b);
  for (const t of tracks) {
    const notes = file.notes.filter((n) => n.track === t);
    const channels = [...new Set(notes.map((n) => n.channel + 1))].join(', ');
    const first = Math.min(...notes.map((n) => n.onTick));
    const last = Math.max(...notes.map((n) => n.offTick));
    io.out(`  track ${t}: ${notes.length} notes, channel ${channels}, ticks ${first}-${last}`);
  }
  const ly = lyOption !== undefined ? resolve(io.root, lyOption) : path.replace(/\.midi?$/i, '.ly');
  if (!existsSync(ly)) {
    io.out('  no .ly beside it: compare the note counts with the notation by hand');
    return 0;
  }
  const score = readLilyPond(readFileSync(ly, 'utf8'), scoreNumber !== undefined ? { score: scoreNumber } : {});
  const reading = fromLilyPond(score);
  const written = reading.notes.length + reading.graceNotes.length;
  const played = (reading.playedOrder ?? []).reduce(
    (sum, bar) =>
      sum + reading.notes.filter((n) => n.bar === bar).length + reading.graceNotes.filter((g) => g.bar === bar).length,
    0,
  );
  const total = file.notes.length;
  io.out(
    `  ${ly}: \\midi score ${score.midi.unfoldRepeats ? 'unfolds repeats' : 'does not unfold repeats'}` +
      `${score.midi.articulate ? ', uses \\articulate' : ''}`,
  );
  io.out(
    `  notation: ${written} notes and grace notes as written, ${played} in played order; MIDI: ${total} notes in all tracks`,
  );
  io.out(
    `  -> midiOrder ${total === played && played !== written ? 'played' : total === written ? 'written' : '(counts differ: inspect by hand)'}`,
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2), { root: process.cwd(), out: (line) => console.log(line) });
}
