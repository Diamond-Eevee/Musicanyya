// Shared helpers for the generator tests (feature 011): read a generated MusicXML file back through the app's own
// parser, derive its library facts and run the level check exactly as `tools/library/build-index.ts` does.
import { deriveFacts } from '../../../../src/core/library/facts.js';
import { checkLevel } from '../../../../src/core/library/levels.js';
import type { ItemFacts, ItemMetadata, LevelCheck } from '../../../../src/core/library/types.js';
import { buildScore } from '../../../../src/core/musicxml/build.js';
import { readXml } from '../../../../src/core/musicxml/read.js';
import { buildTimeline } from '../../../../src/core/timeline/timeline.js';

export interface TestNote {
  /** 1-based measure number. */
  measure: number;
  staff: number;
  /** Ticks inside the measure (960 per quarter). */
  onset: number;
  midi: number;
  duration: number;
  finger: number | null;
}

export function notesOf(xml: string): TestNote[] {
  const { doc } = readXml(xml);
  const { score } = buildScore(doc);
  return (score.parts[0]?.notes ?? [])
    .map((n) => ({
      measure: n.measureIndex + 1,
      staff: n.staff,
      onset: n.onsetInMeasure,
      midi: n.soundingKey,
      duration: n.durationTicks,
      finger: n.fingerings[0]?.finger ?? null,
    }))
    .sort((a, b) => a.measure - b.measure || a.staff - b.staff || a.onset - b.onset || a.midi - b.midi);
}

export function factsOf(xml: string): ItemFacts {
  const { doc } = readXml(xml);
  const { score, report } = buildScore(doc);
  const { timeline, notices } = buildTimeline(score);
  return deriveFacts({ doc, score, timeline, report, timelineNotices: notices });
}

/** The level check as the index builder runs it (same options). */
export function levelCheckOf(facts: ItemFacts, meta: ItemMetadata, withRaisedBecause = true): LevelCheck {
  return checkLevel(facts, meta.level, {
    ...(withRaisedBecause && meta.raisedBecause !== undefined ? { raisedBecause: meta.raisedBecause } : {}),
    expectedNotices: meta.expected?.notices ?? [],
    kind: meta.kind,
    tags: meta.tags,
    ...(meta.arrangement !== undefined ? { arrangement: meta.arrangement } : {}),
  });
}

/** Groups the notes of one staff in one measure by onset: each entry is the sounding notes of one attack. */
export function attacks(notes: readonly TestNote[], staff: number, measure: number): TestNote[][] {
  const byOnset = new Map<number, TestNote[]>();
  for (const note of notes) {
    if (note.staff !== staff || note.measure !== measure) continue;
    byOnset.set(note.onset, [...(byOnset.get(note.onset) ?? []), note]);
  }
  return [...byOnset.entries()].sort((a, b) => a[0] - b[0]).map(([, group]) => group);
}
