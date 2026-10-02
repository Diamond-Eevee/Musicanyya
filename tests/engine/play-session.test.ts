/**
 * T097: `PlaySessionController` (T039) against the fakes, per research R-01 and contracts/play-run.md +
 * contracts/grading.md. Four things are under test:
 *
 *  - every MIDI message is recorded through `MidiClockMap`, carrying both the mapped `audioTimeSec` and the raw
 *    `timeStampMs` (R-04);
 *  - grading goes through the worker (`requestGrade`/`FakeGradeWorker`), never `gradePerformance` called inline;
 *  - the run reducer only ever advances on a `position` action - nothing else moves `countIn` -> `running`;
 *  - a finished run produces exactly one Grade, even if more frames are reported afterwards.
 */
import { describe, expect, it } from 'vitest';
import { type PlaySessionCallbacks, PlaySessionController } from '../../src/app/play-session.js';
import {
  GUIDE_PROGRAM,
  GUIDE_VELOCITY_SCALE,
  METRONOME_CHANNEL,
  METRONOME_KEY_BEAT,
  METRONOME_KEY_DOWNBEAT,
  METRONOME_VELOCITY_BEAT,
  METRONOME_VELOCITY_DOWNBEAT,
  METRONOME_VOLUME_MUTED,
  METRONOME_VOLUME_ON,
  ORCHESTRA_LEVEL_DEFAULT,
  PLAY_STRICTNESS_DEFAULT,
} from '../../src/core/defaults.js';
import { buildExpectedNotes } from '../../src/core/grade/expected.js';
import { gradePerformance } from '../../src/core/grade/grade.js';
import type { Grade, StoredPerformance } from '../../src/core/grade/types.js';
import type { PlayEffect, RunSettings } from '../../src/core/play/types.js';
import type { HandSelection } from '../../src/core/practice/types.js';
import { EVENT_KIND, type ScheduleMessage } from '../../src/core/schedule/compile.js';
import { compilePlaySchedule } from '../../src/core/schedule/play-schedule.js';
import { loadFixture } from '../core/practice/helpers.js';
import { FakeAudioEngine } from '../fakes/fake-audio-engine.js';
import { FakeMidiInput } from '../fakes/fake-midi-input.js';
import { FakePerformanceStore } from '../fakes/fake-performance-store.js';

const BOTH: HandSelection = { preset: 'both', partIndex: 0, staves: [1] };

/** Mirrors tests/engine/workers/grade-worker.test.ts's own double: posted messages are captured, replies are
 *  delivered by calling `reply()`. */
class FakeGradeWorker {
  posted: any[] = [];
  private listeners = new Set<(event: MessageEvent) => void>();

  postMessage(msg: unknown) {
    this.posted.push(msg);
  }
  addEventListener(_type: 'message', listener: (event: MessageEvent) => void) {
    this.listeners.add(listener);
  }
  removeEventListener(_type: 'message', listener: (event: MessageEvent) => void) {
    this.listeners.delete(listener);
  }
  reply(data: any) {
    for (const l of [...this.listeners]) l({ data } as MessageEvent);
  }
}

function settings(overrides: Partial<RunSettings> = {}): RunSettings {
  return {
    range: null,
    tempoPercent: 100,
    selection: BOTH,
    strictness: PLAY_STRICTNESS_DEFAULT,
    countInMeasures: 1,
    metronomeMuted: false,
    accompaniment: true,
    ...overrides,
  };
}

/** Wires a controller against fresh fakes, ready to `start()`. `nowRef` lets a test advance the injected clock. */
function setup(gradeTimeoutMs = 5000) {
  const { score, timeline } = loadFixture('eight-measure-melody.musicxml');
  const audioEngine = new FakeAudioEngine();
  const midiInput = new FakeMidiInput();
  const gradeWorker = new FakeGradeWorker();
  const performanceStore = new FakePerformanceStore();
  const effects: PlayEffect[] = [];
  const grades: Grade[] = [];
  const gradeFailures: { reason: 'timeout' | 'error'; message?: string }[] = [];
  const stored: (StoredPerformance | null)[] = [];
  const kept: boolean[] = [];
  const callbacks: PlaySessionCallbacks = {
    onEffect: (e) => effects.push(e),
    onGraded: (g) => grades.push(g),
    onGradeFailed: (reason, message) => gradeFailures.push({ reason, message }),
    onStored: (performance, wasKept) => {
      stored.push(performance);
      kept.push(wasKept);
    },
  };

  const nowRef = { value: 1000 };
  audioEngine.currentClockPair = { contextTime: 1, performanceTime: 1000 };

  const controller = new PlaySessionController(
    audioEngine,
    midiInput,
    gradeWorker,
    performanceStore,
    callbacks,
    gradeTimeoutMs,
    () => nowRef.value,
    () => 'test-run-id',
    () => '2026-01-01T00:00:00.000Z',
  );

  return {
    score,
    timeline,
    audioEngine,
    midiInput,
    gradeWorker,
    performanceStore,
    effects,
    grades,
    gradeFailures,
    stored,
    kept,
    nowRef,
    controller,
  };
}

describe('PlaySessionController (T039/T097)', () => {
  it('starts a run in countIn, loads and plays the schedule, and stays in countIn until a position report crosses the count-in boundary', () => {
    const { score, timeline, audioEngine, controller } = setup();

    controller.start({ scoreId: null, score, timeline, measures: score.measures, range: null, settings: settings() });

    expect(audioEngine.commands).toContain('load');
    expect(audioEngine.commands).toContain('play');
    const run = controller.getRun();
    expect(run?.phase).toBe('countIn');
    const countInTicks = run!.tickMap.countInTicks;
    expect(countInTicks).toBeGreaterThan(0);

    // Nothing but a position report may move the phase - not time passing, not a MIDI message.
    audioEngine.currentPosition = { audibleTick: countInTicks - 1, playing: true };
    controller.reportPosition(2000);
    expect(controller.getRun()?.phase).toBe('countIn');
  });

  it('a position report at or past the count-in boundary moves the run to running (runStarted effect)', () => {
    const { score, timeline, audioEngine, effects, controller } = setup();
    controller.start({ scoreId: null, score, timeline, measures: score.measures, range: null, settings: settings() });
    const countInTicks = controller.getRun()!.tickMap.countInTicks;

    audioEngine.currentPosition = { audibleTick: countInTicks, playing: true };
    controller.reportPosition(2500);

    expect(controller.getRun()?.phase).toBe('running');
    expect(effects).toContainEqual({ type: 'runStarted' });
  });

  it('records a MIDI message through the clock map, with both the mapped audioTimeSec and the raw timeStampMs', () => {
    const { score, timeline, audioEngine, midiInput, controller } = setup();
    controller.start({ scoreId: null, score, timeline, measures: score.measures, range: null, settings: settings() });
    const countInTicks = controller.getRun()!.tickMap.countInTicks;
    audioEngine.currentPosition = { audibleTick: countInTicks, playing: true };
    controller.reportPosition(2500);

    audioEngine.currentClockPair = { contextTime: 5, performanceTime: 2000 };
    midiInput.fire({ type: 'noteOn', deviceId: 'kb-1', key: 60, velocity: 70, timeStampMs: 2500 });

    const messages = controller.getRun()!.log.messages;
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      kind: 'noteOn',
      key: 60,
      velocity: 70,
      audioTimeSec: 5.5, // 5 + (2500 - 2000) / 1000
      timeStampMs: 2500,
      deviceId: 'kb-1',
    });
    // The musician's own note sounds immediately, through the live channel (FR-006).
    expect(audioEngine.commands).toContain('liveNoteOn:60,70');

    midiInput.fire({ type: 'noteOff', deviceId: 'kb-1', key: 60, timeStampMs: 2600 });
    const messages2 = controller.getRun()!.log.messages;
    expect(messages2).toHaveLength(2);
    expect(messages2[1]).toMatchObject({ kind: 'noteOff', key: 60, audioTimeSec: 5.6, timeStampMs: 2600 });
  });

  it('grades through the worker (never inline) and a finished run produces exactly one Grade', async () => {
    const { score, timeline, audioEngine, gradeWorker, grades, controller } = setup();
    controller.start({ scoreId: null, score, timeline, measures: score.measures, range: null, settings: settings() });
    const countInTicks = controller.getRun()!.tickMap.countInTicks;
    audioEngine.currentPosition = { audibleTick: countInTicks, playing: true };
    controller.reportPosition(2000);
    expect(controller.getRun()?.phase).toBe('running');

    // The worklet reached its own schedule end; the controller must not grade yet - it still owes the last
    // expected note's late claim window (R-16).
    audioEngine.fireEvent({ type: 'ended' });
    controller.reportPosition(2010); // barely any time has passed - still within the tail
    expect(gradeWorker.posted).toHaveLength(0);
    expect(controller.getRun()?.phase).toBe('running');

    // Enough wall-clock time has now passed for the tail to elapse.
    controller.reportPosition(60000);
    expect(controller.getRun()?.phase).toBe('finished');
    expect(gradeWorker.posted).toHaveLength(1);
    expect(gradeWorker.posted[0].type).toBe('grade');
    const { requestId, input } = gradeWorker.posted[0];

    // The GradeInput the controller assembled is exactly what gradePerformance (the pure core function this
    // controller never calls itself) would need to reproduce the same Grade.
    const expectedGrade = gradePerformance(input);
    gradeWorker.reply({ type: 'graded', requestId, grade: expectedGrade });
    await controller.waitForGrade();

    expect(grades).toEqual([expectedGrade]);
    expect(input.complete).toBe(true);

    // Further frames after the run has finished must not post another grade request.
    controller.reportPosition(70000);
    controller.reportPosition(80000);
    expect(gradeWorker.posted).toHaveLength(1);
    expect(grades).toHaveLength(1);
  });

  it('stop() ends the run with an incomplete Grade request, through the worker', async () => {
    const { score, timeline, audioEngine, gradeWorker, grades, controller } = setup();
    controller.start({ scoreId: null, score, timeline, measures: score.measures, range: null, settings: settings() });
    const countInTicks = controller.getRun()!.tickMap.countInTicks;
    audioEngine.currentPosition = { audibleTick: countInTicks, playing: true };
    controller.reportPosition(2000);

    controller.stop();

    expect(controller.getRun()?.phase).toBe('stopped');
    expect(audioEngine.commands).toContain('stop');
    expect(gradeWorker.posted).toHaveLength(1);
    const { requestId, input } = gradeWorker.posted[0];
    expect(input.complete).toBe(false);

    const grade = gradePerformance(input);
    gradeWorker.reply({ type: 'graded', requestId, grade });
    await controller.waitForGrade();
    expect(grades).toEqual([grade]);
  });

  it('a worker timeout is reported as a grade failure, not a hang or a thrown error', async () => {
    const { score, timeline, audioEngine, gradeFailures, controller } = setup(20);
    controller.start({ scoreId: null, score, timeline, measures: score.measures, range: null, settings: settings() });
    const countInTicks = controller.getRun()!.tickMap.countInTicks;
    audioEngine.currentPosition = { audibleTick: countInTicks, playing: true };
    controller.reportPosition(2000);

    controller.stop(); // never replied to by the FakeGradeWorker in this test - simulates a worker that hangs
    await controller.waitForGrade();

    expect(gradeFailures).toEqual([{ reason: 'timeout', message: undefined }]);
  });

  it('a key pressed during the run only sounds: no effect marks the Score before the Grade (FR-027, owner review 2026-09-25)', () => {
    const { score, timeline, audioEngine, midiInput, effects, controller } = setup();
    controller.start({ scoreId: null, score, timeline, measures: score.measures, range: null, settings: settings() });
    const countInTicks = controller.getRun()!.tickMap.countInTicks;
    audioEngine.currentPosition = { audibleTick: countInTicks, playing: true };
    controller.reportPosition(2500); // the cursor is now exactly at the first written note (C4, key 60)
    effects.length = 0;

    midiInput.fire({ type: 'noteOn', deviceId: 'kb-1', key: 60, velocity: 70, timeStampMs: 2500 }); // the written note
    midiInput.fire({ type: 'noteOff', deviceId: 'kb-1', key: 60, timeStampMs: 2550 });
    midiInput.fire({ type: 'noteOn', deviceId: 'kb-1', key: 61, velocity: 70, timeStampMs: 2600 }); // C#4, not written

    // each press and release is heard through the live channel, and that is all the run shows of it
    expect(effects.map((e) => e.type)).toEqual(['soundInput', 'soundInput', 'soundInput']);
    expect(effects).toEqual([
      { type: 'soundInput', key: 60, velocity: 70, on: true },
      { type: 'soundInput', key: 60, velocity: 0, on: false },
      { type: 'soundInput', key: 61, velocity: 70, on: true },
    ]);
    expect(controller.getRun()?.phase).toBe('running'); // recorded for the Grade, not graded yet
  });

  it('T098: engine suspended with deviceChanged raises audioLost, stops the run, and marks Grade unreliable', async () => {
    const { score, timeline, audioEngine, controller, gradeWorker } = setup();
    controller.start({ scoreId: null, score, timeline, measures: score.measures, range: null, settings: settings() });
    controller.reportPosition(2000);

    audioEngine.fireEvent({ type: 'state', state: { kind: 'suspended', reason: 'deviceChanged' } });

    const run = controller.getRun();
    expect(run?.phase).toBe('aborted');

    const requestId = gradeWorker.posted[0]!.requestId;
    const input = gradeWorker.posted[0]!.input;
    expect(input.complete).toBe(false);
    expect(input.reliability.filter((r) => r.kind === 'audioLost')).toHaveLength(1);
    gradeWorker.reply({ type: 'graded', requestId, grade: gradePerformance(input) });
    await controller.waitForGrade();
  });

  it('T053: engine dropout stamps an audio dropout with the current audio time', () => {
    const { score, timeline, audioEngine, controller } = setup();
    controller.start({ scoreId: null, score, timeline, measures: score.measures, range: null, settings: settings() });
    controller.reportPosition(2000);

    audioEngine.fireEvent({ type: 'dropout', total: 1 });

    const run = controller.getRun();
    expect(run?.reliability.filter((r) => r.kind === 'audioDropout')).toHaveLength(1);
  });

  it('T053: deviceLost and availability changes stamp device loss/return with the current audio time', () => {
    const { score, timeline, midiInput, controller } = setup();
    controller.start({ scoreId: null, score, timeline, measures: score.measures, range: null, settings: settings() });
    controller.reportPosition(2000);

    midiInput.fire({ type: 'deviceLost', deviceId: 'kb-1', heldKeys: [] });

    const run = controller.getRun();
    const losses = run?.reliability.filter((r) => r.kind === 'midiDeviceLost') ?? [];
    expect(losses).toHaveLength(1);
  });

  it('T074: a finished run for a stored Score is kept, with the log rebased to run-relative time (research R-20)', async () => {
    const { score, timeline, audioEngine, midiInput, gradeWorker, performanceStore, controller } = setup();
    controller.start({
      scoreId: 'score-hash-1',
      score,
      timeline,
      measures: score.measures,
      range: null,
      settings: settings(),
    });
    const countInTicks = controller.getRun()!.tickMap.countInTicks;
    audioEngine.currentPosition = { audibleTick: countInTicks, playing: true };
    controller.reportPosition(2000);

    audioEngine.currentClockPair = { contextTime: 5, performanceTime: 2000 };
    midiInput.fire({ type: 'noteOn', deviceId: 'kb-1', key: 60, velocity: 70, timeStampMs: 2500 });

    audioEngine.fireEvent({ type: 'ended' });
    controller.reportPosition(60000);
    const { requestId, input } = gradeWorker.posted[0];
    const grade = gradePerformance(input);
    gradeWorker.reply({ type: 'graded', requestId, grade });
    await controller.waitForGrade();

    expect(performanceStore.records.size).toBe(1);
    const stored = [...performanceStore.records.values()][0]!;
    expect(stored.runId).toBe(controller.getRun()!.runId);
    expect(stored.scoreId).toBe('score-hash-1');
    expect(stored.settings).toEqual(settings());
    expect(stored.summary).toEqual(grade.summary);
    expect(stored.schema).toBe(1);
    expect(stored.appVersion.length).toBeGreaterThan(0);

    const startAudioTimeSec = controller.getRun()!.startAudioTimeSec;
    expect(stored.log.messages).toHaveLength(input.log.messages.length);
    stored.log.messages.forEach((message, i) => {
      expect(message.audioTimeSec).toBeCloseTo(input.log.messages[i]!.audioTimeSec - startAudioTimeSec, 9);
    });
  });

  it('feature 013 R-6: a run that reaches the end stores complete: true, and onStored reports it', async () => {
    const { score, timeline, audioEngine, gradeWorker, stored, kept, controller } = setup();
    controller.start({
      scoreId: 'score-hash-1',
      score,
      timeline,
      measures: score.measures,
      range: null,
      settings: settings(),
    });
    const countInTicks = controller.getRun()!.tickMap.countInTicks;
    audioEngine.currentPosition = { audibleTick: countInTicks, playing: true };
    controller.reportPosition(2000);
    audioEngine.fireEvent({ type: 'ended' });
    controller.reportPosition(60000);
    const { requestId, input } = gradeWorker.posted[0];
    gradeWorker.reply({ type: 'graded', requestId, grade: gradePerformance(input) });
    await controller.waitForGrade();

    expect(stored).toHaveLength(1);
    expect(stored[0]?.complete).toBe(true);
    expect(stored[0]?.runId).toBe(controller.getRun()!.runId);
    expect(kept).toEqual([true]);
  });

  it('feature 013 R-6: stop() stores complete: false, and onStored reports it', async () => {
    const { score, timeline, audioEngine, gradeWorker, stored, controller } = setup();
    controller.start({
      scoreId: 'score-hash-1',
      score,
      timeline,
      measures: score.measures,
      range: null,
      settings: settings(),
    });
    const countInTicks = controller.getRun()!.tickMap.countInTicks;
    audioEngine.currentPosition = { audibleTick: countInTicks, playing: true };
    controller.reportPosition(2000);

    controller.stop();
    const { requestId, input } = gradeWorker.posted[0];
    gradeWorker.reply({ type: 'graded', requestId, grade: gradePerformance(input) });
    await controller.waitForGrade();

    expect(stored).toHaveLength(1);
    expect(stored[0]?.complete).toBe(false);
  });

  it('feature 013: onStored reports null when the run has no Score identity (no scoreId), nothing kept', async () => {
    const { score, timeline, audioEngine, gradeWorker, stored, kept, controller } = setup();
    controller.start({ scoreId: null, score, timeline, measures: score.measures, range: null, settings: settings() });
    const countInTicks = controller.getRun()!.tickMap.countInTicks;
    audioEngine.currentPosition = { audibleTick: countInTicks, playing: true };
    controller.reportPosition(2000);
    audioEngine.fireEvent({ type: 'ended' });
    controller.reportPosition(60000);
    const { requestId, input } = gradeWorker.posted[0];
    gradeWorker.reply({ type: 'graded', requestId, grade: gradePerformance(input) });
    await controller.waitForGrade();

    expect(stored).toEqual([null]);
    expect(kept).toEqual([false]);
  });

  it('T074: a Score that was never stored (scoreId null) keeps no attempt and raises no notice', async () => {
    const { score, timeline, audioEngine, gradeWorker, performanceStore, effects, controller } = setup();
    controller.start({ scoreId: null, score, timeline, measures: score.measures, range: null, settings: settings() });
    const countInTicks = controller.getRun()!.tickMap.countInTicks;
    audioEngine.currentPosition = { audibleTick: countInTicks, playing: true };
    controller.reportPosition(2000);
    audioEngine.fireEvent({ type: 'ended' });
    controller.reportPosition(60000);
    const { requestId, input } = gradeWorker.posted[0];
    gradeWorker.reply({ type: 'graded', requestId, grade: gradePerformance(input) });
    await controller.waitForGrade();

    expect(performanceStore.records.size).toBe(0);
    expect(effects.some((e) => e.type === 'notice' && e.code === 'playAttemptNotStored')).toBe(false);
  });

  it('feature 013 T095 (owner decision A): a storage failure still reports the finished run to onStored, marked not kept, so the result is recorded without an attempt', async () => {
    const { score, timeline, audioEngine, gradeWorker, performanceStore, stored, kept, controller } = setup();
    performanceStore.failNextPut = true;
    controller.start({
      scoreId: 'score-hash-1',
      score,
      timeline,
      measures: score.measures,
      range: null,
      settings: settings(),
    });
    const countInTicks = controller.getRun()?.tickMap.countInTicks ?? 0;
    audioEngine.currentPosition = { audibleTick: countInTicks, playing: true };
    controller.reportPosition(2000);
    audioEngine.fireEvent({ type: 'ended' });
    controller.reportPosition(60000);
    const { requestId, input } = gradeWorker.posted[0];
    gradeWorker.reply({ type: 'graded', requestId, grade: gradePerformance(input) });
    await controller.waitForGrade();

    expect(performanceStore.records.size).toBe(0);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.scoreId).toBe('score-hash-1');
    expect(stored[0]?.runId).toBe(controller.getRun()?.runId);
    expect(stored[0]?.complete).toBe(true);
    expect(kept).toEqual([false]);
  });

  it('T074: a storage failure still shows the Grade, with a non-blocking notice that the attempt was not kept', async () => {
    const { score, timeline, audioEngine, gradeWorker, performanceStore, grades, effects, controller } = setup();
    performanceStore.failNextPut = true;
    controller.start({
      scoreId: 'score-hash-1',
      score,
      timeline,
      measures: score.measures,
      range: null,
      settings: settings(),
    });
    const countInTicks = controller.getRun()!.tickMap.countInTicks;
    audioEngine.currentPosition = { audibleTick: countInTicks, playing: true };
    controller.reportPosition(2000);
    audioEngine.fireEvent({ type: 'ended' });
    controller.reportPosition(60000);
    const { requestId, input } = gradeWorker.posted[0];
    const grade = gradePerformance(input);
    gradeWorker.reply({ type: 'graded', requestId, grade });
    await controller.waitForGrade();

    expect(grades).toEqual([grade]);
    expect(performanceStore.records.size).toBe(0);
    expect(effects).toContainEqual({ type: 'notice', code: 'playAttemptNotStored' });
  });

  // 012 FR-018: the run's tempo drives the sound, not only the grading windows. The worklet keeps its tempo factor
  // across schedules (whatever Listen or Practice last set), and a run's schedule is compiled at the written tempo, so
  // without this the run played at the Listen tempo while grading used the Play setup's tempo.
  describe("the run's tempo at the start of a run (012 FR-018)", () => {
    const tempoCommands = (commands: readonly string[]) => commands.filter((c) => c.startsWith('setTempoPercent:'));

    it("a run at 200 % sets the engine's tempo to 200 %, after the schedule is loaded and before play", () => {
      const { score, timeline, audioEngine, controller } = setup();
      controller.start({
        scoreId: null,
        score,
        timeline,
        measures: score.measures,
        range: null,
        settings: settings({ tempoPercent: 200 }),
      });
      expect(tempoCommands(audioEngine.commands)).toEqual(['setTempoPercent:200']);
      const tempoAt = audioEngine.commands.indexOf('setTempoPercent:200');
      expect(tempoAt).toBeGreaterThan(audioEngine.commands.indexOf('load'));
      expect(tempoAt).toBeLessThan(audioEngine.commands.indexOf('play'));
    });

    it('a run at the written tempo sets 100 % explicitly, so a faster Listen tempo (or an earlier run) cannot carry over', () => {
      const { score, timeline, audioEngine, controller } = setup();
      const options = { scoreId: null, score, timeline, measures: score.measures, range: null };
      audioEngine.setTempoPercent(200); // what the Listen transport last gave the engine
      controller.start({ ...options, settings: settings({ tempoPercent: 100 }) });

      expect(tempoCommands(audioEngine.commands)).toEqual(['setTempoPercent:200', 'setTempoPercent:100']);
      const tempoAt = audioEngine.commands.lastIndexOf('setTempoPercent:100');
      expect(tempoAt).toBeGreaterThan(audioEngine.commands.lastIndexOf('load'));
      expect(tempoAt).toBeLessThan(audioEngine.commands.lastIndexOf('play'));
    });
  });

  // 009 research R-02: a muted Metronome must not stay muted on the next run - the worklet keeps channel volumes across
  // schedules, so every start sets the Metronome channel volume explicitly, after the schedule is loaded.
  describe('the Metronome channel volume at the start of a run (009 R-02, FR-013)', () => {
    const volumeCommands = (commands: readonly string[]) => commands.filter((c) => c.startsWith('setChannelVolume:'));

    it('a run started muted sets the Metronome channel volume to its muted level, after the schedule is loaded', () => {
      const { score, timeline, audioEngine, controller } = setup();
      controller.start({
        scoreId: null,
        score,
        timeline,
        measures: score.measures,
        range: null,
        settings: settings({ metronomeMuted: true }),
      });
      expect(volumeCommands(audioEngine.commands)).toEqual([
        `setChannelVolume:${METRONOME_CHANNEL},${METRONOME_VOLUME_MUTED}`,
      ]);
      expect(
        audioEngine.commands.indexOf(`setChannelVolume:${METRONOME_CHANNEL},${METRONOME_VOLUME_MUTED}`),
      ).toBeGreaterThan(audioEngine.commands.indexOf('load'));
    });

    it('a run started unmuted sets it to full (100 on the 0..100 scale of the port, not 1), after load and before play, so a previous muted run cannot carry over', () => {
      const { score, timeline, audioEngine, controller } = setup();
      const options = { scoreId: null, score, timeline, measures: score.measures, range: null };
      controller.start({ ...options, settings: settings({ metronomeMuted: true }) });
      controller.start({ ...options, settings: settings({ metronomeMuted: false }) });

      expect(volumeCommands(audioEngine.commands)).toEqual([
        `setChannelVolume:${METRONOME_CHANNEL},${METRONOME_VOLUME_MUTED}`,
        `setChannelVolume:${METRONOME_CHANNEL},${METRONOME_VOLUME_ON}`,
      ]);
      const second = audioEngine.commands.lastIndexOf(`setChannelVolume:${METRONOME_CHANNEL},${METRONOME_VOLUME_ON}`);
      const secondLoad = audioEngine.commands.lastIndexOf('load');
      const secondPlay = audioEngine.commands.lastIndexOf('play');
      expect(secondLoad).toBeLessThan(second);
      expect(second).toBeLessThan(secondPlay);
    });
  });

  // Feature 019 (mixer-levels.md sections 3 and 5, play-run 2.2.0): the click channel's level is the musician's
  // Metronome level, set when the schedule loads, again on every change during the run, and again when sound comes back.
  describe('the Metronome level (feature 019, FR-003 to FR-005, FR-008)', () => {
    const channelVolumes = (commands: readonly string[]) => commands.filter((c) => c.startsWith('setChannelVolume:'));
    const click = (level: number) => `setChannelVolume:${METRONOME_CHANNEL},${level}`;
    const startRun = (level: number, overrides: Partial<RunSettings> = {}) => {
      const fixture = setup();
      const { score, timeline, controller } = fixture;
      controller.setMetronomeLevel(level);
      controller.start({
        scoreId: null,
        score,
        timeline,
        measures: score.measures,
        range: null,
        settings: settings(overrides),
      });
      return fixture;
    };

    it('loading the run schedule sets the click channel to the stored level, after load and before play', () => {
      const { audioEngine } = startRun(40);
      expect(channelVolumes(audioEngine.commands)).toEqual([click(40)]);
      const at = audioEngine.commands.indexOf(click(40));
      expect(at).toBeGreaterThan(audioEngine.commands.indexOf('load'));
      expect(at).toBeLessThan(audioEngine.commands.indexOf('play'));
    });

    it('a level never set is the default, 100', () => {
      const fixture = setup();
      const { score, timeline, audioEngine, controller } = fixture;
      controller.start({ scoreId: null, score, timeline, measures: score.measures, range: null, settings: settings() });
      expect(channelVolumes(audioEngine.commands)).toEqual([click(METRONOME_VOLUME_ON)]);
    });

    it('a change during the count-in sets only the click channel, once, and the run goes on', () => {
      const { audioEngine, controller } = startRun(100);
      expect(controller.getRun()?.phase).toBe('countIn');
      audioEngine.commands.length = 0;

      controller.setMetronomeLevel(30);

      expect(audioEngine.commands).toEqual([click(30)]); // no stop, no load, no other channel
      const countInTicks = controller.getRun()?.tickMap.countInTicks ?? 0;
      audioEngine.currentPosition = { audibleTick: countInTicks, playing: true };
      controller.reportPosition(2500);
      expect(controller.getRun()?.phase).toBe('running'); // the count-in ended and the run advanced across the change
      expect(audioEngine.commands).toEqual([click(30)]); // still nothing else was sent
    });

    it('a change during the run sets only the click channel, once, and the run keeps advancing', () => {
      const { audioEngine, controller } = startRun(100);
      const countInTicks = controller.getRun()?.tickMap.countInTicks ?? 0;
      audioEngine.currentPosition = { audibleTick: countInTicks + 10, playing: true };
      controller.reportPosition(2500);
      expect(controller.getRun()?.phase).toBe('running');
      audioEngine.commands.length = 0;

      controller.setMetronomeLevel(70);
      controller.setMetronomeLevel(70); // the same value again is not a change
      controller.setMetronomeLevel(55);

      expect(audioEngine.commands).toEqual([click(70), click(55)]);
      audioEngine.currentPosition = { audibleTick: countInTicks + 400, playing: true };
      controller.reportPosition(3000);
      expect(controller.getRun()?.phase).toBe('running');
      expect(controller.getRun()?.positionRunTick).toBeGreaterThan(countInTicks + 10);
      expect(audioEngine.commands).toEqual([click(70), click(55)]);
    });

    it('a muted click stays silent at any level, and un-muting after a level change uses the new level', () => {
      const { audioEngine, controller } = startRun(100, { metronomeMuted: true });
      expect(channelVolumes(audioEngine.commands)).toEqual([click(METRONOME_VOLUME_MUTED)]);
      audioEngine.commands.length = 0;

      controller.setMetronomeLevel(30);
      expect(audioEngine.commands).toEqual([click(METRONOME_VOLUME_MUTED)]);

      controller.setMetronomeMuted(false);
      expect(audioEngine.commands.at(-1)).toBe(click(30));
      controller.setMetronomeMuted(true);
      expect(audioEngine.commands.at(-1)).toBe(click(METRONOME_VOLUME_MUTED));
    });

    it('with no run in progress a change is only held: nothing is sent, and the next run uses it', () => {
      const fixture = setup();
      const { score, timeline, audioEngine, controller } = fixture;
      controller.setMetronomeLevel(20);
      expect(channelVolumes(audioEngine.commands)).toEqual([]);
      controller.start({ scoreId: null, score, timeline, measures: score.measures, range: null, settings: settings() });
      expect(channelVolumes(audioEngine.commands)).toEqual([click(20)]);
    });

    it('when sound comes back after a device change the click level is set again - never left at full level', () => {
      const { audioEngine, controller } = startRun(35);
      audioEngine.commands.length = 0;

      audioEngine.fireEvent({ type: 'state', state: { kind: 'suspended', reason: 'deviceChanged' } });
      audioEngine.fireEvent({ type: 'state', state: { kind: 'ready' } });

      expect(channelVolumes(audioEngine.commands)).toEqual([click(35)]);
      expect(controller.getRun()?.phase).toBe('aborted'); // the existing rule (FR-046) is unchanged
    });

    it('a ready report with no run at all sends nothing', () => {
      const { audioEngine } = setup();
      audioEngine.fireEvent({ type: 'state', state: { kind: 'ready' } });
      expect(channelVolumes(audioEngine.commands)).toEqual([]);
    });
  });
});

// Feature 020, US1 (guide-voice.md sections 2 and 4): a live run on a Score without an Orchestra plays the musician's own notes as
// the Guide voice, and the Grade, the expected notes and the Performance log do not know about it.
describe('the Guide voice in a live run (feature 020 US1, FR-001, FR-006, SC-004)', () => {
  const noteOnsOn = (schedule: ScheduleMessage, channel: number): number[] => {
    const keys: number[] = [];
    for (let i = 0; i < schedule.eventKind.length; i++) {
      if (schedule.eventKind[i] === EVENT_KIND.noteOn && schedule.eventChannel[i] === channel) {
        keys.push(schedule.eventData1[i] as number);
      }
    }
    return keys;
  };
  const maskChannels = (schedule: ScheduleMessage): number[] =>
    Array.from({ length: 16 }, (_, c) => c).filter((c) => ((schedule.orchestraMask ?? 0) >> c) & 1);

  /** One whole run, the Orchestra level set the way the app does it (on the engine), a right and a wrong key played, to its Grade input. */
  function playRun(orchestraLevel: number) {
    const fixture = setup();
    const { score, timeline, audioEngine, midiInput, gradeWorker, controller } = fixture;
    audioEngine.setOrchestraLevel(orchestraLevel);
    controller.start({ scoreId: null, score, timeline, measures: score.measures, range: null, settings: settings() });
    const countInTicks = controller.getRun()?.tickMap.countInTicks ?? 0;
    audioEngine.currentPosition = { audibleTick: countInTicks, playing: true };
    controller.reportPosition(2000);
    midiInput.fire({ type: 'noteOn', deviceId: 'kb-1', key: 60, velocity: 70, timeStampMs: 2500 }); // C4, written
    midiInput.fire({ type: 'noteOff', deviceId: 'kb-1', key: 60, timeStampMs: 2600 });
    midiInput.fire({ type: 'noteOn', deviceId: 'kb-1', key: 61, velocity: 70, timeStampMs: 3000 }); // C#4, not written
    midiInput.fire({ type: 'noteOff', deviceId: 'kb-1', key: 61, timeStampMs: 3100 });
    audioEngine.fireEvent({ type: 'ended' });
    controller.reportPosition(2010);
    controller.reportPosition(60000);
    const input = gradeWorker.posted[0]?.input;
    return { ...fixture, input, schedule: audioEngine.loaded[0] as ScheduleMessage };
  }

  it('start() loads a schedule whose Orchestra mask holds a channel that carries the graded notes, in the Guide voice program', () => {
    const { score, audioEngine, schedule } = playRun(ORCHESTRA_LEVEL_DEFAULT);
    expect(audioEngine.loaded).toHaveLength(1);
    const channels = maskChannels(schedule);
    expect(channels).toHaveLength(1); // the Score has no Orchestra, so the only mask channel is the guide
    const guide = channels[0] as number;
    expect(noteOnsOn(schedule, guide)).toHaveLength(score.parts[0]?.notes.length ?? -1); // every note of the melody is graded
    expect(noteOnsOn(schedule, 0)).toEqual([]); // and none of them is on the piano channel any more
    expect(schedule.channelSetup[guide * 4 + 1]).toBe(GUIDE_PROGRAM);
  });

  it('the guide note velocities are the written ones scaled by GUIDE_VELOCITY_SCALE', () => {
    const { timeline, schedule } = playRun(ORCHESTRA_LEVEL_DEFAULT);
    const guide = maskChannels(schedule)[0] as number;
    const scaled = new Set(timeline.events.map((ev) => Math.max(1, Math.round(ev.velocity * GUIDE_VELOCITY_SCALE))));
    let guideNotes = 0;
    for (let i = 0; i < schedule.eventKind.length; i++) {
      if (schedule.eventKind[i] === EVENT_KIND.noteOn && schedule.eventChannel[i] === guide) {
        guideNotes++;
        expect(scaled.has(schedule.eventData2[i] as number)).toBe(true);
      }
    }
    expect(guideNotes).toBeGreaterThan(0);
  });

  it.each([0, ORCHESTRA_LEVEL_DEFAULT, 100])(
    'a recorded log gives the same Grade input and Grade against the guided schedule as against an unguided one, at Orchestra level %i',
    (level) => {
      const { score, timeline, audioEngine, gradeWorker, input } = playRun(level);
      expect(audioEngine.commands).toContain(`setOrchestraLevel:${level}`); // the level reached the engine, not the grader
      expect(gradeWorker.posted).toHaveLength(1);

      // the same run compiled without the guide: only the schedule differs, and the grader reads the tempo map and tick map of it
      const gradedNoteIds = new Set(buildExpectedNotes(score, timeline, BOTH, null).flatMap((n) => n.noteIds));
      const unguided = compilePlaySchedule(timeline, score.measures, {
        range: null,
        gradedNoteIds,
        accompaniment: true,
        countInMeasures: 1,
        tempoPercent: 100,
        metronome: {
          beatKey: METRONOME_KEY_BEAT,
          downbeatKey: METRONOME_KEY_DOWNBEAT,
          beatVelocity: METRONOME_VELOCITY_BEAT,
          downbeatVelocity: METRONOME_VELOCITY_DOWNBEAT,
        },
        guide: false,
      });
      const unguidedTempo = Array.from(unguided.schedule.tempoTick, (_, i) => ({
        startTick: unguided.schedule.tempoTick[i] as number,
        qpmNum: unguided.schedule.tempoQpmNum[i] as number,
        qpmDen: unguided.schedule.tempoQpmDen[i] as number,
      }));
      const unguidedInput = { ...input, tempo: unguidedTempo, tickMap: unguided.tickMap };

      expect(input).toEqual(unguidedInput);
      expect(gradePerformance(input)).toEqual(gradePerformance(unguidedInput));
    },
  );

  it('the Grade is the same at Orchestra levels 0, 60 and 100', () => {
    const grades = [0, ORCHESTRA_LEVEL_DEFAULT, 100].map((level) => gradePerformance(playRun(level).input));
    expect(grades[1]).toEqual(grades[0]);
    expect(grades[2]).toEqual(grades[0]);
  });

  it("the run's expected notes and Performance log hold only the Score's notes and the musician's own keys - no guide event", () => {
    const { score, input, schedule } = playRun(ORCHESTRA_LEVEL_DEFAULT);
    const scoreNoteIds = new Set((score.parts[0]?.notes ?? []).map((n) => n.id));
    expect(input.expected).toHaveLength(score.parts[0]?.notes.length ?? -1);
    for (const note of input.expected) for (const id of note.noteIds) expect(scoreNoteIds.has(id)).toBe(true);
    // the log is the four key events the musician played and nothing from the schedule
    expect(input.log.messages.map((m: { kind: string; key: number }) => `${m.kind}:${m.key}`)).toEqual([
      'noteOn:60',
      'noteOff:60',
      'noteOn:61',
      'noteOff:61',
    ]);
    expect(maskChannels(schedule)).toHaveLength(1); // ... while the schedule did carry a guide
  });
});
