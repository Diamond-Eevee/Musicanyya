/** data-model.md section 9, R-10, FR-025 - the *Continue* list, *Suggested next* and *More practice*. Pure
 *  (Principle V): no DOM, no Web API. The folder structure stays owned by the library content: the order of steps is
 *  read from each item's `step`/`stepOrder` and its position (`libraryOrder`), never from a table here. */
import type { BrowserItem, Suggestion } from '../browser/types.js';
import { CONTINUE_ITEMS_MAX, MORE_PRACTICE_AFTER_RUNS } from '../defaults.js';
import { flattenSectionTree, type SectionNode } from '../library/tree.js';
import { STEP_RANK } from '../library/types.js';
import { type ItemRef, itemRefKey, type ProgressRecord } from './types.js';

/** The section a musician with no history is pointed to (US4 #3): *Repertoire > Beginner*. Content, so it is looked
 *  up in the tree and left out (`null`) when the library no longer has it. */
export const REPERTOIRE_BEGINNER_SECTION_ID = 'repertoire/beginner';

/** One card of *Continue*: the item and when it was last opened (its own `progress` gives status, best, last played). */
export interface ContinueEntry {
  item: BrowserItem;
  lastOpenedAt: string;
}

function byNewest(a: ContinueEntry, b: ContinueEntry): number {
  const byDate = Date.parse(b.lastOpenedAt) - Date.parse(a.lastOpenedAt);
  return byDate !== 0 ? byDate : a.item.libraryOrder - b.item.libraryOrder;
}

/** Every opened item still in `items`, newest first, one entry per item (an older content hash and the current one
 *  of the same item both point at it through `openedAs`). A record whose item no longer exists is skipped. */
function recentEntries(items: readonly BrowserItem[], records: readonly ProgressRecord[]): ContinueEntry[] {
  const byRef = new Map(items.map((item) => [itemRefKey(item.ref), item]));
  const newest = new Map<string, ContinueEntry>();
  for (const record of records) {
    if (record.lastOpenedAt === null || record.openedAs === null) continue;
    const item = byRef.get(itemRefKey(record.openedAs));
    if (item === undefined) continue;
    const key = itemRefKey(item.ref);
    const seen = newest.get(key);
    if (seen === undefined || Date.parse(record.lastOpenedAt) > Date.parse(seen.lastOpenedAt)) {
      newest.set(key, { item, lastOpenedAt: record.lastOpenedAt });
    }
  }
  return [...newest.values()].sort(byNewest);
}

/** FR-025, US4 #1: up to `CONTINUE_ITEMS_MAX` recently opened items, newest first. */
export function continueItems(items: readonly BrowserItem[], records: readonly ProgressRecord[]): ContinueEntry[] {
  return recentEntries(items, records).slice(0, CONTINUE_ITEMS_MAX);
}

const isStepped = (item: BrowserItem): boolean => item.step !== null && item.sectionId !== null;
/** A step's main exercise: `stepOrder` 0 (contracts/library-index.md 1.2.0); songs are not steps of the ladder. */
const isMain = (item: BrowserItem): boolean =>
  item.step !== null && item.step !== 'song' && (item.stepOrder ?? 0) === 0;
/** More practice at a step: `stepOrder` 10 and up. Never on the main path (R-10). */
const isExtra = (item: BrowserItem): boolean =>
  item.step !== null && item.step !== 'song' && (item.stepOrder ?? 0) !== 0;
const isSong = (item: BrowserItem): boolean => item.step === 'song';
const isMastered = (item: BrowserItem): boolean => item.progress.status === 'mastered';
const rankOf = (item: BrowserItem): number => (item.step === null ? -1 : STEP_RANK[item.step]);

/** The most recently opened item of a stepped folder: what *Suggested next* and *More practice* are about. */
function anchorOf(items: readonly BrowserItem[], records: readonly ProgressRecord[]): BrowserItem | null {
  return recentEntries(items, records).find((entry) => isStepped(entry.item))?.item ?? null;
}

interface SteppedFolder {
  sectionId: string;
  main: BrowserItem[]; // by library order = step rank
  songs: BrowserItem[];
}

/** The stepped folders in library order (depth-first section order, 011). */
function steppedFolders(items: readonly BrowserItem[]): SteppedFolder[] {
  const folders = new Map<string, SteppedFolder>();
  for (const item of [...items].sort((a, b) => a.libraryOrder - b.libraryOrder)) {
    if (!isStepped(item) || item.sectionId === null) continue;
    let folder = folders.get(item.sectionId);
    if (folder === undefined) {
      folder = { sectionId: item.sectionId, main: [], songs: [] };
      folders.set(item.sectionId, folder);
    }
    if (isMain(item)) folder.main.push(item);
    else if (isSong(item)) folder.songs.push(item);
  }
  return [...folders.values()];
}

/** The folder's next step after the main step of rank `afterRank` (`null` = from the start): the first unmastered
 *  main step above it, then the first unmastered song. Extras are never offered here. */
function nextInFolder(folder: SteppedFolder, afterRank: number | null): BrowserItem | null {
  const main = folder.main.find((item) => !isMastered(item) && (afterRank === null || rankOf(item) > afterRank));
  return main ?? folder.songs.find((item) => !isMastered(item)) ?? null;
}

/** FR-025, R-10. From the most recent stepped item: not mastered -> continue it; mastered -> the next step above the
 *  highest mastered main step (a musician who skipped Introduction is not sent back to it), then the folder's songs,
 *  then the next key folder in library order, skipping fully mastered folders. When nothing lies ahead it wraps to
 *  the earlier folders, and `none` means every stepped item is mastered. Without any stepped history: the first main
 *  step of the first folder plus the pointer to *Repertoire > Beginner* (US4 #3). */
export function suggestNext(
  items: readonly BrowserItem[],
  records: readonly ProgressRecord[],
  tree: readonly SectionNode[],
): Suggestion {
  const folders = steppedFolders(items);
  const first = folders[0];
  if (first === undefined) return { kind: 'none' };

  const anchor = anchorOf(items, records);
  if (anchor === null) {
    const start = first.main[0] ?? first.songs[0];
    if (start === undefined) return { kind: 'none' };
    const repertoire = flattenSectionTree(tree).some((s) => s.id === REPERTOIRE_BEGINNER_SECTION_ID);
    return {
      kind: 'firstSteps',
      ref: start.ref,
      repertoireSectionId: repertoire ? REPERTOIRE_BEGINNER_SECTION_ID : null,
    };
  }
  if (!isMastered(anchor)) return { kind: 'continue', ref: anchor.ref };

  const at = folders.findIndex((folder) => folder.sectionId === anchor.sectionId);
  const own = folders[at];
  if (own !== undefined) {
    const masteredRanks = own.main.filter(isMastered).map(rankOf);
    const ahead = nextInFolder(own, masteredRanks.length === 0 ? null : Math.max(...masteredRanks));
    if (ahead !== null) return { kind: 'next', ref: ahead.ref, after: anchor.ref };
  }

  const others = [...folders.slice(at + 1), ...folders.slice(0, Math.max(at, 0))];
  const candidates = own === undefined ? others : [...others, own];
  for (const folder of candidates) {
    const next = nextInFolder(folder, null);
    if (next !== null) return { kind: 'next', ref: next.ref, after: anchor.ref };
  }
  return { kind: 'none' };
}

/** R-10: after `MORE_PRACTICE_AFTER_RUNS` whole, complete runs of the most recent stepped item without *Mastered*,
 *  that step's first extra which is not yet mastered. `null` when there is none, or the item is not a main step. */
export function morePractice(items: readonly BrowserItem[], records: readonly ProgressRecord[]): ItemRef | null {
  const anchor = anchorOf(items, records);
  if (anchor === null || !isMain(anchor) || isMastered(anchor)) return null;
  const wholeRuns = anchor.progress.history.filter((r) => r.complete === true && r.scope.kind === 'whole').length;
  if (wholeRuns < MORE_PRACTICE_AFTER_RUNS) return null;
  const extra = [...items]
    .sort((a, b) => a.libraryOrder - b.libraryOrder)
    .find(
      (item) => isExtra(item) && item.sectionId === anchor.sectionId && item.step === anchor.step && !isMastered(item),
    );
  return extra?.ref ?? null;
}
