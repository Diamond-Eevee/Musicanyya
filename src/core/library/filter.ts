import { buildSectionTree, flattenSectionTree } from './tree.js';
import type { LibraryFilter, LibraryItem, LibrarySection } from './types.js';
import { STEP_RANK } from './types.js';

/** NFD-normalise and drop combining marks, so "zyczenie" finds "Życzenie" and "fur elise" finds
 *  "Für Elise" (contracts/library-port.md §3, spec edge case). Case folding piggybacks on the same
 *  normalised form. */
function foldText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function matchesText(item: LibraryItem, needle: string): boolean {
  if (needle === '') return true;
  const folded = foldText(needle);
  const haystack = foldText(`${item.meta.title} ${item.meta.composer ?? ''}`);
  return haystack.includes(folded);
}

function matchesFilter(item: LibraryItem, filter: LibraryFilter): boolean {
  // A section filter covers the folder and everything below it (feature 011: Keys holds 24 folders of items).
  if (
    filter.sectionId !== null &&
    item.section !== filter.sectionId &&
    !item.section.startsWith(`${filter.sectionId}/`)
  ) {
    return false;
  }
  if (filter.level !== null && item.meta.level !== filter.level) return false;
  if (filter.key !== null && !item.facts.keys.includes(filter.key)) return false;
  if (filter.tag !== null && !item.meta.tags.includes(filter.tag)) return false;
  if (!matchesText(item, filter.text)) return false;
  return true;
}

/** Items without a step sort after every step of their folder. */
const NO_STEP_RANK = Number.MAX_SAFE_INTEGER;

/** Pure filtering and sorting (contracts/library-port.md 1.2.0 §2, §3): sorted depth first by the section tree, then inside
 *  a section by step rank (introduction ... song, no step last), `stepOrder`, and title under `compare` - the core stays
 *  Web-API-free, so the caller supplies an `Intl.Collator`-backed comparator rather than this module constructing one itself
 *  (Principle V). Items in a section the index does not list sort after the rest. */
export function filterItems(
  items: readonly LibraryItem[],
  sections: readonly LibrarySection[],
  filter: LibraryFilter,
  compare: (a: string, b: string) => number,
): readonly LibraryItem[] {
  const treeOrder = new Map<string, number>();
  flattenSectionTree(buildSectionTree(sections, items)).forEach((section, index) => {
    treeOrder.set(section.id, index);
  });
  const rankOf = (item: LibraryItem): number =>
    item.meta.step === undefined ? NO_STEP_RANK : STEP_RANK[item.meta.step];

  return items
    .filter((item) => matchesFilter(item, filter))
    .slice()
    .sort((a, b) => {
      const orderA = treeOrder.get(a.section) ?? Number.MAX_SAFE_INTEGER;
      const orderB = treeOrder.get(b.section) ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      const rankA = rankOf(a);
      const rankB = rankOf(b);
      if (rankA !== rankB) return rankA - rankB;
      const stepOrderA = a.meta.stepOrder ?? 0;
      const stepOrderB = b.meta.stepOrder ?? 0;
      if (stepOrderA !== stepOrderB) return stepOrderA - stepOrderB;
      return compare(a.meta.title, b.meta.title);
    });
}
