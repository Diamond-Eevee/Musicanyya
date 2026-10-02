/**
 * Feature 019 T056 (SC-003, FR-018, research R-11): *Morning Mood* rendered offline through the real score-player processor,
 * the real SpessaSynth and the shipped SoundFont, in Listen and in a Play run, at 50 %, 100 % and 150 % tempo. Every Orchestra
 * note-on is given to the synth in the same frame as the piano note-on it doubles (same pitch class: the Orchestra doubles at
 * pitch or in octaves), every Orchestra attack is played, and the voices in use stay below `VOICE_HEADROOM_FRACTION` of the
 * synth's voice cap, so voice stealing never has to choose between the piano and the Orchestra.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { VOICE_CAP } from 'spessasynth_core';
import { describe, expect, it } from 'vitest';
import { METRONOME_CHANNEL, VOICE_HEADROOM_FRACTION } from '../../src/core/defaults.js';
import { buildScore } from '../../src/core/musicxml/build.js';
import { readXml } from '../../src/core/musicxml/read.js';
import { renderListen, renderPlayRun, type SynthNote } from './helpers/listen-render.js';

const LIBRARY_FILE = 'repertoire/advanced/grieg-morning-mood.musicxml';
const FIXTURE = `../../../public/library/${LIBRARY_FILE}`; // renderListen reads below tests/fixtures/musicxml
const PIECE_SECONDS = 174; // 87 bars of 6/8 at a dotted quarter = 60 (the library index's durationSeconds)
const TEMPOS = [50, 100, 150];

const { score } = buildScore(
  readXml(fs.readFileSync(path.join(__dirname, '../../public/library', LIBRARY_FILE), 'utf8')).doc,
);
/** Orchestra attacks in the file: every Orchestra notehead that does not continue a tie. */
const ORCHESTRA_ATTACKS = score.parts
  .filter((p) => p.orchestra)
  .flatMap((p) => p.notes.filter((n) => !n.tie.stop)).length;

/** Orchestra note-ons with no piano note-on of the same pitch class in the same frame. */
function undoubled(notes: readonly SynthNote[], orchestraChannels: readonly number[]): SynthNote[] {
  const orchestra = new Set(orchestraChannels);
  const pianoAt = new Map<number, Set<number>>(); // frame -> pitch classes the piano starts there
  for (const n of notes) {
    if (n.kind !== 'on' || orchestra.has(n.channel) || n.channel === METRONOME_CHANNEL) continue;
    if (!pianoAt.has(n.frame)) pianoAt.set(n.frame, new Set());
    pianoAt.get(n.frame)?.add(n.key % 12);
  }
  return notes.filter((n) => n.kind === 'on' && orchestra.has(n.channel) && !pianoAt.get(n.frame)?.has(n.key % 12));
}

const orchestraOns = (notes: readonly SynthNote[], orchestraChannels: readonly number[]) =>
  notes.filter((n) => n.kind === 'on' && orchestraChannels.includes(n.channel));

describe('Morning Mood: the Orchestra sounds with the piano note it doubles (SC-003) and leaves voice headroom (FR-018)', () => {
  it('the item has five Orchestra parts with attacks to check', () => {
    expect(score.parts.filter((p) => p.orchestra).map((p) => p.name)).toEqual([
      'Flute',
      'Oboe',
      'Horns',
      'Strings',
      'Cellos',
    ]);
    expect(ORCHESTRA_ATTACKS).toBeGreaterThan(400);
  });

  it.each(TEMPOS)(
    'Listen at %i %%: every Orchestra note-on is in the frame of its piano note',
    (tempoPercent) => {
      const render = renderListen(FIXTURE, {
        seconds: PIECE_SECONDS / (tempoPercent / 100) + 4,
        tempoPercent,
        beforeBlock: (frame, send) => {
          if (frame === 0) send({ type: 'play' });
        },
      });
      expect(render.orchestraChannels).toHaveLength(5);
      expect(orchestraOns(render.notes, render.orchestraChannels)).toHaveLength(ORCHESTRA_ATTACKS);
      expect(undoubled(render.notes, render.orchestraChannels)).toEqual([]);
      expect(render.peakVoices).toBeGreaterThan(0);
      expect(render.peakVoices).toBeLessThan(VOICE_HEADROOM_FRACTION * VOICE_CAP);
    },
    120_000,
  );

  it.each(TEMPOS)(
    'a Play run at %i %%: every Orchestra note-on is in the frame of its piano note',
    (tempoPercent) => {
      const render = renderPlayRun(LIBRARY_FILE, {
        seconds: (PIECE_SECONDS + 2) / (tempoPercent / 100) + 4, // one bar of count-in first
        accompaniment: true,
        metronomeVolume: 100,
        tempoPercent,
      });
      expect(render.orchestraChannels).toHaveLength(5);
      expect(orchestraOns(render.notes, render.orchestraChannels)).toHaveLength(ORCHESTRA_ATTACKS);
      expect(undoubled(render.notes, render.orchestraChannels)).toEqual([]);
      expect(render.peakVoices).toBeLessThan(VOICE_HEADROOM_FRACTION * VOICE_CAP);
    },
    120_000,
  );
});
