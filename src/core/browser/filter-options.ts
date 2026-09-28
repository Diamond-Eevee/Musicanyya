/** FR-027 - the values the browser's key and skill filters offer. Pure (Principle V): no DOM, no Web API. */
import type { SkillTag } from '../library/types.js';
import type { BrowserItem } from './types.js';

/** Every key and skill that some row has, once each and sorted with the caller's comparator (the same
 *  `Intl.Collator`-backed one `queryBrowser` takes), so a filter never offers a value that lists nothing. */
export function filterOptions(
  items: readonly BrowserItem[],
  compare: (a: string, b: string) => number,
): { keys: string[]; tags: SkillTag[] } {
  const keys = new Set<string>();
  const tags = new Set<SkillTag>();
  for (const item of items) {
    for (const key of item.keys) keys.add(key);
    for (const tag of item.tags) tags.add(tag);
  }
  return { keys: Array.from(keys).sort(compare), tags: Array.from(tags).sort(compare) };
}
