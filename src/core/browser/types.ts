/** data-model.md sections 6-9 - browser rows, view state and suggestions. Pure data: no DOM, no Web API
 *  (Principle V). */
import type { Level, SkillTag, Step } from '../library/types.js';
import type { ItemRef, ProgressResult } from '../progress/types.js';

export type ProgressStatus = 'new' | 'practised' | 'played' | 'mastered'; // FR-011, data-model.md §3
export type Trend = 'up' | 'down' | 'same' | null; // FR-012, data-model.md §3

/** One result in the detail pane's history: `earlierVersion` is derived when shown, never stored (data-model §5). */
export interface HistoryResult extends ProgressResult {
  earlierVersion: boolean;
}

/** What a browser row shows about its progress (data-model.md §6). */
export interface ItemProgressView {
  status: ProgressStatus;
  best: ProgressResult | null;
  last: ProgressResult | null; // results[0]
  trend: Trend;
  attempts: number;
  lastPlayedAt: string | null;
  history: readonly HistoryResult[]; // newest first, at most PROGRESS_RESULTS_MAX, for the detail pane
}

/** data-model.md §6 - one row of the browser's list. */
export interface BrowserItem {
  ref: ItemRef;
  scoreKey: string;
  title: string; // library meta.title / entry title ?? fileName
  subtitle: string | null; // composer/arranger, or the file name under a title
  folderPath: readonly string[]; // section titles root -> leaf; ['My files'] for files (FR-026)
  sectionId: string | null; // null for My files
  level: Level | null;
  keys: readonly string[]; // facts.keys (library) / [] for files until opened
  tags: readonly SkillTag[];
  durationSeconds: number | null;
  measures: number | null;
  step: Step | null;
  stepOrder: number | null;
  libraryOrder: number; // position in depth-first section order, then in-section order (011)
  searchText: string; // pre-folded: title, composer, arranger, folder names, file name (FR-026)
  progress: ItemProgressView;
  stored: boolean; // files: copy available; library: true
}

/** data-model.md §7 - the folder the rail has selected. */
export type FolderSel = { kind: 'continue' } | { kind: 'all' } | { kind: 'myFiles' } | { kind: 'section'; id: string };

export type StatusFilter = 'new' | 'practised' | 'played' | 'mastered' | 'notMastered' | 'playedNotMastered';

/** data-model.md §7 - persisted `localStorage` `musicanyya.browser.v1` view. */
export interface BrowserViewState {
  folder: FolderSel;
  search: string; // max BROWSER_SEARCH_MAX_CHARS
  filters: {
    level: Level | null;
    key: string | null;
    tag: SkillTag | null;
    status: StatusFilter | null;
  };
  sort: { by: 'library' | 'title' | 'lastPlayed' | 'best'; dir: 'asc' | 'desc' };
  selected: ItemRef | null;
}

/** data-model.md §9 - *Suggested next* (FR-025). */
export type Suggestion =
  | { kind: 'continue'; ref: ItemRef } // most recent stepped item, not mastered (US4 #2)
  | { kind: 'next'; ref: ItemRef; after: ItemRef } // next main step / song / next key folder
  | { kind: 'firstSteps'; ref: ItemRef; repertoireSectionId: string | null } // no history (US4 #3)
  | { kind: 'none' };
