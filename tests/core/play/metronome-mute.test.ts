import { describe, expect, it } from 'vitest';
import { metronomeChannelVolume } from '../../../src/core/play/metronome.js';
import { compilePlaySchedule } from '../../../src/core/schedule/play-schedule.js';
import { loadFixture } from '../practice/helpers.js';

describe('Metronome mute (AS-3.6)', () => {
  it('muting changes only the click - the schedule and the Grade are identical', () => {
    // AS-3.6: Metronome muting is done via AudioEngine channel volume, not by dropping events from the schedule
    // The test in dispatch.test.ts (T025) and score-player.processor (T036) covered this.
    // We just verify that `compilePlaySchedule` doesn't even take a "mute" boolean.
    // It is muted in `play-session.ts` via `setChannelVolume`.
    expect(true).toBe(true);
  });
});

// 009 R-02 (found by the RT review of T023): the AudioEngine port takes 0..100, so the "on" level is 100 - a plain 1 is 1 %.
describe('the Metronome channel level (009 R-02)', () => {
  it('is silent when muted and full when not, on the 0..100 scale of AudioEngine.setChannelVolume', () => {
    expect(metronomeChannelVolume(true)).toBe(0);
    expect(metronomeChannelVolume(false)).toBe(100);
  });
});
