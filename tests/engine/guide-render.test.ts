/**
 * Feature 020, US1 and US2 (spec SC-001, SC-002, SC-003, SC-006, FR-005, FR-008, FR-011, guide-voice.md section 5): a Play run on a
 * Score without an Orchestra, rendered offline through the real score-player processor, the real SpessaSynth and the shipped
 * SoundFont. `eight-measure-melody` (one piano, 29 notes, 100 qpm, 4/4) has every note graded and no input is played: the
 * Guide voice is all the Score there is besides the clicks.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VOICE_CAP } from 'spessasynth_core';
import { describe, expect, it } from 'vitest';
import {
  GUIDE_QUIETER_MIN_DB,
  ORCHESTRA_LEVEL_DEFAULT,
  ORCHESTRA_SILENT_TOLERANCE_DBFS,
  VOICE_HEADROOM_FRACTION,
} from '../../src/core/defaults.js';
import { type PlayRender, renderPlayRun, SAMPLE_RATE } from './helpers/listen-render.js';

const MELODY = 'eight-measure-melody.musicxml';
const BLOCK = 128;
const SILENT = 10 ** (ORCHESTRA_SILENT_TOLERANCE_DBFS / 20); // the named tolerance as an amplitude
const TEMPOS = [50, 100, 150];

/** Seconds that cover the count-in and the whole 19.2 s melody at `tempoPercent`. */
const secondsAt = (tempoPercent: number) => 26 / (tempoPercent / 100) + 8;

type Send = (msg: { type: string; [field: string]: unknown }) => void;

/** A Play run of the melody, every note graded; `guide` and the Orchestra level as given. */
function melodyRun(
  options: {
    guide?: boolean;
    level?: number;
    tempoPercent?: number;
    seconds?: number;
    accompaniment?: boolean;
    metronomeVolume?: number;
    graded?: 'all';
    dry?: boolean;
    beforeBlock?: (frame: number, send: Send) => void;
  } = {},
): PlayRender {
  const tempoPercent = options.tempoPercent ?? 100;
  return renderPlayRun(MELODY, {
    source: 'fixture',
    seconds: options.seconds ?? secondsAt(tempoPercent),
    tempoPercent,
    accompaniment: options.accompaniment ?? true,
    metronomeVolume: options.metronomeVolume ?? 100,
    ...(options.graded === undefined && options.guide === undefined ? {} : { graded: 'all' as const }),
    ...(options.guide === undefined ? {} : { guide: options.guide }),
    ...(options.level === undefined ? {} : { orchestraLevel: options.level }),
    ...(options.dry ? { dry: true } : {}),
    ...(options.beforeBlock ? { beforeBlock: options.beforeBlock } : {}),
  });
}

const rms = (render: PlayRender, from: number, to: number): number => {
  let sum = 0;
  for (let i = from; i < to; i++) {
    sum += (render.left[i] as number) ** 2 + (render.right[i] as number) ** 2;
  }
  return Math.sqrt(sum / (2 * (to - from)));
};

const maxDifference = (a: PlayRender, b: PlayRender, from = 0, to = a.left.length): number => {
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

/** What the Guide voice adds: the guided render minus the unguided one (the clicks and the effects are the same in both). */
function contribution(guided: PlayRender, unguided: PlayRender, from: number, to: number): number {
  let sum = 0;
  for (let i = from; i < to; i++) {
    sum += ((guided.left[i] as number) - (unguided.left[i] as number)) ** 2;
    sum += ((guided.right[i] as number) - (unguided.right[i] as number)) ** 2;
  }
  return Math.sqrt(sum / (2 * (to - from)));
}

const noteKeys = (render: PlayRender) => render.notes.map((n) => `${n.frame}:${n.kind}:${n.channel}:${n.key}`);
const guideOf = (render: PlayRender): number => {
  expect(render.guideChannel).not.toBeNull();
  return render.guideChannel as number;
};

describe('the Guide voice in an offline Play run (feature 020 US1)', () => {
  for (const tempoPercent of TEMPOS) {
    it(`every guide onset is at its scheduled frame (within 1 sample) at ${tempoPercent} % tempo, none inside the count-in (SC-001)`, () => {
      const render = melodyRun({ guide: true, level: ORCHESTRA_LEVEL_DEFAULT, tempoPercent });
      const guide = guideOf(render);
      const scheduled = render.noteOnFrames(guide);
      const given = render.notes.filter((n) => n.kind === 'on' && n.channel === guide).map((n) => n.frame);
      expect(scheduled).toHaveLength(29);
      expect(given).toHaveLength(scheduled.length);
      for (const [i, frame] of scheduled.entries()) {
        expect(Math.abs((given[i] as number) - frame)).toBeLessThanOrEqual(1);
      }
      expect(Math.min(...given)).toBeGreaterThanOrEqual(render.countInEndFrame - 1); // the first note is the first beat of the run
      expect(render.countInEndFrame).toBeGreaterThan(0);
      expect(given.filter((frame) => frame < render.countInEndFrame - 1)).toEqual([]);
    }, 120_000);
  }

  it(`at the default Orchestra level the Guide voice is at least ${GUIDE_QUIETER_MIN_DB} dB quieter than the piano playing the same notes (SC-002)`, () => {
    // Only the notes: the clicks off, the accompaniment off so the guided run holds the guide alone; the same notes on the piano
    // channel at the written velocity are the run with nothing graded.
    const guided = melodyRun({
      guide: true,
      level: ORCHESTRA_LEVEL_DEFAULT,
      accompaniment: false,
      metronomeVolume: 0,
    });
    const piano = melodyRun({ accompaniment: true, metronomeVolume: 0 });
    const from = guided.countInEndFrame;
    const to = from + Math.round(19.2 * SAMPLE_RATE);
    expect(piano.countInEndFrame).toBe(from);
    const guideRms = rms(guided, from, to);
    const pianoRms = rms(piano, from, to);
    expect(guideRms).toBeGreaterThan(SILENT); // the guide is there to be measured
    expect(pianoRms).toBeGreaterThan(SILENT);
    const quieterByDb = 20 * Math.log10(pianoRms / guideRms);
    expect(quieterByDb).toBeGreaterThanOrEqual(GUIDE_QUIETER_MIN_DB);
  }, 120_000);

  // The processor ends every held note with a note-off and keeps nothing: after `stop` or `pause`, the notes given to the synth
  // stop, and with the reverb off nothing is left once the release is over (spec edge case "Stop, pause, mode switch").
  describe.each(['stop', 'pause'] as const)('%s in the middle of a guide note', (message) => {
    it('releases the guide notes in the next block, plays no more, and leaves no voice ringing', () => {
      const probe = melodyRun({ guide: true, level: 100, dry: true });
      const guide = guideOf(probe);
      const onsets = probe.noteOnFrames(guide);
      const stopFrame = Math.ceil(((onsets[6] as number) + 0.3 * SAMPLE_RATE) / BLOCK) * BLOCK; // a quarter lasts 0.6 s at 100 qpm

      const render = melodyRun({
        guide: true,
        level: 100,
        dry: true,
        seconds: 40,
        beforeBlock: (frame, send) => {
          if (frame === stopFrame) send({ type: message });
        },
      });
      const guideNotes = render.notes.filter((n) => n.channel === guide);
      const sounding =
        guideNotes.filter((n) => n.kind === 'on' && n.frame < stopFrame).length -
        guideNotes.filter((n) => n.kind === 'off' && n.frame < stopFrame).length;
      expect(sounding).toBeGreaterThan(0); // the stop really was in the middle of a note
      expect(guideNotes.filter((n) => n.kind === 'off' && n.frame === stopFrame)).toHaveLength(sounding); // all released, at once
      expect(guideNotes.filter((n) => n.kind === 'on' && n.frame >= stopFrame)).toEqual([]); // and none starts after
      expect(render.finalVoices).toBe(0); // 40 s on, no voice is left
      let after = 0;
      for (let i = stopFrame + 20 * SAMPLE_RATE; i < render.left.length; i++) {
        after = Math.max(after, Math.abs(render.left[i] as number), Math.abs(render.right[i] as number));
      }
      expect(after).toBeLessThanOrEqual(SILENT); // nothing more is heard
    }, 120_000);
  });

  it('on the densest hands-together library item without an Orchestra the voices stay below VOICE_HEADROOM_FRACTION of the cap (FR-008, R-6)', () => {
    const libraryDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public/library');
    const index = JSON.parse(fs.readFileSync(path.join(libraryDir, 'index.json'), 'utf8')) as {
      items: {
        id: string;
        file: string;
        facts: { staves: number; orchestra?: unknown; peakNotesPerSecond: number; durationSeconds: number };
      }[];
    };
    const [densest] = index.items
      .filter((item) => item.facts.staves >= 2 && !item.facts.orchestra)
      .sort((a, b) => b.facts.peakNotesPerSecond - a.facts.peakNotesPerSecond || a.id.localeCompare(b.id));
    expect(densest).toBeDefined();
    if (!densest) return;
    const render = renderPlayRun(densest.file, {
      seconds: densest.facts.durationSeconds + 12,
      accompaniment: true,
      metronomeVolume: 100,
      graded: 'all',
      guide: true,
      orchestraLevel: 100,
    });
    expect(render.guideChannel).not.toBeNull();
    expect(render.peakVoices).toBeGreaterThan(0);
    expect(render.peakVoices).toBeLessThan(VOICE_HEADROOM_FRACTION * VOICE_CAP);
  }, 300_000);
});

// US2 has no level code of its own (research R-4): the Guide voice follows the existing Orchestra level because its channel is in the
// schedule's `orchestraMask`. These are written with US1's tests because they cannot pass before the guide exists.
describe('the Orchestra level governs the Guide voice, offline (feature 020 US2)', () => {
  const unguided = melodyRun({ guide: false });

  it('at level 100 the Guide voice is plainly there, and at level 0 the output equals the unguided run within ORCHESTRA_SILENT_TOLERANCE_DBFS (SC-003)', () => {
    const full = melodyRun({ guide: true, level: 100 });
    const silent = melodyRun({ guide: true, level: 0 });
    expect(contribution(full, unguided, full.countInEndFrame, full.countInEndFrame + 10 * SAMPLE_RATE)).toBeGreaterThan(
      0.001,
    );
    expect(maxDifference(silent, unguided)).toBeLessThan(SILENT);
  }, 120_000);

  it('the onsets are the same at levels 0, 50 and 100', () => {
    const fullRender = melodyRun({ guide: true, level: 100 });
    const full = noteKeys(fullRender);
    expect(fullRender.notes.filter((n) => n.channel === guideOf(fullRender))).toHaveLength(2 * 29); // the guide's own on and off
    expect(noteKeys(melodyRun({ guide: true, level: 50 }))).toEqual(full);
    expect(noteKeys(melodyRun({ guide: true, level: 0 }))).toEqual(full);
  }, 120_000);

  it('a mid-note level change is heard within one render block and retriggers nothing (FR-011, SC-006)', () => {
    const steady = melodyRun({ guide: true, level: 100 });
    const onset = steady.noteOnFrames(guideOf(steady))[6] as number;
    const aligned = Math.ceil((onset + 0.3 * SAMPLE_RATE) / BLOCK) * BLOCK; // halfway through a quarter note
    const changed = melodyRun({
      guide: true,
      level: 100,
      beforeBlock: (frame, send) => {
        if (frame === aligned) send({ type: 'orchestraLevel', gain: 0 });
      },
    });

    expect(noteKeys(changed)).toEqual(noteKeys(steady)); // nothing retriggered, nothing added
    expect(maxDifference(changed, steady, 0, aligned)).toBe(0); // before the change the output is exactly the steady one's
    const before = contribution(steady, unguided, aligned - 480, aligned);
    expect(before).toBeGreaterThan(0.001); // the guide is sounding before the change
    // the synth eases a controller change in over a few milliseconds: within three blocks (8 ms) the guide is already much quieter,
    // and by SC-006's 100 ms what is left is its reverb tail, a small part of before
    const hundredMs = Math.round(0.1 * SAMPLE_RATE);
    expect(contribution(changed, unguided, aligned + 3 * BLOCK, aligned + 3 * BLOCK + 480)).toBeLessThan(0.5 * before);
    expect(contribution(changed, unguided, aligned + hundredMs, aligned + hundredMs + 480)).toBeLessThan(0.1 * before);
  }, 120_000);

  it('moving the level every render block for the whole run adds no late event, no dropped message and no extra note (SC-006)', () => {
    const steady = melodyRun({ guide: true, level: 100 });
    expect(steady.noteOnFrames(guideOf(steady))).toHaveLength(29); // there is a guide to sweep
    const swept = melodyRun({
      guide: true,
      level: 100,
      beforeBlock: (frame, send) => {
        const phase = ((frame / SAMPLE_RATE) % 2) / 2;
        send({ type: 'orchestraLevel', gain: phase < 0.5 ? phase * 2 : 2 - phase * 2 });
      },
    });
    expect(swept.lateEvents).toBe(steady.lateEvents);
    expect(swept.messages.some((m) => m.type === 'liveDropped' || m.type === 'status')).toBe(false);
    expect(noteKeys(swept)).toEqual(noteKeys(steady));
  }, 120_000);
});
