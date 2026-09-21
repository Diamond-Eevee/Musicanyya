import type { Grade } from '../../core/grade/types.js';
import type { PlayRun } from '../../core/play/types.js';
import type { NoteId } from '../../core/score/model.js';
import { createStore } from './store.js';

/** The run and Grade state for the UI (T040): populated while a Play run is live and once it has been graded. */
export interface PlayState {
  run: PlayRun | null;
  grade: Grade | null;
  /** The mark the musician clicked on the Score, if any (T042, FR-030): `mx-grade-panel` explains it in words. */
  selectedNoteId: NoteId | null;
  /** Every notehead the run's cheap live pitch test has matched so far (T044, FR-011); replaced by `grade`'s own
   *  marks once the run is graded (FR-011a). */
  liveMarkedNoteIds: ReadonlySet<NoteId>;
}

const EMPTY: ReadonlySet<NoteId> = new Set();

class PlayStateStore {
  private store = createStore<PlayState>({
    run: null,
    grade: null,
    selectedNoteId: null,
    liveMarkedNoteIds: EMPTY,
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

  /** FR-011a: the Grade replaces whatever the live marker showed during the run. */
  setGrade(grade: Grade | null) {
    this.store.update((state) => ({ ...state, grade, selectedNoteId: null, liveMarkedNoteIds: EMPTY }));
  }

  selectNote(noteId: NoteId | null) {
    this.store.update((state) => ({ ...state, selectedNoteId: noteId }));
  }

  addLiveMark(noteIds: readonly NoteId[]) {
    if (noteIds.length === 0) return;
    this.store.update((state) => {
      const next = new Set(state.liveMarkedNoteIds);
      for (const id of noteIds) next.add(id);
      return { ...state, liveMarkedNoteIds: next };
    });
  }

  /** FR-035: the result layer is cleared when a new run starts or the mode changes. */
  clear() {
    this.store.update((state) =>
      state.run === null && state.grade === null && state.selectedNoteId === null && state.liveMarkedNoteIds.size === 0
        ? state
        : { run: null, grade: null, selectedNoteId: null, liveMarkedNoteIds: EMPTY },
    );
  }
}

export const playState = new PlayStateStore();

if (typeof window !== 'undefined') {
  // e2e/manual-debugging seam only, same treatment as `practiceState`'s own `__PRACTICE_STATE__`.
  (window as any).__PLAY_STATE__ = playState;
}
