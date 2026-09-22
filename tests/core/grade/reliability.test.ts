import { describe, expect, it } from 'vitest';
import { computeSummary } from '../../../src/core/grade/summary.js';
import type { ExpectedNote, NoteResult, ResultReason } from '../../../src/core/grade/types.js';
import type { ReliabilityEvent } from '../../../src/core/play/types.js';
import type { MeasurePass } from '../../../src/core/timeline/types.js';

describe('Reliability warnings (FR-015, AS-2.5)', () => {
  it('marks measure passes overlapping reliability events as unreliable, leaving the rest usable', () => {
    const REASON: ResultReason = {
      code: 'correctOnTime',
      expectedKey: null,
      playedKey: null,
      octaveDelta: null,
      deltaMs: null,
    };
    const passes: MeasurePass[] = [
      { measureIndex: 0, passNo: 1, startTick: 0, lengthTicks: 960 },
      { measureIndex: 1, passNo: 1, startTick: 960, lengthTicks: 960 },
      { measureIndex: 2, passNo: 1, startTick: 1920, lengthTicks: 960 },
      { measureIndex: 3, passNo: 1, startTick: 2880, lengthTicks: 960 },
    ];
    const expected = passes.map(
      (p, i) =>
        ({
          index: i,
          noteIds: [`n${i}`],
          key: 60,
          onsetTick: p.startTick,
          measureIndex: p.measureIndex,
          passIndex: i,
          chordSize: 1,
          arpeggiated: false,
        }) as ExpectedNote,
    );
    const results = expected.map(
      (e) =>
        ({
          expectedIndex: e.index,
          noteIds: e.noteIds,
          pitch: 'correct',
          timing: 'onTime',
          playedKey: 60,
          deltaTicks: 0,
          deltaMs: 0,
          reason: REASON,
        }) as NoteResult,
    );

    // Event at tick 100 (in pass 0), 2000 (in pass 2), and 3000 (in pass 3)
    const reliability: { kind: ReliabilityEvent['kind']; tick: number }[] = [
      { kind: 'audioDropout', tick: 100 },
      { kind: 'liveQueueDropped', tick: 2000 },
      { kind: 'deviceLost', tick: 3000 },
    ];

    const { measures, reliability: warnings } = computeSummary(
      expected,
      results,
      [],
      reliability,
      passes,
      expected.map(() => false),
    );

    expect(measures.find((m) => m.passIndex === 0)!.unreliable).toBe(true);
    expect(measures.find((m) => m.passIndex === 1)!.unreliable).toBe(false);
    expect(measures.find((m) => m.passIndex === 2)!.unreliable).toBe(true);
    expect(measures.find((m) => m.passIndex === 3)!.unreliable).toBe(true);

    expect(warnings).toContainEqual({ kind: 'audioDropout', fromPassIndex: 0, toPassIndex: 1 });
    expect(warnings).toContainEqual({ kind: 'liveQueueDropped', fromPassIndex: 2, toPassIndex: 3 });
    expect(warnings).toContainEqual({ kind: 'deviceLost', fromPassIndex: 3, toPassIndex: 4 });
  });
});
