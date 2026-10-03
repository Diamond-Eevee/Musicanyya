/**
 * Feature 021 US2 (audio-setup.md section 2 and 5, research R-9, FR-011, FR-014, SC-006): a calibration is used by every new
 * Play run and its Grade, and an older stored log still grades as it always did.
 *
 *  - the run copies the profile in use into its Performance log (the real engine here: that is where it was always "assumed");
 *  - a performance played exactly the calibrated total late grades every note correct and on time - graded through the grade
 *    worker's own message handler (`handleMessage`), the way the app does, never `gradePerformance` inline;
 *  - the same performance without a calibration is late by that total, so it is the calibration that makes the Grade exact;
 *  - a stored log is regraded with its own latency: whatever profile is in use now plays no part (FR-014).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlaySessionController } from '../../src/app/play-session.js';
import { PLAY_STRICTNESS_DEFAULT } from '../../src/core/defaults.js';
import { buildExpectedNotes } from '../../src/core/grade/expected.js';
import { gradePerformance } from '../../src/core/grade/grade.js';
import type { Grade, LatencyProfile } from '../../src/core/grade/types.js';
import type { RunSettings } from '../../src/core/play/types.js';
import type { HandSelection } from '../../src/core/practice/types.js';
import { audioTimeAtTick } from '../../src/core/tempo/rate.js';
import type { TempoSegment } from '../../src/core/timeline/types.js';
import { WebAudioEngine } from '../../src/engine/audio/web-audio-engine.js';
import type { AudioEngine } from '../../src/engine/ports.js';
import { handleMessage } from '../../src/workers/grade.worker.js';
import { buildGradeInput } from '../core/grade/helpers.js';
import { loadFixture } from '../core/practice/helpers.js';
import { FakeAudioEngine } from '../fakes/fake-audio-engine.js';
import { FakeMidiInput } from '../fakes/fake-midi-input.js';
import { FakePerformanceStore } from '../fakes/fake-performance-store.js';
import { loadRecordedPerformance } from '../fakes/performance-log.js';

const BOTH: HandSelection = { preset: 'both', partIndex: 0, staves: [1] };

const CALIBRATED: LatencyProfile = {
  outputLatencyMs: 12,
  inputLatencyMs: 18, // total 30 ms
  source: 'measured',
  measuredAt: '2026-10-02T12:00:00.000Z',
};
const TOTAL_MS = CALIBRATED.outputLatencyMs + CALIBRATED.inputLatencyMs;

const settings = (): RunSettings => ({
  range: null,
  tempoPercent: 100,
  selection: BOTH,
  strictness: PLAY_STRICTNESS_DEFAULT,
  countInMeasures: 1,
  metronomeMuted: false,
  accompaniment: true,
});

/** The grade worker as the app has it, with its real message handler: a request is answered by `handleMessage`. */
class WorkerWithRealHandler {
  readonly posted: { type: string; requestId: number; input: { latency: LatencyProfile } }[] = [];
  private listeners = new Set<(event: MessageEvent) => void>();
  postMessage(msg: unknown) {
    this.posted.push(msg as (typeof this.posted)[number]);
    handleMessage(
      { data: msg } as MessageEvent,
      ((reply: unknown) => {
        for (const listener of [...this.listeners]) listener({ data: reply } as MessageEvent);
      }) as typeof postMessage,
    );
  }
  addEventListener(_type: 'message', listener: (event: MessageEvent) => void) {
    this.listeners.add(listener);
  }
  removeEventListener(_type: 'message', listener: (event: MessageEvent) => void) {
    this.listeners.delete(listener);
  }
}

function harness(engine: AudioEngine) {
  const { score, timeline } = loadFixture('eight-measure-melody.musicxml');
  const midi = new FakeMidiInput();
  const worker = new WorkerWithRealHandler();
  const store = new FakePerformanceStore();
  const grades: Grade[] = [];
  const controller = new PlaySessionController(
    engine,
    midi,
    worker,
    store,
    { onEffect() {}, onGraded: (g) => grades.push(g), onGradeFailed() {}, onStored() {} },
    5000,
    () => 1000,
    () => 'run-1',
    () => '2026-10-02T12:30:00.000Z',
  );
  const start = () =>
    controller.start({
      scoreId: 'score-1',
      score,
      timeline,
      measures: score.measures,
      range: null,
      settings: settings(),
    });
  return { score, timeline, midi, worker, store, grades, controller, start };
}

describe('the calibration reaches the Performance log (FR-011)', () => {
  beforeEach(() => {
    const context = {
      state: 'running',
      resume: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      audioWorklet: { addModule: vi.fn().mockResolvedValue(undefined) },
      baseLatency: 0.01,
      outputLatency: 0.04,
      sampleRate: 48000,
      currentTime: 0,
    };
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function AudioContext() {
        return context;
      }),
    );
    vi.stubGlobal(
      'AudioWorkletNode',
      vi.fn(function AudioWorkletNode() {
        return { port: { postMessage: vi.fn(), onmessage: null }, connect: vi.fn(), disconnect: vi.fn() };
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('a Play run started after setLatencyCalibration(p) carries p in its grade input and in the stored record', async () => {
    const engine = new WebAudioEngine();
    await engine.unlock();
    engine.setLatencyCalibration(CALIBRATED);
    const h = harness(engine);

    h.start();
    h.controller.stop();
    await h.controller.waitForGrade();

    expect(h.worker.posted).toHaveLength(1);
    expect(h.worker.posted[0]?.input.latency).toEqual(CALIBRATED);
    const stored = [...h.store.records.values()][0];
    expect(stored?.latency).toEqual(CALIBRATED);
    expect(h.grades[0]?.latency).toEqual(CALIBRATED);
  });

  it('without a calibration the run carries the assumed profile (the reported output latency, input 0)', async () => {
    const engine = new WebAudioEngine();
    await engine.unlock();
    const h = harness(engine);

    h.start();
    h.controller.stop();
    await h.controller.waitForGrade();

    const latency = h.worker.posted[0]?.input.latency;
    expect(latency?.source).toBe('assumed');
    expect(latency?.inputLatencyMs).toBe(0);
  });
});

describe('a performance played exactly the calibrated total late (SC-006)', () => {
  /** Plays the whole eight-measure melody `lateMs` after each onset on the audio clock, then lets the run end. */
  async function playPerformance(profile: LatencyProfile | null, lateMs: number) {
    const engine = new FakeAudioEngine();
    engine.currentClockPair = { contextTime: 1, performanceTime: 1000 }; // audio time = 1 + (ms - 1000) / 1000
    if (profile) engine.setLatencyCalibration(profile);
    const h = harness(engine);
    h.start();

    const run = h.controller.getRun();
    if (!run) throw new Error('the run did not start');
    const schedule = engine.loaded[0];
    if (!schedule) throw new Error('no schedule was loaded');
    const tempo: TempoSegment[] = Array.from(schedule.tempoTick, (tick, i) => ({
      startTick: tick,
      qpmNum: schedule.tempoQpmNum[i] ?? 0,
      qpmDen: schedule.tempoQpmDen[i] ?? 1,
    }));
    engine.currentPosition = { audibleTick: run.tickMap.countInTicks, playing: true };
    h.controller.reportPosition(2000);

    const expected = buildExpectedNotes(h.score, h.timeline, BOTH, null);
    const messages = expected.flatMap((note) => {
      const onsetSec = audioTimeAtTick(run.tickMap.countInTicks + note.onsetTick, tempo, h.timeline.ppq, 100);
      const downMs = 1000 + (onsetSec + lateMs / 1000) * 1000; // the run starts at audio time 1 = performance time 1000
      return [
        { type: 'noteOn' as const, deviceId: 'kb', key: note.key, velocity: 100, timeStampMs: downMs },
        { type: 'noteOff' as const, deviceId: 'kb', key: note.key, timeStampMs: downMs + 100 },
      ];
    });
    messages.sort((a, b) => a.timeStampMs - b.timeStampMs);
    for (const message of messages) h.midi.fire(message);

    engine.fireEvent({ type: 'ended' });
    h.controller.reportPosition(10_000_000);
    await h.controller.waitForGrade();
    const grade = h.grades[0];
    if (!grade) throw new Error('no Grade came back from the worker');
    return grade;
  }

  it('grades every note correct and on time, with no timing difference left', async () => {
    const grade = await playPerformance(CALIBRATED, TOTAL_MS);

    const total = grade.results.length;
    expect(total).toBeGreaterThan(8);
    expect(grade.summary.notesCorrect).toEqual({ count: total, total });
    expect(grade.summary.notesOnTime).toEqual({ count: total, total });
    expect(grade.summary.counts.early).toBe(0);
    expect(grade.summary.counts.late).toBe(0);
    expect(grade.summary.counts.extra).toBe(0);
    for (const result of grade.results) {
      expect(result.timing).toBe('onTime');
      expect(Math.abs(result.deltaMs ?? Number.NaN)).toBeLessThan(1);
    }
  });

  it('is what makes it exact: the same performance with no calibration is late by that total on every note', async () => {
    const grade = await playPerformance(null, TOTAL_MS);

    expect(grade.latency.source).toBe('assumed');
    for (const result of grade.results) {
      expect(result.deltaMs ?? Number.NaN).toBeCloseTo(TOTAL_MS, 0);
    }
  });
});

describe('a stored log is regraded with its own latency (FR-014)', () => {
  it('a log recorded with an assumed profile grades as before, whatever calibration is in use now', () => {
    const { log } = loadRecordedPerformance('accurate-eight-measures.json');
    const input = buildGradeInput('eight-measure-melody.musicxml', BOTH, log);
    expect(input.latency.source).toBe('assumed');
    const before = gradePerformance(input);

    const engine = new FakeAudioEngine();
    engine.setLatencyCalibration(CALIBRATED); // the profile in use has changed since the log was recorded

    const posted: unknown[] = [];
    handleMessage(
      { data: { type: 'grade', requestId: 7, input } } as MessageEvent,
      ((reply: unknown) => posted.push(reply)) as typeof postMessage,
    );
    expect(posted).toEqual([{ type: 'graded', requestId: 7, grade: before }]);
    expect(before.latency).toEqual(input.latency); // the Grade is built on the log's profile, not the engine's
    expect(engine.latencyProfile()).toEqual(CALIBRATED);
  });
});
