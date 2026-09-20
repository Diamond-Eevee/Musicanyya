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

export interface ResolvedLoop {
  fromEventIndex: number;
  toEventIndex: number;
  passLabel: string | null;
}

export interface PracticeSession {
  scoreId: string | null;
  selection: HandSelection;
  events: readonly ExpectedEvent[];
  index: number;
  phase: SessionPhase;
  marks: ReadonlyMap<NoteId, MarkState>;
  heldKeys: ReadonlySet<number>;
  wrongAttemptsOnCurrent: number;
  loop: ResolvedLoop | null;
  accompaniment: boolean;
  help: boolean;
  log: readonly Attempt[];
}

export interface PracticeInput {
  type: 'noteOn' | 'noteOff' | 'sustain' | 'deviceLost' | 'skipNext' | 'skipPrevious';
  key?: number;
  velocity?: number;
  down?: boolean;
  heldKeys?: readonly number[];
  timeStampMs: number;
}

export type PracticeNoticeCode =
  | 'practiceNothingToPlay'
  | 'practiceLoopEmpty'
  | 'practiceMultiKeyboard'
  | 'practiceDeviceLost'
  | 'practiceDeviceBack';

export type PracticeEffect =
  | { type: 'markNotes'; marks: readonly { noteId: NoteId; state: MarkState }[] }
  | { type: 'moveCursor'; eventIndex: number; onsetTick: Ticks }
  | { type: 'soundOn'; key: number; noteIds: readonly NoteId[] }
  | { type: 'soundOff'; key: number }
  | { type: 'showHelp'; eventIndex: number; reason: 'stuck' | 'requested' | 'heldOver' }
  | { type: 'hideHelp' }
  | { type: 'notice'; code: PracticeNoticeCode }
  | { type: 'sessionEnded'; reason: 'reachedEnd' | 'stopped' };
