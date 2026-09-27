/** data-model.md section 6 - builds the browser's rows from the library index, *My files* and progress. Pure
 *  (Principle V): no DOM, no Web API. */
import { buildSectionTree, flattenSectionTree } from '../library/tree.js';
import type { LibraryIndex, LibraryItem, LibrarySection } from '../library/types.js';
import { STEP_RANK } from '../library/types.js';
import type { MasteryThresholds, ProgressRecord, UserFileEntry } from '../progress/types.js';
import type { BrowserItem, ItemProgressView } from './types.js';

/** Items without a step sort after every step of their folder (mirrors src/core/library/filter.ts). */
const NO_STEP_RANK = Number.MAX_SAFE_INTEGER;

/** NFD-normalise and drop combining marks, so "elise" finds "Élise" (FR-026, same rule as library search). */
function foldText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function folderPathOf(sectionId: string, sections: readonly LibrarySection[]): string[] {
  const byId = new Map(sections.map((s) => [s.id, s]));
  const path: string[] = [];
  let current = byId.get(sectionId);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current.title);
    current = current.parent === null ? undefined : byId.get(current.parent);
  }
  return path;
}

function subtitleOf(meta: { composer?: string | null; arranger?: string | null }): string | null {
  if (meta.composer && meta.arranger) return `${meta.composer} (arr. ${meta.arranger})`;
  if (meta.composer) return meta.composer;
  if (meta.arranger) return `arr. ${meta.arranger}`;
  return null;
}

/** Every row starts *New* (no attempts, no history): the progress merge (records/thresholds) lands in T053, once
 *  `src/core/progress/status.ts` exists (US2). */
function emptyProgressView(): ItemProgressView {
  return { status: 'new', best: null, last: null, trend: null, attempts: 0, lastPlayedAt: null, history: [] };
}

function libraryRow(item: LibraryItem, sections: readonly LibrarySection[], libraryOrder: number): BrowserItem {
  const folderPath = folderPathOf(item.section, sections);
  const searchText = foldText(
    [item.meta.title, item.meta.composer ?? '', item.meta.arranger ?? '', ...folderPath].join(' '),
  );
  return {
    ref: { kind: 'library', id: item.id },
    scoreKey: item.hash,
    title: item.meta.title,
    subtitle: subtitleOf(item.meta),
    folderPath,
    sectionId: item.section,
    level: item.meta.level,
    keys: item.facts.keys,
    tags: item.meta.tags,
    durationSeconds: item.facts.durationSeconds,
    measures: item.facts.measures,
    step: item.meta.step ?? null,
    stepOrder: item.meta.stepOrder ?? null,
    libraryOrder,
    searchText,
    progress: emptyProgressView(),
    stored: true,
  };
}

function fileRow(entry: UserFileEntry, libraryOrder: number): BrowserItem {
  const title = entry.title ?? entry.fileName;
  const searchText = foldText([title, entry.composer ?? '', entry.fileName, 'My files'].join(' '));
  return {
    ref: { kind: 'file', fileKey: entry.fileKey },
    scoreKey: entry.hash,
    title,
    subtitle: entry.title ? entry.fileName : (entry.composer ?? null),
    folderPath: ['My files'],
    sectionId: null,
    level: null,
    keys: [],
    tags: [],
    durationSeconds: null,
    measures: null,
    step: null,
    stepOrder: null,
    libraryOrder,
    searchText,
    progress: emptyProgressView(),
    stored: entry.stored,
  };
}

/** data-model.md section 6, R-13. `records` and `thresholds` are accepted now so the signature will not change
 *  again when T053 wires progress in; until then every row's progress is `emptyProgressView()`. `compare` is the
 *  caller-supplied `Intl.Collator`-backed comparator `filterItems` takes (library-port.md §2): it only breaks a
 *  title tie within one folder/step, so `libraryOrder` matches 011's panel order exactly (found while implementing
 *  this task: a title starting with a lower-case letter or punctuation, e.g. "l'Arabesque ...", sorts differently
 *  under plain ordinal comparison than under a real collator). */
export function buildBrowserItems(
  index: LibraryIndex | null,
  files: readonly UserFileEntry[],
  _records: readonly ProgressRecord[],
  _thresholds: MasteryThresholds,
  compare: (a: string, b: string) => number,
): BrowserItem[] {
  const items: BrowserItem[] = [];
  if (index) {
    const treeOrder = new Map<string, number>();
    flattenSectionTree(buildSectionTree(index.sections, index.items)).forEach((section, i) => {
      treeOrder.set(section.id, i);
    });
    const rankOf = (item: LibraryItem): number =>
      item.meta.step === undefined ? NO_STEP_RANK : STEP_RANK[item.meta.step];

    const ordered = index.items.slice().sort((a, b) => {
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
    ordered.forEach((item, i) => {
      items.push(libraryRow(item, index.sections, i));
    });
  }
  const base = index?.items.length ?? 0;
  files.forEach((entry, i) => {
    items.push(fileRow(entry, base + i));
  });
  return items;
}
