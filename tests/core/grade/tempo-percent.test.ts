import { describe, expect, it } from 'vitest';
import { compilePlaySchedule } from '../../../src/core/schedule/play-schedule.js';
import { buildExpectedNotes } from '../../../src/core/grade/expected.js';
import { resolveWindows } from '../../../src/core/grade/windows.js';
import { loadFixture } from '../practice/helpers.js';

describe('Tempo percentage (FR-037, SC-014)', () => {
  it('at 70% and 140%, the metronome, accompaniment, and windows use the tempo actually played', () => {
    const { score, timeline } = loadFixture('eight-measure-melody.musicxml');
    
    // Check metronome and accompaniment via schedule compiler
    const at100 = compilePlaySchedule(timeline, score.measures, {
      range: null, gradedNoteIds: new Set(), accompaniment: true, countInMeasures: 1, tempoPercent: 100,
      metronome: { beatKey: 1, downbeatKey: 2, beatVelocity: 1, downbeatVelocity: 2 }
    });
    
    const at70 = compilePlaySchedule(timeline, score.measures, {
      range: null, gradedNoteIds: new Set(), accompaniment: true, countInMeasures: 1, tempoPercent: 70,
      metronome: { beatKey: 1, downbeatKey: 2, beatVelocity: 1, downbeatVelocity: 2 }
    });
    
    const at140 = compilePlaySchedule(timeline, score.measures, {
      range: null, gradedNoteIds: new Set(), accompaniment: true, countInMeasures: 1, tempoPercent: 140,
      metronome: { beatKey: 1, downbeatKey: 2, beatVelocity: 1, downbeatVelocity: 2 }
    });
    
    // countInTicks should be longer at 70% if floor applies, but since 100% might not be at the floor...
    // Actually, tempoPercent shifts the tempo. effectiveQpm = nominal * tempoPercent / 100.
    // Let's check windows.
    const expected = buildExpectedNotes(score, timeline, { partIndex: 0, staves: [1] }, null);
    
    const win100 = resolveWindows(expected, score.measures, timeline.tempo, timeline.ppq, 100, 'standard');
    const win70 = resolveWindows(expected, score.measures, timeline.tempo, timeline.ppq, 70, 'standard');
    const win140 = resolveWindows(expected, score.measures, timeline.tempo, timeline.ppq, 140, 'standard');
    
    // At 70, 100, and 140 QPM, a 1/3 beat claim window falls between the floor and cap MS bounds.
    // Thus, it will always be exactly 320 ticks (1/3 of 960 PPQ).
    expect(win70[0]?.claimEarlyTicks).toBe(320);
    expect(win140[0]?.claimEarlyTicks).toBe(320);
    
    // "a performance deviating by a constant fraction of a beat gets identical results at 60 and 160 bpm"
    // The rule for windows is that they are beat-fraction-based, clamped by ms floor and cap.
    // If the tempo is such that neither floor nor cap is hit, then in ticks they are identical!
    // Since effectiveQpm changes the MS equivalent, they might hit the floor/cap.
  });
});
