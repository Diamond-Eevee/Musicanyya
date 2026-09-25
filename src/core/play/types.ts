import type { PerformanceLog, RecordedMessage, StrictnessLevelName } from '../grade/types.js';
import type { HandSelection, LoopRange } from '../practice/types.js';
import type { NoteId } from '../score/model.js';

// data-model.md §1 - Play run
export type RunPhase = 'idle' | 'countIn' | 'running' | 'finished' | 'stopped' | 'aborted';

export interface PlayRun {
  runId: string; // crypto.randomUUID(), the key of the stored performance
  scoreId: string | null; // content hash; null when the Score is not stored
  settings: RunSettings; // frozen at start
  tickMap: PlayTickMap;
  phase: RunPhase;
  startedAt: string; // ISO 8601, for the attempt list
  startAudioTimeSec: number; // audio-clock time of run tick 0 (the first count-in beat)
  positionRunTick: number; // last position report, run ticks
  log: PerformanceLog; // appended to while running
  reliability: ReliabilityEvent[];
}

// data-model.md §2 - Tick mapping and the run schedule
export interface PlayTickMap {
  countInTicks: number; // >= one measure of the meter at the range start (FR-003)
  rangeStartTick: number; // timeline tick of the first pass in range
  rangeEndTick: number; // timeline tick after the last pass in range
  ppq: number;
}
// timelineTick = runTick - countInTicks + rangeStartTick
// runTick      = timelineTick - rangeStartTick + countInTicks

export interface PlayScheduleOptions {
  range: { fromPassIndex: number; toPassIndex: number } | null; // null = whole Score
  gradedNoteIds: ReadonlySet<NoteId>; // dropped from the schedule (FR-005)
  accompaniment: boolean; // false = everything but the Metronome is silent
  countInMeasures: number; // >= 1 (FR-003)
  tempoPercent: number; // 25..200 (FR-037): sizes the count-in so it lasts COUNT_IN_MIN_SECONDS as actually played
  metronome: { beatKey: number; downbeatKey: number; beatVelocity: number; downbeatVelocity: number };
}

// contracts/play-run.md - The run reducer
export type PlayAction =
  | { type: 'start'; runId: string; startAudioTimeSec: number; startedAt: string }
  | { type: 'position'; runTick: number; audioTimeSec: number } // from the worklet's position report
  | { type: 'input'; message: RecordedMessage } // a MIDI message, already on the audio clock
  | { type: 'ended' } // the worklet reached endTick
  | { type: 'stop' }
  | { type: 'reliability'; event: ReliabilityEvent }
  | { type: 'audioLost' };

export type PlayNoticeCode =
  | 'playNoMidi'
  | 'playMidiLost'
  | 'playMidiBack'
  | 'playAudioLost'
  | 'playNothingToGrade'
  | 'playLatencyAssumed'
  | 'playAttemptNotStored';

export type PlayEffect =
  | { type: 'countInBeat'; beat: number; of: number } // the count-in reached a beat; the UI may show it (never modal)
  | { type: 'runStarted' } // the count-in is over; the first expected note is now live (FR-003)
  | { type: 'soundInput'; key: number; velocity: number; on: boolean } // the musician's own note, through the live channel (FR-006)
  | { type: 'notice'; code: PlayNoticeCode } // non-blocking notice; never a dialogue (FR-009)
  | { type: 'runEnded'; reason: 'reachedEnd' | 'stopped' | 'audioLost' }; // grading may begin

export interface PlayStep {
  run: PlayRun;
  effects: readonly PlayEffect[];
}

// data-model.md §7 - Run settings
export interface RunSettings {
  range: LoopRange | null; // written measure range; null = whole Score (FR-036)
  tempoPercent: number; // 25..200, the existing transport range (FR-037)
  selection: HandSelection; // part + staves, 002's type (FR-038)
  strictness: StrictnessLevelName;
  countInMeasures: number; // >= 1 (FR-003)
  metronomeMuted: boolean; // affects sound only (AS-3.6)
  accompaniment: boolean; // other parts and the unselected hand (FR-005)
}

// data-model.md §9 - recorded during the run (R-12)
export interface ReliabilityEvent {
  kind: 'audioDropout' | 'midiDropped' | 'midiDeviceLost' | 'midiDeviceBack' | 'audioLost';
  audioTimeSec: number;
  detail: number | null; // e.g. how many messages
}
