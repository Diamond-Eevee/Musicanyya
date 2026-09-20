import type { NoteId, Ticks } from '../score/model.js';

export interface HandSelection {
  preset: 'both' | 'right' | 'left' | 'custom';
  partIndex: number;
  staves: readonly number[];
}

export interface RequiredKey {
  key: number;
  noteIds: readonly NoteId[];
  staff: number;
}

export interface ExpectedEvent {
  index: number;
  passIndex: number;
  measureIndex: number;
  onsetTick: Ticks;
  required: readonly RequiredKey[];
  accompaniment: readonly SoundingRef[];
}

export interface SoundingRef {
  noteId: NoteId;
  key: number;
  endTick: Ticks;
  velocity: number;
}

export type MarkState =
  | 'waiting'
  | 'correctSoFar'
  | 'correct'
  | 'wrongPitch'
  | 'wrongOctave'
  | 'extra'
  | 'heldOver'
  | 'playedAlong'
  | 'skipped';

export interface Attempt {
  key: number;
  eventIndex: number;
  state: Exclude<MarkState, 'waiting' | 'correctSoFar' | 'skipped'>;
  timeStampMs: number;
}

export interface PracticeMark {
  noteId: NoteId;
  state: MarkState;
}

export type SessionPhase = 'idle' | 'waiting' | 'blocked' | 'finished' | 'interrupted';

export interface LoopRange {
  fromMeasureIndex: number;
  toMeasureIndex: number;
}

/** A stretch of the unrolled timeline (`PlaybackTimeline.passes`): the unambiguous form a loop is stored in (R-06). */
export interface LoopPassSpan {
  fromPassIndex: number;
  toPassIndex: number;
}

export interface ResolvedLoop extends LoopPassSpan {
  fromEventIndex: number;
  toEventIndex: number;
  /** Which time through the range this is, e.g. 2 of 2 in a repeat; null when the range occurs only once (R-06). */
  occurrence: { index: number; count: number } | null;
}

export interface PracticeSession {
  scoreId: string | null;
  selection: HandSelection;
  events: readonly ExpectedEvent[];
  index: number;
  phase: SessionPhase;
  marks: ReadonlyMap<NoteId, MarkState>;
  heldKeys: ReadonlySet<number>;
  /** Accompaniment notes currently sounding, by key, with the tick at which the cursor releases them (R-03). */
  soundingAccompaniment: ReadonlyMap<number, Ticks>;
  wrongAttemptsOnCurrent: number;
  loop: ResolvedLoop | null;
  accompaniment: boolean;
  help: boolean;
  /** Whether help is currently displayed, so `hideHelp` fires exactly once per `showHelp` (R-15). */
  helpShown: boolean;
  log: readonly Attempt[];
}

export interface PracticeInput {
  type:
    | 'noteOn'
    | 'noteOff'
    | 'sustain'
    | 'deviceLost'
    | 'skipNext'
    | 'skipPrevious'
    | 'setAccompaniment'
    | 'setLoop'
    | 'requestHelp';
  key?: number;
  velocity?: number;
  down?: boolean;
  heldKeys?: readonly number[];
  enabled?: boolean; // setAccompaniment
  loop?: ResolvedLoop | null; // setLoop: null clears the loop
  timeStampMs: number;
}

export type PracticeNoticeCode =
  | 'practiceNothingToPlay'
  | 'practiceLoopEmpty'
  | 'practiceMultiKeyboard'
  | 'practiceDeviceLost'
  | 'practiceDeviceBack';

/** A wrong / wrong-octave / extra press has no notehead of its own to mark (T056): only these three states reach
 *  `keyFeedback`; `heldOver` is a required note and is marked on the Score by `markNotes` instead. */
export type WrongKeyState = Extract<MarkState, 'wrongPitch' | 'wrongOctave' | 'extra'>;

export type PracticeEffect =
  | { type: 'markNotes'; marks: readonly { noteId: NoteId; state: MarkState }[] }
  | { type: 'moveCursor'; eventIndex: number; onsetTick: Ticks }
  | { type: 'soundOn'; key: number; noteIds: readonly NoteId[]; velocity: number }
  | { type: 'soundOff'; key: number }
  | { type: 'showHelp'; eventIndex: number; reason: 'stuck' | 'requested' | 'heldOver' }
  | { type: 'hideHelp' }
  | { type: 'notice'; code: PracticeNoticeCode }
  | { type: 'keyFeedback'; key: number; state: WrongKeyState; messageId?: string }
  | { type: 'sessionEnded'; reason: 'reachedEnd' | 'stopped' };

export interface StartOptions {
  scoreId: string | null;
  /** The part and staves the events were built for; the view dims the rest (FR-032). */
  selection?: HandSelection;
  events: readonly ExpectedEvent[];
  startEventIndex: number;
  loop: ResolvedLoop | null;
  accompaniment: boolean;
  help: boolean;
}

export interface SessionStep {
  session: PracticeSession;
  effects: readonly PracticeEffect[];
}
