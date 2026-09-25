/**
 * The Listen cursor's position logic exactly as `MxScoreView.updateCursor` had it inline before feature 009 moved it to
 * `src/core/timeline/position.ts` (contract play-display.md section 1). It is copied here verbatim so the moved code can be
 * held to what it replaced: `listen-cursor.golden.json` was generated from these two functions (see `sampleTimeline`), and
 * `position.test.ts` asserts that `notesAtTick` / `passAtTick` reproduce it. Do not "improve" them.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import { buildTimeline } from '../../../src/core/timeline/timeline.js';
import type { PlaybackTimeline } from '../../../src/core/timeline/types.js';
import { decodeXml } from '../../../src/engine/files/decode.js';
import { readMxl } from '../../../src/engine/files/mxl.js';
import type { TimelineDto } from '../../../src/ui/elements/mx-score-view.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../../fixtures/musicxml');

/** The Listen highlight set: `updateCursor`'s `soundingNoteIds` while the transport is playing (verbatim). */
export function listenNotesAtTick(timeline: TimelineDto, tick: number): string[] {
  return timeline.spans.filter((span) => span.startTick <= tick && span.endTick > tick).map((span) => span.noteId);
}

/** The Listen cursor's pass: `updateCursor`'s `pass` (verbatim). */
export function listenPassAtTick(timeline: TimelineDto, tick: number) {
  return (
    timeline.passes.find((p) => p.startTick <= tick && tick < p.endTick) ?? timeline.passes[timeline.passes.length - 1]
  );
}

/** The compact timeline the worker sends the view (`score.worker.ts`: a pass ends at `startTick + lengthTicks`). */
export function compactTimeline(timeline: PlaybackTimeline): TimelineDto {
  return {
    ppq: timeline.ppq,
    endTick: timeline.endTick,
    passes: timeline.passes.map((p) => ({
      measureIndex: p.measureIndex,
      startTick: p.startTick,
      endTick: p.startTick + p.lengthTicks,
    })),
    spans: timeline.spans.map((s) => ({ noteId: s.noteId, startTick: s.startTick, endTick: s.endTick })),
  };
}

/** A fixture (`.musicxml` or `.mxl`, relative to tests/fixtures/musicxml) as the compact timeline the view holds. */
export async function loadListenTimeline(relativePath: string): Promise<TimelineDto> {
  let bytes: Uint8Array = fs.readFileSync(path.join(fixturesDir, relativePath));
  if (relativePath.endsWith('.mxl')) bytes = await readMxl(bytes);
  const { doc } = readXml(decodeXml(bytes));
  const { score } = buildScore(doc);
  return compactTimeline(buildTimeline(score).timeline);
}

/** One golden entry: the state at `tick`, written only where it differs from the previous sample. */
export type GoldenSample = [tick: number, noteIds: string[], passIndex: number];

/**
 * Samples a position function at every quarter of a beat from tick 0 to one beat past the end (so the "last pass"
 * fallback is covered), keeping only the samples where the note set or the pass changes.
 */
export function sampleTimeline(
  timeline: TimelineDto,
  notesAt: (timeline: TimelineDto, tick: number) => Iterable<string>,
  passIndexAt: (timeline: TimelineDto, tick: number) => number,
): GoldenSample[] {
  const step = timeline.ppq / 4;
  const samples: GoldenSample[] = [];
  let previous = '';
  for (let tick = 0; tick <= timeline.endTick + timeline.ppq; tick += step) {
    const noteIds = [...notesAt(timeline, tick)];
    const passIndex = passIndexAt(timeline, tick);
    const signature = `${passIndex}|${noteIds.join(',')}`;
    if (signature === previous) continue;
    previous = signature;
    samples.push([tick, noteIds, passIndex]);
  }
  return samples;
}

/** The pass index of the reference implementation: its position in `passes`, -1 when there is none. */
export function referencePassIndex(timeline: TimelineDto, tick: number): number {
  const pass = listenPassAtTick(timeline, tick);
  return pass === undefined ? -1 : timeline.passes.indexOf(pass);
}

/** The fixtures the golden covers: the new grade fixture, the chord fixture and three real pieces (repeats, ties, lieder). */
export const GOLDEN_FIXTURES = [
  'grade/grade-marks.musicxml',
  'chords/c-major-scale-and-chords.musicxml',
  'real/chopin-zyczenie.mxl',
  'real/schumann-dichterliebe-15.mxl',
  'real/mendelssohn-duet-op63-1.mxl',
] as const;
