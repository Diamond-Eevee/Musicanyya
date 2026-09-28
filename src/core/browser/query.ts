/** data-model.md section 7 - folder, search, filter and sort over `BrowserItem[]`. Pure (Principle V): no DOM, no
 *  Web API. Filters other than folder/search and the `lastPlayed`/`best` sorts are added in T082 (US5). */
import { BROWSER_SEARCH_MAX_CHARS } from '../defaults.js';
import type { BrowserItem, BrowserViewState, FolderSel } from './types.js';

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

function compareByLibraryOrder(a: BrowserItem, b: BrowserItem): number {
  return a.libraryOrder - b.libraryOrder;
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
    // 'lastPlayed' and 'best' land in T082 (US5); until then the caller never sets them, so falling back to
    // library order is safe and deterministic.
    case 'lastPlayed':
    case 'best':
      sorted.sort(compareByLibraryOrder);
      return sorted;
    default:
      return sorted;
  }
}

/** data-model.md section 7: folder -> search -> filters (T082) -> sort. */
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

  const filtered = items.filter((item) => inFolder(item, folder) && matchesSearch(item, terms));
  const rows = sortRows(filtered, view.sort, compare);
  return { rows, total: rows.length };
}
