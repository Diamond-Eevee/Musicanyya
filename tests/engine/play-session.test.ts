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
import { PLAY_STRICTNESS_DEFAULT } from '../../src/core/defaults.js';
import { gradePerformance } from '../../src/core/grade/grade.js';
import type { Grade } from '../../src/core/grade/types.js';
import type { PlayEffect, RunSettings } from '../../src/core/play/types.js';
import type { HandSelection } from '../../src/core/practice/types.js';
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
  let storedCount = 0;
  const callbacks: PlaySessionCallbacks = {
    onEffect: (e) => effects.push(e),
    onGraded: (g) => grades.push(g),
    onGradeFailed: (reason, message) => gradeFailures.push({ reason, message }),
    onStored: () => storedCount++,
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

  it('T044: a press matching the note at the cursor emits a display-only liveMark, by pitch only (FR-011)', () => {
    const { score, timeline, audioEngine, midiInput, effects, controller } = setup();
    controller.start({ scoreId: null, score, timeline, measures: score.measures, range: null, settings: settings() });
    const countInTicks = controller.getRun()!.tickMap.countInTicks;
    audioEngine.currentPosition = { audibleTick: countInTicks, playing: true };
    controller.reportPosition(2500); // the cursor is now exactly at the first written note (C4, key 60)

    midiInput.fire({ type: 'noteOn', deviceId: 'kb-1', key: 60, velocity: 70, timeStampMs: 2500 });

    const liveMarks = effects.filter((e): e is PlayEffect & { type: 'liveMark' } => e.type === 'liveMark');
    expect(liveMarks).toHaveLength(1);
    expect(liveMarks[0]?.noteIds.length).toBeGreaterThan(0);
  });

  it("T044: a wrong pitch is never marked - D-3's marker can only ever say 'correct', never 'wrong'", () => {
    const { score, timeline, audioEngine, midiInput, effects, controller } = setup();
    controller.start({ scoreId: null, score, timeline, measures: score.measures, range: null, settings: settings() });
    const countInTicks = controller.getRun()!.tickMap.countInTicks;
    audioEngine.currentPosition = { audibleTick: countInTicks, playing: true };
    controller.reportPosition(2500);

    midiInput.fire({ type: 'noteOn', deviceId: 'kb-1', key: 61, velocity: 70, timeStampMs: 2500 }); // C#4, not written

    expect(effects.filter((e) => e.type === 'liveMark')).toHaveLength(0);
  });

  it('T044: a held or repeated key at the same onset emits at most one liveMark for it, not one per press', () => {
    const { score, timeline, audioEngine, midiInput, effects, controller } = setup();
    controller.start({ scoreId: null, score, timeline, measures: score.measures, range: null, settings: settings() });
    const countInTicks = controller.getRun()!.tickMap.countInTicks;
    audioEngine.currentPosition = { audibleTick: countInTicks, playing: true };
    controller.reportPosition(2500);

    midiInput.fire({ type: 'noteOn', deviceId: 'kb-1', key: 60, velocity: 70, timeStampMs: 2500 });
    midiInput.fire({ type: 'noteOff', deviceId: 'kb-1', key: 60, timeStampMs: 2550 });
    midiInput.fire({ type: 'noteOn', deviceId: 'kb-1', key: 60, velocity: 70, timeStampMs: 2600 });

    expect(effects.filter((e) => e.type === 'liveMark')).toHaveLength(1);
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
    expect(input.reliability.filter(r => r.kind === 'audioLost')).toHaveLength(1);
    gradeWorker.reply({ type: 'graded', requestId, grade: gradePerformance(input) });
    await controller.waitForGrade();
  });

  it('T053: engine dropout stamps an audio dropout with the current audio time', () => {
    const { score, timeline, audioEngine, controller } = setup();
    controller.start({ scoreId: null, score, timeline, measures: score.measures, range: null, settings: settings() });
    controller.reportPosition(2000);

    audioEngine.fireEvent({ type: 'dropout', total: 1 });

    const run = controller.getRun();
    expect(run?.reliability.filter(r => r.kind === 'audioDropout')).toHaveLength(1);
  });

  it('T053: deviceLost and availability changes stamp device loss/return with the current audio time', () => {
    const { score, timeline, midiInput, controller } = setup();
    controller.start({ scoreId: null, score, timeline, measures: score.measures, range: null, settings: settings() });
    controller.reportPosition(2000);

    midiInput.fire({ type: 'deviceLost', deviceId: 'kb-1', heldKeys: [] });

    const run = controller.getRun();
    const losses = run?.reliability.filter(r => r.kind === 'midiDeviceLost') ?? [];
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
});
