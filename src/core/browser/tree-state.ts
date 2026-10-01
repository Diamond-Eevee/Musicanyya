/** 018 data-model.md §2 - the rail's open/closed folders as pure helpers over `BrowserViewState.expanded` (section
 *  ids, sorted and unique). Pure (Principle V): no DOM, no Web API; `browserState` stores the result and
 *  `mx-browser-rail` renders it. */

import { BROWSER_EXPANDED_MAX } from '../defaults.js';
import type { LibrarySection } from '../library/types.js';
import type { FolderSel } from './types.js';

function sortedUnique(ids: Iterable<string>): string[] {
  return Array.from(new Set(ids)).sort();
}

/** Validates a stored `expanded` (R-3). With sections known, an id that is not a current one becomes the section that
 *  lists it in `formerIds`, or is dropped; with none known (index not loaded, library unavailable) the ids are kept so
 *  an outage never erases the tree state. At most `BROWSER_EXPANDED_MAX` entries are kept (the first ones). */
export function validateExpanded(raw: unknown, sections: readonly LibrarySection[]): string[] {
  if (!Array.isArray(raw)) return [];
  const ids = raw.filter((v): v is string => typeof v === 'string').slice(0, BROWSER_EXPANDED_MAX);
  if (sections.length === 0) return sortedUnique(ids);

  const current = new Set(sections.map((s) => s.id));
  const resolved: string[] = [];
  for (const id of ids) {
    if (current.has(id)) {
      resolved.push(id);
      continue;
    }
    const replacement = sections.find((s) => s.formerIds?.includes(id));
    if (replacement) resolved.push(replacement.id);
  }
  return sortedUnique(resolved);
}

export function isExpanded(expanded: readonly string[], sectionId: string): boolean {
  return expanded.includes(sectionId);
}

/** Adds or removes one id; the same array instance when nothing changes, so callers can skip persisting. */
export function setExpanded(expanded: readonly string[], sectionId: string, open: boolean): readonly string[] {
  if (isExpanded(expanded, sectionId) === open) return expanded;
  return open ? sortedUnique([...expanded, sectionId]) : expanded.filter((id) => id !== sectionId);
}

/** The parent chain of a section, root first, without the section itself. Stops at an unknown parent and at a parent
 *  cycle, as `buildSectionTree` does. */
export function ancestorsOf(sectionId: string, sections: readonly LibrarySection[]): string[] {
  const byId = new Map(sections.map((s) => [s.id, s]));
  const seen = new Set([sectionId]);
  const chain: string[] = [];
  let parent = byId.get(sectionId)?.parent ?? null;
  while (parent !== null && byId.has(parent) && !seen.has(parent)) {
    chain.push(parent);
    seen.add(parent);
    parent = byId.get(parent)?.parent ?? null;
  }
  return chain.reverse();
}

/** `expanded` plus the ancestors of `sectionId` (R-4); the same array instance when they are all present already. */
export function revealPath(
  expanded: readonly string[],
  sectionId: string,
  sections: readonly LibrarySection[],
): readonly string[] {
  const missing = ancestorsOf(sectionId, sections).filter((id) => !isExpanded(expanded, id));
  return missing.length === 0 ? expanded : sortedUnique([...expanded, ...missing]);
}

/** True when `chosen` is a section strictly below `sectionId` (R-7: the marker on a collapsed ancestor). */
export function containsChosen(sectionId: string, chosen: FolderSel, sections: readonly LibrarySection[]): boolean {
  return chosen.kind === 'section' && ancestorsOf(chosen.id, sections).includes(sectionId);
}
