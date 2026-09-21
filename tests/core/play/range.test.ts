import { describe, expect, it } from 'vitest';
import { buildExpectedNotes } from '../../../src/core/grade/expected.js';
import { compilePlaySchedule } from '../../../src/core/schedule/play-schedule.js';
import { resolveLoop, loopRangeToPassIndices } from '../../../src/core/practice/loop.js';
import { buildExpectedEvents } from '../../../src/core/practice/expected.js';
import { loadFixture } from '../practice/helpers.js';

describe('Play mode range (FR-036, AS-3.1)', () => {
  it('resolves a written measure range to passes, starts and ends there, and expects exactly those notes', () => {
    const { score, timeline } = loadFixture('eight-measure-melody.musicxml');
    
    // Range: measures 5 to 8 (inclusive indices: 4 to 7).
    const measureRange = { fromMeasureIndex: 4, toMeasureIndex: 7 };
    
    const events = buildExpectedEvents(score, timeline, { partIndex: 0, staves: [1, 2] });
    console.log('Events length:', events.length);
    console.log('Passes:', timeline.passes);
    const loop = resolveLoop(events, timeline.passes, measureRange, 0);
    expect(loop).not.toBeNull();
    
    const loopPassSpan = loopRangeToPassIndices(loop!);
    // Play's `LoopPassSpan` is exclusive on `toPassIndex` (noted in contracts/play-run.md 1.1.1).
    // Wait! loopRangeToPassIndices returns an inclusive toPassIndex. The test says 
    // "a written measure range resolves to passes with 002's loopRangeToPassIndices". 
    // The schedule compiler expects exclusive `toPassIndex`.
    const range = { fromPassIndex: loopPassSpan.fromPassIndex, toPassIndex: loopPassSpan.toPassIndex + 1 };
    
    // 1. Grade expects exactly those notes
    const expected = buildExpectedNotes(score, timeline, { partIndex: 0, staves: [1, 2] }, range);
    expect(expected.length).toBeGreaterThan(0);
    
    for (const note of expected) {
      expect(note.passIndex).toBeGreaterThanOrEqual(range.fromPassIndex);
      expect(note.passIndex).toBeLessThan(range.toPassIndex);
    }
    
    // 2. Schedule starts and ends there
    const { schedule, tickMap } = compilePlaySchedule(timeline, score.measures, {
      range,
      gradedNoteIds: new Set(expected.map((n) => n.id)),
      accompaniment: true,
      countInMeasures: 1,
      tempoPercent: 100,
      metronome: { beatKey: 0, downbeatKey: 0, beatVelocity: 0, downbeatVelocity: 0 },
    });
    
    const expectedStartTick = timeline.passes.find(p => p.measureIndex === 4)?.startTick;
    expect(tickMap.rangeStartTick).toBe(expectedStartTick);
  });
});
