/**
 * Feature 019, FR-017 (analyze A2): the Orchestra follows the transport. `piano-and-oboe` (a two-staff piano and an oboe that
 * plays on the same beats a third above, at 100 quarter notes a minute, four bars of 4/4) is rendered through the real
 * score-player processor and SpessaSynth; what the synth is given and when is what is asserted.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { handleMessage } from '../../src/workers/score.worker.js';
import { renderListen, SAMPLE_RATE, type SynthNote } from './helpers/listen-render.js';

const FIXTURE = 'orchestra/piano-and-oboe.musicxml';
const TWIN = 'orchestra/piano-and-oboe-twin.musicxml';
const BLOCK = 128;
const BEAT = (60 / 100) * SAMPLE_RATE; // one quarter note at 100 qpm, in frames
const RIGHT_HAND_FROM_KEY = 60; // the left hand stays below middle C

const on = (notes: readonly SynthNote[], channel: number) =>
  notes.filter((n) => n.kind === 'on' && n.channel === channel);
const pianoRightHandOn = (notes: readonly SynthNote[], channel: number) =>
  on(notes, channel).filter((n) => n.key >= RIGHT_HAND_FROM_KEY);

describe('the Orchestra follows Listen transport (feature 019 FR-017)', () => {
  it('the score worker marks the Orchestra channel in the schedule orchestraMask', async () => {
    const bytes = new Uint8Array(fs.readFileSync(path.join(__dirname, '../fixtures/musicxml', FIXTURE)));
    const messages: any[] = [];
    await handleMessage(
      {
        data: { type: 'load', requestId: 1, fileName: 'piano-and-oboe.musicxml', bytes: bytes.buffer },
      } as MessageEvent,
      ((msg: unknown) => messages.push(msg)) as typeof postMessage,
    );
    const loaded = messages.find((m) => m.type === 'loaded');
    const channel = (loaded.fullTimeline.channels as { orchestra: boolean }[]).findIndex((c) => c.orchestra);
    expect(channel).toBeGreaterThanOrEqual(0);
    expect(loaded.schedule.orchestraMask).toBe(1 << channel);
  });

  it('a seek into the middle of a held oboe note sounds no oboe note until the next oboe onset', () => {
    const ppq = renderListen(FIXTURE, { seconds: 0.01 }).schedule.ppq;
    const seekTick = 5 * ppq; // one beat into bar 2, whose half notes start at beat 4 and 6
    const render = renderListen(FIXTURE, {
      seconds: 9,
      beforeBlock: (frame, send) => {
        if (frame === 0) {
          send({ type: 'seek', tick: seekTick });
          send({ type: 'play' });
        }
      },
    });
    const oboe = on(render.notes, render.orchestraChannel);
    expect(render.orchestraChannel).toBeGreaterThanOrEqual(0);
    // G5 (bar 2 beat 3), E5 E5 B4 B4, E5 (whole): the six oboe notes from there on - not the B5 that began before the seek
    expect(oboe.map((n) => n.key)).toEqual([79, 76, 76, 71, 71, 76]);
    expect(Math.abs((oboe[0] as SynthNote).frame - BEAT)).toBeLessThanOrEqual(BLOCK);
    // and it is the same frame as the right hand's note on that beat: nothing is early or late
    const piano = render.notes.find(
      (n) => n.kind === 'on' && n.channel !== render.orchestraChannel && n.key >= RIGHT_HAND_FROM_KEY,
    );
    expect((oboe[0] as SynthNote).frame).toBe(piano?.frame);
  });

  it('starting from bar 2 sounds the oboe exactly where the right hand of the file without the oboe sounds', () => {
    const ppq = renderListen(FIXTURE, { seconds: 0.01 }).schedule.ppq;
    const start = (frame: number, send: (m: { type: string; [k: string]: unknown }) => void) => {
      if (frame === 0) send({ type: 'play', fromTick: 4 * ppq });
    };
    const withOboe = renderListen(FIXTURE, { seconds: 9, beforeBlock: start });
    const twin = renderListen(TWIN, { seconds: 9, beforeBlock: start });
    expect(twin.orchestraChannel).toBe(-1);
    const twinPianoChannel = twin.notes.find((n) => n.kind === 'on')?.channel ?? -1;

    const oboeFrames = on(withOboe.notes, withOboe.orchestraChannel).map((n) => n.frame);
    const twinRightHand = pianoRightHandOn(twin.notes, twinPianoChannel).map((n) => n.frame);
    expect(oboeFrames).toHaveLength(7); // the two half notes of bar 2, then bars 3 and 4
    expect(oboeFrames).toEqual(twinRightHand);
    // the first note of the run is on the first frame, like the piano's
    expect(oboeFrames[0]).toBe(0);
  });

  it.each(['pause', 'stop'] as const)(
    '%s releases every sounding oboe note within one render block and starts none after it',
    (command) => {
      const stopAt = 1.0 * SAMPLE_RATE; // the oboe's F5 (beat 2) is sounding; its E5 has ended and its G5 has not started
      const stopFrame = Math.ceil(stopAt / BLOCK) * BLOCK;
      const render = renderListen(FIXTURE, {
        seconds: 3,
        beforeBlock: (frame, send) => {
          if (frame === 0) send({ type: 'play' });
          if (frame === stopFrame) send(command === 'pause' ? { type: 'pause' } : { type: 'stop', returnTick: 0 });
        },
      });
      const oboeOn = on(render.notes, render.orchestraChannel).filter((n) => n.frame < stopFrame);
      expect(oboeOn.length).toBeGreaterThan(0);
      const released = render.notes.filter(
        (n) =>
          n.kind === 'off' &&
          n.channel === render.orchestraChannel &&
          n.frame >= stopFrame &&
          n.frame <= stopFrame + BLOCK,
      );
      // every oboe note still held at the command gets its note-off at the command's block
      const stillHeld = oboeOn.filter(
        (n) =>
          !render.notes.some(
            (o) => o.kind === 'off' && o.channel === n.channel && o.key === n.key && o.frame < stopFrame,
          ),
      );
      expect(stillHeld.length).toBeGreaterThan(0);
      expect(released.map((n) => n.key).sort()).toEqual(stillHeld.map((n) => n.key).sort());
      // and no oboe note starts again
      expect(on(render.notes, render.orchestraChannel).filter((n) => n.frame > stopFrame)).toEqual([]);
    },
  );
});
