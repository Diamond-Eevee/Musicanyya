import { beforeEach, describe, expect, it, vi } from 'vitest';
import { METRONOME_LEVEL_DEFAULT, ORCHESTRA_LEVEL_DEFAULT } from '../../src/core/defaults.js';
import { transportState } from '../../src/ui/state/transportState.js';

// Feature 019, mixer-levels.md sections 1 and 2: the two levels are plain 0..100 integers in the transport state, set
// by the Levels panel, restored by `applySavedSettings` and kept across Scores.
describe('transportState levels (feature 019)', () => {
  beforeEach(() => {
    transportState.applySavedSettings(80, true, METRONOME_LEVEL_DEFAULT, ORCHESTRA_LEVEL_DEFAULT);
  });

  it('starts at the documented defaults', () => {
    expect(transportState.get().metronomeLevel).toBe(100);
    expect(transportState.get().orchestraLevel).toBe(60);
  });

  it('setMetronomeLevel stores the level and notifies subscribers once', () => {
    const listener = vi.fn();
    const off = transportState.subscribe(listener);
    transportState.setMetronomeLevel(30);
    off();
    expect(transportState.get().metronomeLevel).toBe(30);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('setOrchestraLevel stores the level and notifies subscribers once', () => {
    const listener = vi.fn();
    const off = transportState.subscribe(listener);
    transportState.setOrchestraLevel(45);
    off();
    expect(transportState.get().orchestraLevel).toBe(45);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('setting the value a level already has notifies nobody', () => {
    transportState.setMetronomeLevel(30);
    transportState.setOrchestraLevel(45);
    const listener = vi.fn();
    const off = transportState.subscribe(listener);
    transportState.setMetronomeLevel(30);
    transportState.setOrchestraLevel(45);
    off();
    expect(listener).not.toHaveBeenCalled();
  });

  it('the two levels are independent of each other and of the main volume', () => {
    transportState.setMetronomeLevel(10);
    expect(transportState.get().orchestraLevel).toBe(60);
    expect(transportState.get().volume).toBe(80);
    transportState.setOrchestraLevel(90);
    expect(transportState.get().metronomeLevel).toBe(10);
    expect(transportState.get().volume).toBe(80);
  });

  it.each([
    ['below 0', -5, 0],
    ['above 100', 101, 100],
    ['far above 100', 100000, 100],
    ['a fraction', 12.6, 13],
  ])('a level %s is clamped to an integer in 0..100', (_name, given, stored) => {
    transportState.setMetronomeLevel(given);
    transportState.setOrchestraLevel(given);
    expect(transportState.get().metronomeLevel).toBe(stored);
    expect(transportState.get().orchestraLevel).toBe(stored);
  });

  it('a level that is not a finite number is ignored', () => {
    transportState.setMetronomeLevel(40);
    transportState.setOrchestraLevel(50);
    transportState.setMetronomeLevel(Number.NaN);
    transportState.setOrchestraLevel(Number.POSITIVE_INFINITY);
    expect(transportState.get().metronomeLevel).toBe(40);
    expect(transportState.get().orchestraLevel).toBe(50);
  });

  it('applySavedSettings takes both levels together with volume and follow', () => {
    transportState.applySavedSettings(42, false, 25, 75);
    const state = transportState.get();
    expect(state.volume).toBe(42);
    expect(state.follow).toBe(false);
    expect(state.metronomeLevel).toBe(25);
    expect(state.orchestraLevel).toBe(75);
  });

  it('applySavedSettings clamps a stored level and bypasses any driver', () => {
    transportState.applySavedSettings(80, true, 400, -3);
    expect(transportState.get().metronomeLevel).toBe(100);
    expect(transportState.get().orchestraLevel).toBe(0);
  });

  it('a new Score keeps both levels, like volume and follow', () => {
    transportState.setMetronomeLevel(20);
    transportState.setOrchestraLevel(35);
    transportState.newScore();
    expect(transportState.get().metronomeLevel).toBe(20);
    expect(transportState.get().orchestraLevel).toBe(35);
  });
});
