import type { GradeMarkRef, GradeMarkSet } from '../../core/grade/marks.js';
import type { Grade } from '../../core/grade/types.js';
import type { PlayRun, RunSettings } from '../../core/play/types.js';
import type { HandSelection } from '../../core/practice/types.js';
import type { NoteId } from '../../core/score/model.js';
import type { StoredPerformanceSummary } from '../../engine/ports.js';
import { createStore } from './store.js';

/** What the musician can configure before starting a Play run (US3, T066). */
export interface PlaySetup {
  /** Parts available, same structure as PracticeSetup. */
  parts: readonly { partIndex: number; name: string; staves: number }[];
  /** Hand options for the currently selected part. */
  hands: readonly HandSelection[];
  /** Number of written measures in the Score. */
  measureCount: number;
  /** Currently chosen run settings (mutated by the panel events). */
  settings: RunSettings;
}

/** The run and Grade state for the UI (T040): populated while a Play run is live and once it has been graded. */
export interface PlayState {
  run: PlayRun | null;
  grade: Grade | null;
  /** The play setup (T066): the settings panel reflects this; null before a Score is loaded. */
  setup: PlaySetup | null;
  /** What the Score shows for the Grade (009 R-06): computed once per Grade by the session, read by the view, the panel and
   *  the stepper; null while there is no Grade or no Score to place it on. */
  marks: GradeMarkSet | null;
  /** The mark the musician clicked on the Score or stepped to, if any (T042, FR-030): `mx-grade-panel` explains it in words. */
  selectedMark: GradeMarkRef | null;
  /** Every notehead the run's cheap live pitch test has matched so far (T044, FR-011); replaced by `grade`'s own
   *  marks once the run is graded (FR-011a). */
  liveMarkedNoteIds: ReadonlySet<NoteId>;
  /** Kept attempts for the open Score, newest first (US4, T076); empty before a Score is loaded or stored. */
  attempts: readonly StoredPerformanceSummary[];
}

const EMPTY: ReadonlySet<NoteId> = new Set();

class PlayStateStore {
  private store = createStore<PlayState>({
    run: null,
    grade: null,
    setup: null,
    marks: null,
    selectedMark: null,
    liveMarkedNoteIds: EMPTY,
    attempts: [],
  });

  get(): PlayState {
    return this.store.get();
  }

  subscribe(listener: (state: PlayState) => void) {
    return this.store.subscribe(listener);
  }

  setRun(run: PlayRun | null) {
    this.store.update((state) => ({ ...state, run }));
  }

  setSetup(setup: PlaySetup | null) {
    this.store.update((state) => ({ ...state, setup }));
  }

  setAttempts(attempts: readonly StoredPerformanceSummary[]) {
    this.store.update((state) => ({ ...state, attempts }));
  }

  updateSettings(settings: Partial<RunSettings>) {
    this.store.update((state) => {
      if (!state.setup) return state;
      return { ...state, setup: { ...state.setup, settings: { ...state.setup.settings, ...settings } } };
    });
  }

  /** FR-011a: the Grade replaces whatever the live marker showed during the run. `marks` is what the Score shows for it. */
  setGrade(grade: Grade | null, marks: GradeMarkSet | null = null) {
    this.store.update((state) => ({ ...state, grade, marks, selectedMark: null, liveMarkedNoteIds: EMPTY }));
  }

  selectMark(ref: GradeMarkRef | null) {
    this.store.update((state) => ({ ...state, selectedMark: ref }));
  }

  addLiveMark(noteIds: readonly NoteId[]) {
    if (noteIds.length === 0) return;
    this.store.update((state) => {
      const next = new Set(state.liveMarkedNoteIds);
      for (const id of noteIds) next.add(id);
      return { ...state, liveMarkedNoteIds: next };
    });
  }

  /** FR-035: the result layer is cleared when a new run starts or the mode changes. Keeps `setup`. */
  clear() {
    this.store.update((state) =>
      state.run === null &&
      state.grade === null &&
      state.marks === null &&
      state.selectedMark === null &&
      state.liveMarkedNoteIds.size === 0
        ? state
        : { ...state, run: null, grade: null, marks: null, selectedMark: null, liveMarkedNoteIds: EMPTY },
    );
  }
}

export const playState = new PlayStateStore();

if (typeof window !== 'undefined') {
  // e2e/manual-debugging seam only, same treatment as `practiceState`'s own `__PRACTICE_STATE__`.
  (window as Window & { __PLAY_STATE__?: typeof playState }).__PLAY_STATE__ = playState;
}
