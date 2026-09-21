import type { PlayTickMap, ReliabilityEvent, RunSettings } from '../play/types.js';
import type { MeasureInfo, NoteId, Ticks } from '../score/model.js';
import type { MeasurePass, TempoSegment } from '../timeline/types.js';

// data-model.md §3 - Performance log
export interface PerformanceLog {
  version: 1;
  messages: RecordedMessage[]; // append-only, recorded order preserved
  droppedMessages: number; // FR-015
}

export interface RecordedMessage {
  kind: 'noteOn' | 'noteOff' | 'sustain';
  key: number; // 0..127; 0 for sustain
  velocity: number; // 0..127; 0 for noteOff and sustain
  down: boolean; // sustain only
  audioTimeSec: number; // mapped onto the audio clock (R-04) - what grading uses
  timeStampMs: number; // raw MIDIMessageEvent.timeStamp, kept for provenance
  deviceId: string;
}

// data-model.md §4 - Expected note
export interface ExpectedNote {
  index: number; // written order within the run, 0-based
  noteIds: readonly NoteId[]; // every notehead at this key and onset (a unison across voices marks both)
  key: number; // MIDI key number
  onsetTick: Ticks; // timeline ticks
  measureIndex: number;
  passIndex: number; // the occurrence, so repeats are graded separately (AS-1.9)
  chordSize: number; // how many expected notes share this onset (1 = not a chord)
  arpeggiated: boolean; // the Score writes this chord rolled (<arpeggiate>): the wider spread applies (D-2)
}

export interface PlayedAlongSpan {
  key: number; // MIDI key that may be played here without being graded
  fromTick: Ticks; // timeline ticks, inclusive
  toTick: Ticks; // timeline ticks, exclusive
  source: 'ungraded' | 'ornament'; // the unselected hand or another part / the realisation of a written ornament
}

// data-model.md §5 - Results
export type PitchResult = 'correct' | 'wrongPitch' | 'missed';
export type TimingResult = 'onTime' | 'early' | 'late';

export interface NoteResult {
  expectedIndex: number;
  noteIds: readonly NoteId[];
  pitch: PitchResult;
  timing: TimingResult | null; // null if and only if pitch === "missed" (FR-018)
  playedKey: number | null; // the key that claimed it
  deltaTicks: number | null; // signed: negative = early
  deltaMs: number | null; // the same difference for the musician (FR-030)
  reason: ResultReason; // R-13
}

export interface ExtraNote {
  key: number;
  audioTimeSec: number;
  atTick: Ticks; // where in the Score it was played (FR-029)
  measureIndex: number;
  passIndex: number;
  reason: ResultReason;
}

/** A press covered by a PlayedAlongSpan: never wrong, never extra (FR-024) */
export interface PlayedAlongPress {
  key: number;
  atTick: Ticks;
  measureIndex: number;
  passIndex: number;
  source: PlayedAlongSpan['source'];
}

export interface ResultReason {
  code:
    | 'correctOnTime'
    | 'earlyBy'
    | 'lateBy'
    | 'wrongOctaveHigh'
    | 'wrongOctaveLow'
    | 'missedNothingPlayed'
    | 'extraNoNoteWritten';
  expectedKey: number | null;
  playedKey: number | null;
  octaveDelta: number | null; // signed octaves, for the wrongOctave codes
  deltaMs: number | null;
}

// data-model.md §6 - Strictness levels and timing windows
export type StrictnessLevelName = 'beginner' | 'standard' | 'strict';

export interface Window {
  beats: number;
  floorMs: number;
  capMs: number;
}

export interface StrictnessLevel {
  onTimeEarly: Window; // defaults equal to onTimeLate; the asymmetric shape is kept for later use
  onTimeLate: Window;
  claim: Window; // also the early/late outer bound and the missed boundary
  chordSpread: Window; // ADDED to the on-time window for a member of a chord
  arpeggioSpread: Window; // ADDED instead of chordSpread where the Score writes <arpeggiate> (D-2, FR-022)
}

// data-model.md §8 - Latency profile
export interface LatencyProfile {
  outputLatencyMs: number; // reported by the engine where available
  inputLatencyMs: number; // dispatch-delay estimate, or 0 where nothing is known
  source: 'assumed' | 'measured'; // FR-034 - the Grade says which
  measuredAt: string | null; // ISO 8601 when measured
}

// contracts/grading.md - Entry point
export interface GradeInput {
  runId: string;
  complete: boolean; // false after a stop (FR-008)
  expected: readonly ExpectedNote[]; // written order, already sliced to the run's range
  playedAlong: readonly PlayedAlongSpan[]; // keys that may sound here without being graded (FR-024, D-1)
  log: PerformanceLog;
  tempo: readonly TempoSegment[]; // the run's own tempo map, run-tick space (0 = count-in start) - Step 1 only
  timelineTempo: readonly TempoSegment[]; // the Score's tempo map, timeline-tick space - Step 2 and the deltaMs qpm (1.2.0)
  ppq: number;
  tickMap: PlayTickMap;
  startAudioTimeSec: number; // audio time of run tick 0
  // Carried straight onto Grade.settings; grading reads tempoPercent (FR-037) and strictness from here too
  // (contracts/grading.md 1.1.1 - gradePerformance is pure, so Grade.settings must come from somewhere).
  settings: RunSettings;
  latency: LatencyProfile;
  reliability: readonly ReliabilityEvent[];
  passes: readonly MeasurePass[]; // for the per-measure overview
  measures: readonly MeasureInfo[]; // for the window beat-unit lookup (data-model.md section 6)
}

// data-model.md §9, contracts/performance-log.md - a finished run, kept on the device (FR-041)
export interface StoredPerformance {
  runId: string;
  scoreId: string;
  finishedAt: string; // ISO 8601
  settings: RunSettings;
  latency: LatencyProfile;
  appVersion: string; // from the build, so an old log is recognisable (FR-014)
  // Run-relative (0 = this run's own tick 0), unlike a live PlayRun.log: research R-20.
  log: PerformanceLog;
  summary: GradeSummary; // denormalised so the attempt list needs no re-grading
  schema: 1;
}

// data-model.md §9 - Stored performance and the Grade
export interface Grade {
  runId: string;
  complete: boolean; // false after a stop (FR-008)
  results: readonly NoteResult[];
  extras: readonly ExtraNote[];
  playedAlong: readonly PlayedAlongPress[]; // FR-024: shown as information, counted in nothing
  summary: GradeSummary;
  measures: readonly MeasureOverview[];
  reliability: readonly ReliabilityWarning[];
  settings: RunSettings;
  latency: LatencyProfile;
  /** The expected notes that were graded, in the order `results` references them by `expectedIndex`. Used by
   *  the mistake stepper (FR-031) to sort results by onset tick and by the grade panel to explain them (FR-030). */
  expected: readonly ExpectedNote[];
}

// FR-028, two figures plus plain counts
export interface GradeSummary {
  notesCorrect: { count: number; total: number }; // pitch axis
  notesOnTime: { count: number; total: number }; // timing axis, total = notes that were played
  counts: { correct: number; wrongPitch: number; missed: number; extra: number; early: number; late: number };
  meanAsynchronyMs: number | null; // signed, over the played notes; information, never a score (R-06)
  timingNotResolvable: boolean; // the run contained stretches where on-time == claim (section 6)
}

// per measure PASS, so repeats stay separate (R-14)
export interface MeasureOverview {
  passIndex: number;
  measureIndex: number;
  counts: GradeSummary['counts'];
  unreliable: boolean;
}

// computed for the Grade
export interface ReliabilityWarning {
  kind: ReliabilityEvent['kind'];
  fromPassIndex: number;
  toPassIndex: number;
}
