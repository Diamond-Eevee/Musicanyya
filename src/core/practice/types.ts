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
  /** The notes of Orchestra parts (not printed) whose onset lies in [this event's onset, the next event's), like
   *  `accompaniment` but kept apart from it: never required, never marked, never used to judge a key, and sounding whether
   *  or not the Accompaniment setting is on (feature 019, practice-session 1.8.0). */
  orchestra: readonly OrchestraRef[];
}

export interface SoundingRef {
  noteId: NoteId;
  key: number;
  endTick: Ticks;
  velocity: number;
}

/** One Orchestra note occurrence and the channel its instrument plays on. */
export interface OrchestraRef extends SoundingRef {
  channel: number;
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
  /** The held keys that are not written at the current event, with the reason (feature 008, research R-12): what the
   *  Score shows as red discs. Empty when no such key is held, and after the session ends or the keyboard is lost. */
  heldWrongKeys: ReadonlyMap<number, WrongKeyState>;
  /** Accompaniment notes currently sounding, by key, with the tick at which the cursor releases them (R-03). */
  soundingAccompaniment: ReadonlyMap<number, Ticks>;
  /** Orchestra notes currently sounding, by `"<channel>:<key>"`, with the tick at which the cursor releases them (019). */
  soundingOrchestra: ReadonlyMap<string, Ticks>;
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
    | 'requestHelp'
    | 'setHelp';
  key?: number;
  velocity?: number;
  down?: boolean;
  heldKeys?: readonly number[];
  enabled?: boolean; // setAccompaniment, setHelp
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
  /** Start / stop one Orchestra note on its own channel (feature 019): the accompaniment's timing, whatever `accompaniment` is. */
  | { type: 'orchestraOn'; channel: number; key: number; noteId: NoteId; velocity: number }
  | { type: 'orchestraOff'; channel: number; key: number }
  | { type: 'showHelp'; eventIndex: number; reason: 'stuck' | 'requested' | 'heldOver' }
  | { type: 'hideHelp' }
  | { type: 'notice'; code: PracticeNoticeCode }
  | { type: 'keyFeedback'; key: number; state: WrongKeyState; messageId?: string }
  | { type: 'sessionEnded'; reason: 'reachedEnd' | 'stopped' }
  /** The loop wrapped because its last event was played (never from `skipNext`, research.md R-9, feature 013):
   *  one full pass through the loop, source of the `practised` progress event. 1-based written measure numbers. */
  | { type: 'loopCompleted'; fromMeasure: number; toMeasure: number };

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
