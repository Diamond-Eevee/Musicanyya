/** data-model.md §6 "Folder progress" - per-section played/mastered/total counts, summed over each subtree, plus
 *  one entry for *My files*. Pure (Principle V): no DOM, no Web API. */
import type { SectionNode } from '../library/tree.js';
import type { BrowserItem } from './types.js';

export interface FolderCounts {
  played: number; // `played` or `mastered` (FR-014: "5 of 8 played, 2 mastered" reads naturally)
  mastered: number;
  total: number;
}

/** Not a real library section id, so it can never collide with one - the key `folderProgress` uses for the
 *  fixed *My files* bucket (data-model.md §6). */
export const MY_FILES_FOLDER_KEY = 'myFiles';

function emptyCounts(): FolderCounts {
  return { played: 0, mastered: 0, total: 0 };
}

function bump(counts: Map<string, FolderCounts>, key: string, item: BrowserItem): void {
  const c = counts.get(key) ?? emptyCounts();
  c.total += 1;
  if (item.progress.status === 'played' || item.progress.status === 'mastered') c.played += 1;
  if (item.progress.status === 'mastered') c.mastered += 1;
  counts.set(key, c);
}

/** The tree's own parent links (not a section's raw `parent` field, which `buildSectionTree` may have overridden
 *  to null for an unknown or self-referencing value) - so a walk up from a leaf never follows a link the tree
 *  itself did not keep. */
function collectParents(
  nodes: readonly SectionNode[],
  parentId: string | null,
  into: Map<string, string | null>,
): void {
  for (const node of nodes) {
    into.set(node.section.id, parentId);
    collectParents(node.children, node.section.id, into);
  }
}

/** `{played, mastered, total}` for every section id in `tree`, counting every item in its subtree (invariant US2
 *  #6: a folder's figures equal the sum over its items), plus one entry keyed `MY_FILES_FOLDER_KEY`. */
export function folderProgress(
  tree: readonly SectionNode[],
  items: readonly BrowserItem[],
): ReadonlyMap<string, FolderCounts> {
  const parentOf = new Map<string, string | null>();
  collectParents(tree, null, parentOf);

  const counts = new Map<string, FolderCounts>();
  for (const item of items) {
    if (item.sectionId === null) {
      bump(counts, MY_FILES_FOLDER_KEY, item);
      continue;
    }
    let current: string | null = item.sectionId;
    const seen = new Set<string>();
    while (current !== null && !seen.has(current) && parentOf.has(current)) {
      seen.add(current);
      bump(counts, current, item);
      current = parentOf.get(current) ?? null;
    }
  }
  return counts;
}
