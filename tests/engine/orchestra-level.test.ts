/**
 * Feature 019, US3 (spec FR-002, FR-004, FR-005, SC-001, SC-002, SC-009 Orchestra half): the Orchestra level only scales the
 * Orchestra. `piano-and-oboe` (a two-staff piano and an oboe that plays on the same beats a third above, 100 qpm, four bars of
 * 4/4) is rendered through the real score-player processor and SpessaSynth in Listen, and compared with its twin - the same
 * file without the oboe - which is the piano alone.
 */
import { describe, expect, it } from 'vitest';
import { ORCHESTRA_SILENT_TOLERANCE_DBFS } from '../../src/core/defaults.js';
import { type ListenRender, renderListen, SAMPLE_RATE, type SynthNote } from './helpers/listen-render.js';

const FIXTURE = 'orchestra/piano-and-oboe.musicxml';
const TWIN = 'orchestra/piano-and-oboe-twin.musicxml';
const BLOCK = 128;
const SECONDS = 9;
const SILENT = 10 ** (ORCHESTRA_SILENT_TOLERANCE_DBFS / 20); // the named tolerance as an amplitude

type Send = (msg: { type: string; [field: string]: unknown }) => void;

/** Plays from the start with the Orchestra level and the main volume as given (0..1). */
function render(fixture: string, level: number, volume = 1, extra?: (frame: number, send: Send) => void): ListenRender {
  return renderListen(fixture, {
    seconds: SECONDS,
    beforeBlock: (frame, send) => {
      if (frame === 0) {
        send({ type: 'volume', gain: volume });
        send({ type: 'orchestraLevel', gain: level });
        send({ type: 'play' });
      }
      extra?.(frame, send);
    },
  });
}

const maxDifference = (a: ListenRender, b: ListenRender, from = 0, to = a.left.length): number => {
  let max = 0;
  for (let i = from; i < to; i++) {
    max = Math.max(
      max,
      Math.abs((a.left[i] as number) - (b.left[i] as number)),
      Math.abs((a.right[i] as number) - (b.right[i] as number)),
    );
  }
  return max;
};

/** What the oboe adds: the render with it minus the render without it (the piano and the effects are the same in both). */
function contribution(withOboe: ListenRender, twin: ListenRender, from: number, to: number): number {
  let sum = 0;
  for (let i = from; i < to; i++) {
    sum += ((withOboe.left[i] as number) - (twin.left[i] as number)) ** 2;
    sum += ((withOboe.right[i] as number) - (twin.right[i] as number)) ** 2;
  }
  return Math.sqrt(sum / (2 * (to - from)));
}

const noteKeys = (notes: readonly SynthNote[]) => notes.map((n) => `${n.frame}:${n.kind}:${n.channel}:${n.key}`);

describe('the Orchestra level, offline (019 US3)', () => {
  it('at level 0 the output equals the piano alone, to within ORCHESTRA_SILENT_TOLERANCE_DBFS (SC-002)', () => {
    const twin = render(TWIN, 1);
    const silent = render(FIXTURE, 0);
    expect(maxDifference(silent, twin)).toBeLessThan(SILENT);
    // and at full level the oboe is plainly there, so the comparison means something
    expect(contribution(render(FIXTURE, 1), twin, 0, twin.left.length)).toBeGreaterThan(0.001);
  }, 120_000);

  it('every note-on and note-off is at the same frame at levels 0, 50 and 100 (SC-001)', () => {
    const full = noteKeys(render(FIXTURE, 1).notes);
    expect(full.length).toBeGreaterThan(20);
    expect(noteKeys(render(FIXTURE, 0.5).notes)).toEqual(full);
    expect(noteKeys(render(FIXTURE, 0).notes)).toEqual(full);
  }, 120_000);

  it('a mid-note level change is heard within one render block, adds no note-on, and the piano does not change (FR-005)', () => {
    const twin = render(TWIN, 1);
    const steady = render(FIXTURE, 1);
    const changeFrame = Math.round(10.5 * (60 / 100) * SAMPLE_RATE); // bar 4 beat 2: the held oboe E5 sounds until beat 4
    const aligned = Math.ceil(changeFrame / BLOCK) * BLOCK;
    const changed = render(FIXTURE, 1, 1, (frame, send) => {
      if (frame === aligned) send({ type: 'orchestraLevel', gain: 0 });
    });

    expect(noteKeys(changed.notes)).toEqual(noteKeys(steady.notes)); // nothing retriggered, nothing added
    expect(contribution(steady, twin, aligned - 4800, aligned)).toBeGreaterThan(0.001); // the oboe is sounding before
    expect(contribution(changed, twin, aligned - 4800, aligned)).toBeCloseTo(
      contribution(steady, twin, aligned - 4800, aligned),
      9,
    );
    // the synth eases a controller change in over a few milliseconds: within three blocks (8 ms) the oboe is already much
    // quieter, and by SC-001's 100 ms what is left is its reverb tail (the effects send keeps ringing), a small part of before
    const before = contribution(steady, twin, aligned - 480, aligned);
    const hundredMs = Math.round(0.1 * SAMPLE_RATE);
    expect(contribution(changed, twin, aligned + 3 * BLOCK, aligned + 3 * BLOCK + 480)).toBeLessThan(0.5 * before);
    expect(contribution(changed, twin, aligned + hundredMs, aligned + hundredMs + 480)).toBeLessThan(0.1 * before);
    // and before the change the output is exactly the unchanged render's
    expect(maxDifference(changed, steady, 0, aligned)).toBe(0);
  }, 120_000);

  it('moving the level every render block for the whole piece adds no late event and no dropped message (SC-009, Orchestra half)', () => {
    const steady = render(FIXTURE, 1);
    const swept = render(FIXTURE, 1, 1, (frame, send) => {
      const phase = ((frame / SAMPLE_RATE) % 2) / 2;
      send({ type: 'orchestraLevel', gain: phase < 0.5 ? phase * 2 : 2 - phase * 2 });
    });
    expect(swept.lateEvents).toBe(steady.lateEvents);
    expect(swept.messages.some((m) => m.type === 'liveDropped' || m.type === 'status')).toBe(false);
    expect(noteKeys(swept.notes)).toEqual(noteKeys(steady.notes));
  }, 120_000);

  it('the level multiplies with the main Volume (FR-004): half the Volume halves what the oboe adds', () => {
    const from = 1 * SAMPLE_RATE;
    const to = 3 * SAMPLE_RATE;
    const fullVolume = contribution(render(FIXTURE, 1, 1), render(TWIN, 1, 1), from, to);
    const halfVolume = contribution(render(FIXTURE, 1, 0.5), render(TWIN, 1, 0.5), from, to);
    const halfLevel = contribution(render(FIXTURE, 0.5, 1), render(TWIN, 1, 1), from, to);
    expect(halfVolume / fullVolume).toBeGreaterThan(0.45);
    expect(halfVolume / fullVolume).toBeLessThan(0.55);
    expect(halfLevel).toBeLessThan(fullVolume); // a lower level is quieter, at the same Volume
    expect(halfLevel).toBeGreaterThan(0);
  }, 180_000);

  it('the level is not a Listen-only thing: it survives pause and play without a restart of the held value', () => {
    const twin = render(TWIN, 1);
    const paused = render(FIXTURE, 0, 1, (frame, send) => {
      if (frame === 100 * BLOCK) send({ type: 'pause' });
      if (frame === 200 * BLOCK) send({ type: 'play' });
    });
    // the piano alone plays on after the pause (same notes), and the silenced oboe adds nothing before the pause
    expect(contribution(paused, twin, 0, 100 * BLOCK)).toBeLessThan(SILENT);
  }, 120_000);
});
