import type { ElementInsert } from './engraving/index.js';

export interface RenderCopyInserts {
  notes: Array<{ startOffset: number; tagLength: number; id: string }>;
  measures: Array<{ startOffset: number; tagLength: number; id: string }>;
  /** Engraving-completion inserts (accidentals, beams) spliced strictly inside note bodies - they never
   *  overlap a note/measure open tag, so no collision handling is needed against `notes`/`measures`. */
  elements?: ElementInsert[];
}

interface Replacement {
  start: number;
  end: number;
  replacement: string;
}

/** Index of the last tag replacement starting at or before `offset`, or -1. Binary search. */
function lastTagAtOrBefore(tags: Replacement[], offset: number): number {
  let lo = 0;
  let hi = tags.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const tag = tags[mid];
    if (tag !== undefined && tag.start <= offset) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/**
 * Copies the source MusicXML with our own Note IDs and Measure IDs written onto the `<note>` and
 * `<measure>` tags Verovio will engrave, so that every element in the SVG carries the id the rest of
 * the app addresses it by (Constitution III).
 *
 * The copy is assembled in a single pass: the source is cut into slices at the replacement
 * boundaries and joined once. Rebuilding the whole string per replacement, as this used to, is
 * quadratic - a 4.7 MB quartet with ~11 000 inserts spent 22-26 s here, which was the bulk of the
 * time to open a large score (tasks.md T150-T154).
 */
export function createRenderCopy(xml: string, inserts: RenderCopyInserts): string {
  // The tags we rewrite. Note and measure tags never overlap - a `<measure ...>` start tag ends
  // before the first `<note>` inside it - so sorting by start is enough to walk them in order.
  const tags: Replacement[] = [];
  const usedIds = new Set<string>();

  for (const note of inserts.notes) {
    usedIds.add(note.id);
    const end = note.startOffset + note.tagLength;
    tags.push({
      start: note.startOffset,
      end,
      replacement: replaceIdInTag(xml.substring(note.startOffset, end), note.id),
    });
  }

  for (const measure of inserts.measures) {
    usedIds.add(measure.id);
    const end = measure.startOffset + measure.tagLength;
    tags.push({
      start: measure.startOffset,
      end,
      replacement: replaceIdInTag(xml.substring(measure.startOffset, end), measure.id),
    });
  }

  tags.sort((a, b) => a.start - b.start);

  // An id already in the source that collides with one of ours would make the SVG ambiguous. Drop
  // it, unless it sits inside a tag we are rewriting anyway - `replaceIdInTag` has already dealt
  // with that one. The enclosing tag is found by binary search rather than by scanning every
  // replacement, which was the other quadratic term here.
  const collisions: Replacement[] = [];
  const allIdsPattern = /\s+id\s*=\s*['"]([^'"]+)['"]/g;
  for (const match of xml.matchAll(allIdsPattern)) {
    const idVal = match[1];
    if (idVal === undefined || !usedIds.has(idVal)) continue;

    const matchStart = match.index;
    const matchEnd = matchStart + match[0].length;
    const candidate = tags[lastTagAtOrBefore(tags, matchStart)];
    const inside = candidate !== undefined && matchEnd <= candidate.end;
    if (!inside) collisions.push({ start: matchStart, end: matchEnd, replacement: '' });
  }

  // `collisions` is already in ascending order (matchAll walks the string forwards) and none of them
  // lies inside a tag, so merging the two sorted lists keeps the whole set ordered and disjoint.
  const tagsAndCollisions = collisions.length === 0 ? tags : merge(tags, collisions);

  // Element inserts are zero-width (start === end): they never overlap a tag or a collision removal,
  // they only interleave with them. Sorted by (offset, order) first, so two inserts at the same offset
  // (accidental before beam, contract order 0 before 1) come out in that order after the merge below.
  const elementInserts = [...(inserts.elements ?? [])].sort((a, b) =>
    a.offset !== b.offset ? a.offset - b.offset : a.order - b.order,
  );
  const elementReplacements: Replacement[] = elementInserts.map((e) => ({
    start: e.offset,
    end: e.offset,
    replacement: e.text,
  }));
  const replacements =
    elementReplacements.length === 0 ? tagsAndCollisions : merge(tagsAndCollisions, elementReplacements);

  const pieces: string[] = [];
  let cursor = 0;
  for (const { start, end, replacement } of replacements) {
    if (start < cursor) continue; // defensive: an overlap would corrupt the copy, so skip it
    pieces.push(xml.slice(cursor, start), replacement);
    cursor = end;
  }
  pieces.push(xml.slice(cursor));

  let result = pieces.join('');

  // Rewrite the XML declaration
  if (result.startsWith('<?xml')) {
    result = result.replace(/<\?xml([^>]*?encoding\s*=\s*['"])([^'"]*)(['"][^>]*)\?>/i, '<?xml$1UTF-8$3?>');
  }

  return result;
}

/** Merges two ascending, non-overlapping lists of replacements into one ascending list. */
function merge(a: Replacement[], b: Replacement[]): Replacement[] {
  const out: Replacement[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const left = a[i];
    const right = b[j];
    if (left === undefined) break;
    if (right === undefined) break;
    if (left.start <= right.start) {
      out.push(left);
      i++;
    } else {
      out.push(right);
      j++;
    }
  }
  while (i < a.length) {
    const left = a[i];
    if (left !== undefined) out.push(left);
    i++;
  }
  while (j < b.length) {
    const right = b[j];
    if (right !== undefined) out.push(right);
    j++;
  }
  return out;
}

function replaceIdInTag(tag: string, newId: string): string {
  if (/\s+id\s*=\s*['"][^'"]*['"]/.test(tag)) {
    return tag.replace(/\s+id\s*=\s*['"][^'"]*['"]/, ` id="${newId}"`);
  }
  return tag.replace(/^<([^\s>]+)/, `<$1 id="${newId}"`);
}
