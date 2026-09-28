/** data-model.md section 7 - folder, search, filter and sort over `BrowserItem[]`. Pure (Principle V): no DOM, no
 *  Web API. */
import { BROWSER_SEARCH_MAX_CHARS } from '../defaults.js';
import { compareFigures } from '../progress/compare.js';
import type { BrowserItem, BrowserViewState, FolderSel, StatusFilter } from './types.js';

function foldText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** A non-empty search searches every folder; the rail still shows `view.folder` selected, and it applies again once
 *  the search is cleared (data-model.md section 7, US1 #4). */
export function effectiveFolder(view: Pick<BrowserViewState, 'folder' | 'search'>): FolderSel {
  return view.search.trim() === '' ? view.folder : { kind: 'all' };
}

/** Contracts/score-browser.md §1: the *Continue* view replaces the list only for the Continue folder with no search. */
export function showsContinue(view: Pick<BrowserViewState, 'folder' | 'search'>): boolean {
  return effectiveFolder(view).kind === 'continue';
}

function inFolder(item: BrowserItem, folder: FolderSel): boolean {
  switch (folder.kind) {
    case 'continue':
    case 'all':
      return true;
    case 'myFiles':
      return item.ref.kind === 'file';
    case 'section':
      return item.sectionId === folder.id || (item.sectionId?.startsWith(`${folder.id}/`) ?? false);
    default:
      return true;
  }
}

function matchesSearch(item: BrowserItem, terms: readonly string[]): boolean {
  return terms.every((term) => item.searchText.includes(term));
}

/** FR-027: `notMastered` is every status but *Mastered* (*New* items included); `playedNotMastered` is the "needs
 *  work" set of the US5 Independent Test - attempted, and not yet mastered. */
function matchesStatus(item: BrowserItem, status: StatusFilter): boolean {
  const own = item.progress.status;
  switch (status) {
    case 'notMastered':
      return own !== 'mastered';
    case 'playedNotMastered':
      return own === 'played';
    default:
      return own === status;
  }
}

/** Level, key, skill (`tag`) and status combine with AND. A *My files* row has no level, keys or tags (data-model.md
 *  section 6), so it matches none of those three filters; the status filter applies to it like any other row. */
function matchesFilters(item: BrowserItem, filters: BrowserViewState['filters']): boolean {
  if (filters.level !== null && item.level !== filters.level) return false;
  if (filters.key !== null && !item.keys.includes(filters.key)) return false;
  if (filters.tag !== null && !item.tags.includes(filters.tag)) return false;
  return filters.status === null || matchesStatus(item, filters.status);
}

function compareByLibraryOrder(a: BrowserItem, b: BrowserItem): number {
  return a.libraryOrder - b.libraryOrder;
}

/** Sorts by a key that some rows do not have: rows without one go last in both directions (data-model.md section
 *  7), and ties keep library order whatever the direction, so the result never depends on the sort's stability. */
function compareOptional<T>(
  a: T | null,
  b: T | null,
  dir: 1 | -1,
  cmp: (x: T, y: T) => number,
  rowA: BrowserItem,
  rowB: BrowserItem,
): number {
  if (a === null || b === null) {
    if (a === b) return compareByLibraryOrder(rowA, rowB);
    return a === null ? 1 : -1;
  }
  const order = cmp(a, b);
  return order !== 0 ? dir * order : compareByLibraryOrder(rowA, rowB);
}

function playedTime(item: BrowserItem): number | null {
  const at = item.progress.lastPlayedAt;
  if (at === null) return null;
  const time = Date.parse(at);
  return Number.isNaN(time) ? null : time;
}

function sortRows(
  rows: BrowserItem[],
  sort: BrowserViewState['sort'],
  compare: (a: string, b: string) => number,
): BrowserItem[] {
  const dir = sort.dir === 'asc' ? 1 : -1;
  const sorted = rows.slice();
  switch (sort.by) {
    case 'library':
      sorted.sort((a, b) => dir * compareByLibraryOrder(a, b));
      return sorted;
    case 'title':
      sorted.sort((a, b) => {
        const byTitle = compare(a.title, b.title);
        return byTitle !== 0 ? dir * byTitle : compareByLibraryOrder(a, b);
      });
      return sorted;
    case 'lastPlayed':
      sorted.sort((a, b) => compareOptional(playedTime(a), playedTime(b), dir, (x, y) => x - y, a, b));
      return sorted;
    case 'best':
      // The two figures only, exactly (compareFigures): no `finishedAt` tie-break, so two equal bests stay in
      // library order rather than ordering by which was reached first.
      sorted.sort((a, b) => compareOptional(a.progress.best, b.progress.best, dir, compareFigures, a, b));
      return sorted;
    default:
      return sorted;
  }
}

/** data-model.md section 7: folder -> search -> filters -> sort. */
export function queryBrowser(
  items: readonly BrowserItem[],
  view: BrowserViewState,
  compare: (a: string, b: string) => number,
): { rows: BrowserItem[]; total: number } {
  const folder = effectiveFolder(view);
  const search = view.search.slice(0, BROWSER_SEARCH_MAX_CHARS);
  const terms = foldText(search)
    .split(/\s+/)
    .filter((t) => t.length > 0);

  const filtered = items.filter(
    (item) => inFolder(item, folder) && matchesSearch(item, terms) && matchesFilters(item, view.filters),
  );
  const rows = sortRows(filtered, view.sort, compare);
  return { rows, total: rows.length };
}
