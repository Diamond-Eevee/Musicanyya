import { METRONOME_CHANNEL, METRONOME_LEVEL_DEFAULT } from '../core/defaults.js';
import { metronomeChannelVolume } from '../core/play/metronome.js';
import { createIdleRun } from '../core/play/run.js';
import type { PlayRun, PlayTickMap, RunSettings } from '../core/play/types.js';
import type { ScheduleMessage } from '../core/schedule/compile.js';
import type { AudioEngine, AudioEngineEvent, Unsubscribe } from '../engine/ports.js';

export interface ReplaySessionCallbacks {
  onEnded(): void;
}

/**
 * Drives `mx-score-view`'s existing Play-mode cursor-follow (`PlayPositionReporter`) for a replayed stored
 * performance (FR-042, AS-4.2), so no second cursor mechanism is needed - the marks themselves come from
 * `playState.grade` (a regrade, `src/app/session.ts`), independent of whatever is driving the cursor. Unlike
 * `PlaySessionController`, replay carries no MIDI, no grading and no recording: it only plays a schedule already
 * compiled by `compileReplay` and reports where playback is.
 */
export class ReplaySessionController {
  private run: PlayRun | null = null;
  private readonly unsubscribe: Unsubscribe;
  /** The run's own mute and the musician's Metronome level, which together set the click channel (feature 019). */
  private metronomeMuted = false;
  private metronomeLevel = METRONOME_LEVEL_DEFAULT;

  constructor(
    private readonly audioEngine: AudioEngine,
    private readonly callbacks: ReplaySessionCallbacks,
  ) {
    this.unsubscribe = this.audioEngine.on((event: AudioEngineEvent) => {
      if (event.type === 'ended' && this.run) {
        this.run = null;
        this.callbacks.onEnded();
      }
    });
  }

  start(
    scoreId: string | null,
    settings: RunSettings,
    tickMap: PlayTickMap,
    schedule: ScheduleMessage,
    metronomeLevel: number = METRONOME_LEVEL_DEFAULT,
  ): void {
    this.audioEngine.load(schedule);
    // Played at the attempt's own tempo, the factor `compileReplay` converted its times with (012 FR-018).
    this.audioEngine.setTempoPercent(settings.tempoPercent);
    // The replay plays the run's own clicks: its mute is the attempt's, its level the one in force now. Set after the
    // schedule like a run does, so the worklet never plays them at whatever it last held (019 T079).
    this.metronomeMuted = settings.metronomeMuted;
    this.metronomeLevel = metronomeLevel;
    this.applyMetronomeVolume();
    this.audioEngine.play();
    this.run = { ...createIdleRun(scoreId, settings, tickMap), phase: 'running' };
  }

  /** The Metronome level changed while a replay plays: the click follows at once, nothing else moves. */
  setMetronomeLevel(level: number): void {
    if (level === this.metronomeLevel) return;
    this.metronomeLevel = level;
    if (this.run) this.applyMetronomeVolume();
  }

  private applyMetronomeVolume(): void {
    this.audioEngine.setChannelVolume(
      METRONOME_CHANNEL,
      metronomeChannelVolume(this.metronomeMuted, this.metronomeLevel),
    );
  }

  stop(): void {
    this.audioEngine.stop();
    this.run = null;
  }

  dispose(): void {
    this.unsubscribe();
  }

  getRun(): PlayRun | null {
    return this.run;
  }

  /** `PlayPositionReporter` (`mx-score-view.ts`): called every animation frame while replay is live. */
  reportPosition(nowMs: number): void {
    if (!this.run) return;
    const position = this.audioEngine.audiblePosition(nowMs);
    if (!position) return;
    this.run = { ...this.run, positionRunTick: position.audibleTick };
  }
}
