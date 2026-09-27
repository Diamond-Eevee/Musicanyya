import type { GradeMarkRef, GradeMarkSet } from '../../core/grade/marks.js';
import type { Grade } from '../../core/grade/types.js';
import type { PlayRun, RunSettings } from '../../core/play/types.js';
import type { HandSelection } from '../../core/practice/types.js';
import type { TempoDisplaySegment } from '../../core/tempo/tempo-display.js';
import type { MeasurePass } from '../../core/timeline/types.js';
import type { StoredPerformanceSummary } from '../../engine/ports.js';
import type { MusicGlyphData } from '../score/verovio-client.js';
import { createStore } from './store.js';

/** The open Score's tempo display map and passes (feature 012, US3): what `attemptTempo` (attempts list, Grade
 *  panel) needs to show a stored run's tempo in its own beat, without either view reaching into session state
 *  (Constitution V - they call the pure core function themselves, given this). Null before a Score loads. */
export interface ScoreTempo {
  map: readonly TempoDisplaySegment[];
  passes: readonly MeasurePass[];
}

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
  /** feature 012, US3, FR-018: the tempo display segment at the run range's start (first pass of its first
   *  measure, else tick 0) - what the Play setup's own tempo field shows and edits. Session-computed (Constitution
   *  V): the panel only renders it. Recomputed whenever the range or the Score changes. */
  tempoSegment: TempoDisplaySegment | null;
  /** Harvested beat-symbol glyphs (012 R-7), the same ones the transport's tempo field draws with. */
  glyphs: MusicGlyphData | null;
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
  /** Kept attempts for the open Score, newest first (US4, T076); empty before a Score is loaded or stored. */
  attempts: readonly StoredPerformanceSummary[];
  /** feature 012, US3: the open Score's tempo display map and passes, for `attemptTempo`; null before a Score loads. */
  scoreTempo: ScoreTempo | null;
  /** FR-016 (013, R-18): whether the current Grade's result would be the open Score's new best - computed before
   *  the run is even stored, from the in-memory record `BrowserSessionController` keeps. False for a stopped or
   *  partial run (OD-1) and whenever there is no Grade. */
  newBest: boolean;
}

class PlayStateStore {
  private store = createStore<PlayState>({
    run: null,
    grade: null,
    setup: null,
    marks: null,
    selectedMark: null,
    attempts: [],
    scoreTempo: null,
    newBest: false,
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

  setScoreTempo(scoreTempo: ScoreTempo | null) {
    this.store.update((state) => ({ ...state, scoreTempo }));
  }

  updateSettings(settings: Partial<RunSettings>) {
    this.store.update((state) => {
      if (!state.setup) return state;
      return { ...state, setup: { ...state.setup, settings: { ...state.setup.settings, ...settings } } };
    });
  }

  /** The Grade, and what the Score shows for it (`marks`): nothing is marked before it (009 FR-027, owner review). */
  setGrade(grade: Grade | null, marks: GradeMarkSet | null = null, newBest = false) {
    this.store.update((state) => ({ ...state, grade, marks, selectedMark: null, newBest }));
  }

  selectMark(ref: GradeMarkRef | null) {
    this.store.update((state) => ({ ...state, selectedMark: ref }));
  }

  /** FR-035: the result layer is cleared when a new run starts or the mode changes. Keeps `setup`. */
  clear() {
    this.store.update((state) =>
      state.run === null &&
      state.grade === null &&
      state.marks === null &&
      state.selectedMark === null &&
      !state.newBest
        ? state
        : { ...state, run: null, grade: null, marks: null, selectedMark: null, newBest: false },
    );
  }
}

export const playState = new PlayStateStore();

if (typeof window !== 'undefined') {
  // e2e/manual-debugging seam only, same treatment as `practiceState`'s own `__PRACTICE_STATE__`.
  (window as Window & { __PLAY_STATE__?: typeof playState }).__PLAY_STATE__ = playState;
}
