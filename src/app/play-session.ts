import {
  METRONOME_CHANNEL,
  METRONOME_KEY_BEAT,
  METRONOME_KEY_DOWNBEAT,
  METRONOME_VELOCITY_BEAT,
  METRONOME_VELOCITY_DOWNBEAT,
} from '../core/defaults.js';
import { buildExpectedNotes, buildPlayedAlongSpans } from '../core/grade/expected.js';
import type {
  ExpectedNote,
  Grade,
  GradeInput,
  LatencyProfile,
  PlayedAlongSpan,
  RecordedMessage,
} from '../core/grade/types.js';
import { resolveWindows } from '../core/grade/windows.js';
import { createIdleRun, playRunReducer } from '../core/play/run.js';
import type { PlayAction, PlayEffect, PlayRun, RunSettings } from '../core/play/types.js';
import type { LoopPassSpan } from '../core/practice/types.js';
import { compilePlaySchedule } from '../core/schedule/play-schedule.js';
import type { MeasureInfo, Score } from '../core/score/model.js';
import { effectiveQpm, tempoAtTick } from '../core/tempo/tempo-map.js';
import type { MeasurePass, PlaybackTimeline, TempoSegment } from '../core/timeline/types.js';
import { GRADE_WORKER_TIMEOUT_MS } from '../engine/config.js';
import { MidiClockMap } from '../engine/midi/clock-map.js';
import type { AudioEngine, AudioEngineEvent, MidiInput, MidiInputEvent, Unsubscribe } from '../engine/ports.js';
import { type GradeWorkerLike, requestGrade } from '../workers/grade.worker.js';

export interface StartPlayOptions {
  scoreId: string | null;
  score: Score;
  timeline: PlaybackTimeline;
  measures: readonly MeasureInfo[];
  /** Already resolved to pass indices (unlike `RunSettings.range`, a written measure range) - occurrence
   *  resolution when a range repeats is a US3 concern (T060-069), not this controller's. */
  range: LoopPassSpan | null;
  settings: RunSettings;
}

export interface PlaySessionCallbacks {
  /** Every effect the run reducer returns, in order, after the controller has already acted on the ones that
   *  touch the engine (`soundInput`) - the UI never needs to re-derive that part. */
  onEffect(effect: PlayEffect): void;
  onGraded(grade: Grade): void;
  onGradeFailed(reason: 'timeout' | 'error', message?: string): void;
}

function ticksToMs(ticks: number, qpm: number, ppq: number): number {
  return (ticks / ppq) * (60 / qpm) * 1000;
}

/**
 * T039, research R-01: the only place that touches the engine for Play mode. Compiles the run's own schedule,
 * drives the pure `playRunReducer` from position reports (never a timer, Constitution I/II), records every MIDI
 * message on the audio clock via `MidiClockMap` (R-04), and grades **through the worker** when the run ends -
 * never inline (Constitution IV, contracts/play-run.md, contracts/grading.md).
 *
 * Reliability capture (audio dropouts, MIDI device loss/return) and `audioLost` detection are US2's T053/T098,
 * not this task - the reducer already supports both actions, but nothing here raises them yet.
 */
export class PlaySessionController {
  private run: PlayRun | null = null;
  private expected: readonly ExpectedNote[] = [];
  private playedAlong: readonly PlayedAlongSpan[] = [];
  /** Run-tick space (0 = count-in start): what `GradeInput.tempo` needs for the worker's audio-time -> run-tick
   *  conversion to be correct for any count-in/range combination (contracts/grading.md step 1, T106). */
  private runTempo: readonly TempoSegment[] = [];
  /** Timeline-tick space (unshifted): what lines up with `ExpectedNote.onsetTick` for this controller's own
   *  tail-window computation below (data-model.md section 4). */
  private timelineTempo: readonly TempoSegment[] = [];
  private ppq = 0;
  private measures: readonly MeasureInfo[] = [];
  private passes: readonly MeasurePass[] = [];
  private latency: LatencyProfile = { outputLatencyMs: 0, inputLatencyMs: 0, source: 'assumed', measuredAt: null };
  private tailMs = 0;

  private readonly clockMap = new MidiClockMap();
  private lastNowMs = 0;
  private awaitingTail = false;
  private audioEndedAtMs = 0;

  /** T044/FR-011: onset ticks already given a live mark this run, so a held or repeated key does not re-emit one. */
  private readonly liveMarkedOnsets = new Set<number>();

  private nextGradeRequestId = 1;
  private pendingGrade: Promise<void> | null = null;

  private readonly unsubMidi: Unsubscribe;
  private readonly unsubEngine: Unsubscribe;

  constructor(
    private readonly audioEngine: AudioEngine,
    private readonly midiInput: MidiInput,
    private readonly gradeWorker: GradeWorkerLike,
    private readonly callbacks: PlaySessionCallbacks,
    private readonly gradeTimeoutMs: number = GRADE_WORKER_TIMEOUT_MS,
    private readonly now: () => number = () => performance.now(),
    private readonly randomUUID: () => string = () => crypto.randomUUID(),
    private readonly nowISO: () => string = () => new Date().toISOString(),
  ) {
    this.unsubMidi = this.midiInput.on((event) => this.handleMidiEvent(event));
    this.unsubEngine = this.audioEngine.on((event) => this.handleEngineEvent(event));
  }

  getRun(): PlayRun | null {
    return this.run;
  }

  /** Compiles the run schedule, loads and starts it, and dispatches `start` to the reducer (FR-002, FR-003). */
  start(options: StartPlayOptions): void {
    const { scoreId, score, timeline, measures, range, settings } = options;

    this.expected = buildExpectedNotes(score, timeline, settings.selection, range);
    this.playedAlong = buildPlayedAlongSpans(score, timeline, settings.selection, range);
    this.ppq = timeline.ppq;
    this.measures = measures;
    this.passes = timeline.passes;
    this.timelineTempo = timeline.tempo;
    this.latency = this.audioEngine.latencyProfile();
    this.awaitingTail = false;
    this.liveMarkedOnsets.clear();

    const gradedNoteIds = new Set(this.expected.flatMap((note) => note.noteIds));
    const { schedule, tickMap } = compilePlaySchedule(timeline, measures, {
      range,
      gradedNoteIds,
      accompaniment: settings.accompaniment,
      countInMeasures: settings.countInMeasures,
      tempoPercent: settings.tempoPercent,
      metronome: {
        beatKey: METRONOME_KEY_BEAT,
        downbeatKey: METRONOME_KEY_DOWNBEAT,
        beatVelocity: METRONOME_VELOCITY_BEAT,
        downbeatVelocity: METRONOME_VELOCITY_DOWNBEAT,
      },
    });

    // The run's own tempo map, in run-tick space (0 = count-in start) - what gradePerformance's audio-time ->
    // run-tick conversion needs (contracts/grading.md step 1), reconstructed from the compiled schedule rather
    // than recomputed, since compileSchedule already shifted it exactly once (Constitution II).
    this.runTempo = Array.from(schedule.tempoTick, (_, i) => ({
      startTick: schedule.tempoTick[i] as number,
      qpmNum: schedule.tempoQpmNum[i] as number,
      qpmDen: schedule.tempoQpmDen[i] as number,
    }));

    this.tailMs = this.computeTailMs(settings);

    this.audioEngine.load(schedule);
    if (settings.metronomeMuted) this.audioEngine.setChannelVolume(METRONOME_CHANNEL, 0);
    this.audioEngine.play();

    this.syncClock();
    const nowMs = this.now();
    this.lastNowMs = nowMs;
    const startAudioTimeSec = this.clockMap.toAudioTime(nowMs) ?? 0;

    this.run = createIdleRun(scoreId, settings, tickMap);
    this.dispatch({ type: 'start', runId: this.randomUUID(), startAudioTimeSec, startedAt: this.nowISO() });
  }

  /** How long past the worklet's own `ended` event to keep recording, so the last expected note's late claim
   *  window is never cut short (R-16). Zero when there is nothing to grade. Uses `timelineTempo`, matching the
   *  space `resolveWindows` and `ExpectedNote.onsetTick` are already in (data-model.md section 4). */
  private computeTailMs(settings: RunSettings): number {
    if (this.expected.length === 0) return 0;
    const windows = resolveWindows(
      this.expected,
      this.measures,
      this.timelineTempo,
      this.ppq,
      settings.tempoPercent,
      settings.strictness,
    );
    const lastIndex = this.expected.length - 1;
    const last = this.expected[lastIndex];
    const lastWindow = windows[lastIndex];
    if (!last || !lastWindow) return 0;
    const qpm = effectiveQpm(tempoAtTick(this.timelineTempo, last.onsetTick), settings.tempoPercent);
    return ticksToMs(lastWindow.claimLateTicks, qpm, this.ppq);
  }

  /** FR-008: ends the run early. Whatever was recorded up to now becomes a partial Grade (`complete: false`). */
  stop(): void {
    if (!this.run) return;
    this.awaitingTail = false;
    this.dispatch({ type: 'stop' });
    this.audioEngine.stop();
  }

  /** Called every animation frame while a run is live; the caller (the app's own rAF loop) drives this exactly
   *  like `mx-score-view` drives the cursor (R-11) - exposed directly so tests can call it without a real one. */
  reportPosition(nowMs: number): void {
    this.lastNowMs = nowMs;
    if (!this.run || (this.run.phase !== 'countIn' && this.run.phase !== 'running')) return;

    if (this.awaitingTail) {
      if (nowMs - this.audioEndedAtMs >= this.tailMs) {
        this.awaitingTail = false;
        this.dispatch({ type: 'ended' });
      }
      return;
    }

    this.syncClock();
    const position = this.audioEngine.audiblePosition(nowMs);
    if (!position) return;
    const audioTimeSec = this.clockMap.toAudioTime(nowMs);
    if (audioTimeSec === null) return;
    this.dispatch({ type: 'position', runTick: position.audibleTick, audioTimeSec });
  }

  /** Resolves once the most recently finished run's Grade (or grading failure) has reached the callbacks -
   *  mainly for tests, which have no animation-frame loop to observe the callback naturally. */
  async waitForGrade(): Promise<void> {
    await this.pendingGrade;
  }

  dispose(): void {
    this.unsubMidi();
    this.unsubEngine();
  }

  private syncClock(): void {
    this.clockMap.updatePair(this.audioEngine.clockPair());
  }

  private handleEngineEvent(event: AudioEngineEvent): void {
    if (event.type !== 'ended') return;
    if (!this.run || (this.run.phase !== 'countIn' && this.run.phase !== 'running')) return;
    this.audioEndedAtMs = this.lastNowMs;
    this.awaitingTail = true;
  }

  private handleMidiEvent(event: MidiInputEvent): void {
    if (!this.run || (this.run.phase !== 'countIn' && this.run.phase !== 'running')) return;
    if (event.type !== 'noteOn' && event.type !== 'noteOff' && event.type !== 'sustain') return;

    this.syncClock();
    const audioTimeSec = this.clockMap.toAudioTime(event.timeStampMs);
    if (audioTimeSec === null) return; // no clock pair yet (extremely early in a run) - nothing to anchor to

    const message: RecordedMessage =
      event.type === 'sustain'
        ? {
            kind: 'sustain',
            key: 0,
            velocity: 0,
            down: event.down,
            audioTimeSec,
            timeStampMs: event.timeStampMs,
            deviceId: event.deviceId,
          }
        : {
            kind: event.type,
            key: event.key,
            velocity: event.type === 'noteOn' ? event.velocity : 0,
            down: false,
            audioTimeSec,
            timeStampMs: event.timeStampMs,
            deviceId: event.deviceId,
          };
    this.dispatch({ type: 'input', message });
    if (event.type === 'noteOn') this.checkLiveMark(event.key);
  }

  /** FR-011, contracts/play-run.md "The live marking of `liveMark`": deliberately cheap and approximate - matches
   *  a press against the expected notes at or next to the cursor by pitch only, says nothing about timing or
   *  about wrong pitches (D-3), and is display only (`onEffect`, never the reducer's own state - the Grade
   *  computed from the log is the only thing that can be wrong, FR-011a). */
  private checkLiveMark(key: number): void {
    if (!this.run) return;
    const timelineTick = this.run.positionRunTick - this.run.tickMap.countInTicks + this.run.tickMap.rangeStartTick;
    const windowTicks = this.ppq; // a quarter note either side: generous and cheap, not the real claim window

    let nearest: ExpectedNote | null = null;
    let nearestDistance = Infinity;
    for (const note of this.expected) {
      if (note.key !== key) continue;
      const distance = Math.abs(note.onsetTick - timelineTick);
      if (distance > windowTicks || distance >= nearestDistance) continue;
      nearest = note;
      nearestDistance = distance;
    }
    if (!nearest || this.liveMarkedOnsets.has(nearest.onsetTick)) return;

    this.liveMarkedOnsets.add(nearest.onsetTick);
    const noteIds = this.expected
      .filter((note) => note.onsetTick === nearest.onsetTick && note.key === key)
      .flatMap((note) => note.noteIds);
    this.callbacks.onEffect({ type: 'liveMark', noteIds });
  }

  private dispatch(action: PlayAction): void {
    if (!this.run) return;
    const { run, effects } = playRunReducer(this.run, action);
    this.run = run;
    this.applyEffects(effects);
  }

  private applyEffects(effects: readonly PlayEffect[]): void {
    for (const effect of effects) {
      if (effect.type === 'soundInput') {
        if (effect.on) this.audioEngine.liveNoteOn(effect.key, effect.velocity);
        else this.audioEngine.liveNoteOff(effect.key);
      } else if (effect.type === 'runEnded') {
        this.pendingGrade = this.finishRun(effect.reason !== 'stopped');
      }
      this.callbacks.onEffect(effect);
    }
  }

  /** contracts/grading.md "Worker protocol": grading always goes through `requestGrade`, never `gradePerformance`
   *  called inline - this file never imports `src/core/grade/grade.js` (Constitution IV). */
  private async finishRun(complete: boolean): Promise<void> {
    const run = this.run;
    if (!run) return;

    const input: GradeInput = {
      runId: run.runId,
      complete,
      expected: this.expected,
      playedAlong: this.playedAlong,
      log: run.log,
      tempo: this.runTempo,
      ppq: this.ppq,
      tickMap: run.tickMap,
      startAudioTimeSec: run.startAudioTimeSec,
      settings: run.settings,
      latency: this.latency,
      reliability: run.reliability,
      passes: this.passes,
      measures: this.measures,
    };

    const result = await requestGrade(this.gradeWorker, input, this.nextGradeRequestId++, this.gradeTimeoutMs);
    if (result.ok) this.callbacks.onGraded(result.grade);
    else this.callbacks.onGradeFailed(result.reason, result.message);
  }
}
