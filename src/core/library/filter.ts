import type { LibraryFilter, LibraryItem, LibrarySection } from './types.js';

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
  if (filter.sectionId !== null && item.section !== filter.sectionId) return false;
  if (filter.level !== null && item.meta.level !== filter.level) return false;
  if (filter.key !== null && !item.facts.keys.includes(filter.key)) return false;
  if (filter.tag !== null && !item.meta.tags.includes(filter.tag)) return false;
  if (!matchesText(item, filter.text)) return false;
  return true;
}

/** Pure filtering and sorting (contracts/library-port.md §3): sorted by section order, then title
 *  under `compare` - the core stays Web-API-free, so the caller supplies an `Intl.Collator`-backed
 *  comparator rather than this module constructing one itself (Principle V). */
export function filterItems(
  items: readonly LibraryItem[],
  sections: readonly LibrarySection[],
  filter: LibraryFilter,
  compare: (a: string, b: string) => number,
): readonly LibraryItem[] {
  const orderBySection = new Map<string, number>();
  for (const section of sections) orderBySection.set(section.id, section.order);

  return items
    .filter((item) => matchesFilter(item, filter))
    .slice()
    .sort((a, b) => {
      const orderA = orderBySection.get(a.section) ?? 0;
      const orderB = orderBySection.get(b.section) ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return compare(a.meta.title, b.meta.title);
    });
}
