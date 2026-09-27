import { describe, expect, it } from 'vitest';
import { TEMPO_PERCENT_DEFAULT } from '../../src/engine/config.js';
import { tempoFieldBinding } from '../../src/ui/state/tempoBinding.js';

// contracts/tempo-field.md, data-model.md section 5 (feature 012, US3): which segment and percent the field
// shows in each mode, and when it locks.

const quarter = { type: 'quarter', dots: 0, quartersNum: 1, quartersDen: 1 } as const;

const listenSegment = {
  startTick: 0,
  qpmNum: 90,
  qpmDen: 1,
  beat: quarter,
  beatSource: 'mark',
  isDefault: false,
} as const;
const playSegment = {
  startTick: 480,
  qpmNum: 120,
  qpmDen: 1,
  beat: quarter,
  beatSource: 'mark',
  isDefault: false,
} as const;

describe('tempoFieldBinding (US3)', () => {
  it('Listen: uses the transport segment and percent, never locked', () => {
    const result = tempoFieldBinding('listen', { segment: listenSegment, percent: 80 }, null, null);
    expect(result).toEqual({ segment: listenSegment, percent: 80, locked: false });
  });

  it('Practice: uses the transport segment and percent, never locked', () => {
    const result = tempoFieldBinding('practice', { segment: listenSegment, percent: 100 }, null, null);
    expect(result).toEqual({ segment: listenSegment, percent: 100, locked: false });
  });

  it('Play, no run: uses the Play settings percent and the range-start segment given by the caller', () => {
    const result = tempoFieldBinding(
      'play',
      { segment: listenSegment, percent: 100 },
      { segment: playSegment, tempoPercent: 75 },
      null,
    );
    expect(result).toEqual({ segment: playSegment, percent: 75, locked: false });
  });

  it('Play with no setup yet: no segment, the default percent, unlocked', () => {
    const result = tempoFieldBinding('play', { segment: listenSegment, percent: 100 }, null, null);
    expect(result).toEqual({ segment: null, percent: TEMPO_PERCENT_DEFAULT, locked: false });
  });

  it('Play: locked during count-in', () => {
    const result = tempoFieldBinding(
      'play',
      { segment: listenSegment, percent: 100 },
      { segment: playSegment, tempoPercent: 75 },
      { phase: 'countIn' },
    );
    expect(result.locked).toBe(true);
  });

  it('Play: locked while running', () => {
    const result = tempoFieldBinding(
      'play',
      { segment: listenSegment, percent: 100 },
      { segment: playSegment, tempoPercent: 75 },
      { phase: 'running' },
    );
    expect(result.locked).toBe(true);
  });

  for (const phase of ['idle', 'finished', 'stopped', 'aborted'] as const) {
    it(`Play: unlocked once the run has ended (phase ${phase})`, () => {
      const result = tempoFieldBinding(
        'play',
        { segment: listenSegment, percent: 100 },
        { segment: playSegment, tempoPercent: 75 },
        { phase },
      );
      expect(result.locked).toBe(false);
    });
  }
});
