import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PLAY_STRICTNESS_DEFAULT } from '../../src/core/defaults.js';
import { buildExpectedNotes, buildPlayedAlongSpans } from '../../src/core/grade/expected.js';
import { gradePerformance } from '../../src/core/grade/grade.js';
import type { Grade, GradeInput, LatencyProfile, PerformanceLog } from '../../src/core/grade/types.js';
import { buildScore } from '../../src/core/musicxml/build.js';
import { readXml } from '../../src/core/musicxml/read.js';
import type { RunSettings } from '../../src/core/play/types.js';
import type { HandSelection } from '../../src/core/practice/types.js';
import type { ScheduleMessage } from '../../src/core/schedule/compile.js';
import { compileSchedule } from '../../src/core/schedule/compile.js';
import { audioTimeAtTick } from '../../src/core/tempo/rate.js';
import { buildTimeline } from '../../src/core/timeline/timeline.js';
import { decodeXml } from '../../src/engine/files/decode.js';

const ZERO_LATENCY: LatencyProfile = { outputLatencyMs: 0, inputLatencyMs: 0, source: 'assumed', measuredAt: null };
const FUR_ELISE_THEME = 'repertoire/intermediate/fur-elise-theme.musicxml';

export interface NoteIdentity {
  id: string;
  measureIndex: number;
  onsetInMeasure: number;
  durationTicks: number;
  soundingKey: number;
}

export interface ItemIdentity {
  file: string;
  notes: NoteIdentity[];
  scheduleDigest: string;
}

export interface LibraryIdentityGolden {
  items: ItemIdentity[];
  furEliseThemeGrade: Grade;
}

function walkMusicXml(dir: string, base: string = dir): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkMusicXml(full, base));
    } else if (/\.musicxml$/i.test(entry.name)) {
      out.push(path.relative(base, full).split(path.sep).join('/'));
    }
  }
  return out.sort();
}

async function digestSchedule(schedule: ScheduleMessage): Promise<string> {
  const header = new Int32Array([schedule.ppq, schedule.endTick]);
  const buffers = [
    header.buffer,
    schedule.eventTick.buffer,
    schedule.eventKind.buffer,
    schedule.eventChannel.buffer,
    schedule.eventData1.buffer,
    schedule.eventData2.buffer,
    schedule.tempoTick.buffer,
    schedule.tempoQpmNum.buffer,
    schedule.tempoQpmDen.buffer,
    schedule.channelSetup.buffer,
  ];
  const totalBytes = buffers.reduce((sum, b) => sum + b.byteLength, 0);
  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const b of buffers) {
    combined.set(new Uint8Array(b), offset);
    offset += b.byteLength;
  }
  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function loadScore(fullPath: string) {
  const xml = decodeXml(fs.readFileSync(fullPath));
  const { doc } = readXml(xml);
  const { score } = buildScore(doc);
  const { timeline } = buildTimeline(score);
  return { score, timeline };
}

/**
 * Builds an exactly-on-time, every-note-correct performance log for `fur-elise-theme.musicxml`, so
 * the SC-003 golden grade is deterministic and independent of the engraving pass (T050 re-grades the
 * same saved log against the completed file and expects the identical Grade).
 */
function buildAccuratePerformanceLog(
  expected: ReturnType<typeof buildExpectedNotes>,
  timeline: ReturnType<typeof buildTimeline>['timeline'],
): PerformanceLog {
  const messages: PerformanceLog['messages'] = [];
  for (const note of expected) {
    const audioTimeSec = audioTimeAtTick(note.onsetTick, timeline.tempo, timeline.ppq, 100);
    messages.push({
      kind: 'noteOn',
      key: note.key,
      velocity: 80,
      down: false,
      audioTimeSec,
      timeStampMs: audioTimeSec * 1000,
      deviceId: 'fake-keyboard',
    });
    messages.push({
      kind: 'noteOff',
      key: note.key,
      velocity: 0,
      down: false,
      audioTimeSec: audioTimeSec + 0.1,
      timeStampMs: (audioTimeSec + 0.1) * 1000,
      deviceId: 'fake-keyboard',
    });
  }
  return { version: 1, messages, droppedMessages: 0 };
}

export async function buildLibraryIdentity(
  libraryRoot: string,
): Promise<{ golden: LibraryIdentityGolden; performanceLogFixture: unknown }> {
  const items: ItemIdentity[] = [];
  for (const relFile of walkMusicXml(libraryRoot)) {
    const { score, timeline } = loadScore(path.join(libraryRoot, relFile));
    const schedule = compileSchedule(timeline);
    const notes: NoteIdentity[] = score.parts.flatMap((part) =>
      part.notes.map((note) => ({
        id: note.id,
        measureIndex: note.measureIndex,
        onsetInMeasure: note.onsetInMeasure,
        durationTicks: note.durationTicks,
        soundingKey: note.soundingKey,
      })),
    );
    items.push({ file: relFile, notes, scheduleDigest: await digestSchedule(schedule) });
  }

  const { score, timeline } = loadScore(path.join(libraryRoot, FUR_ELISE_THEME));
  const selection: HandSelection = {
    preset: 'both',
    partIndex: 0,
    staves: Array.from({ length: score.parts[0]?.staves ?? 2 }, (_, i) => i + 1),
  };
  const expected = buildExpectedNotes(score, timeline, selection, null);
  const playedAlong = buildPlayedAlongSpans(score, timeline, selection, null);
  const log = buildAccuratePerformanceLog(expected, timeline);

  const settings: RunSettings = {
    range: null,
    tempoPercent: 100,
    selection,
    strictness: PLAY_STRICTNESS_DEFAULT,
    countInMeasures: 1,
    metronomeMuted: false,
    accompaniment: true,
  };

  const input: GradeInput = {
    runId: 'library-identity-fur-elise-theme',
    complete: true,
    expected,
    playedAlong,
    log,
    tempo: timeline.tempo,
    timelineTempo: timeline.tempo,
    ppq: timeline.ppq,
    tickMap: { countInTicks: 0, rangeStartTick: 0, rangeEndTick: timeline.endTick, ppq: timeline.ppq },
    startAudioTimeSec: 0,
    settings,
    latency: ZERO_LATENCY,
    reliability: [],
    passes: timeline.passes,
    measures: score.measures,
  };
  const furEliseThemeGrade = gradePerformance(input);

  return {
    golden: { items, furEliseThemeGrade },
    performanceLogFixture: { scoreFixture: FUR_ELISE_THEME, settings, log },
  };
}

async function main() {
  const libraryRoot = fileURLToPath(new URL('../../public/library/', import.meta.url));
  const { golden, performanceLogFixture } = await buildLibraryIdentity(libraryRoot);

  const goldenPath = fileURLToPath(new URL('../../tests/fixtures/library-identity.json', import.meta.url));
  fs.writeFileSync(goldenPath, `${JSON.stringify(golden, null, 2)}\n`);

  const logDir = fileURLToPath(new URL('../../tests/fixtures/performance-logs/', import.meta.url));
  fs.mkdirSync(logDir, { recursive: true });
  fs.writeFileSync(path.join(logDir, 'fur-elise-theme.json'), `${JSON.stringify(performanceLogFixture, null, 2)}\n`);

  console.log(
    `Wrote ${path.relative(process.cwd(), goldenPath)}: ${golden.items.length} items. ` +
      `Wrote ${path.relative(process.cwd(), path.join(logDir, 'fur-elise-theme.json'))}.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
