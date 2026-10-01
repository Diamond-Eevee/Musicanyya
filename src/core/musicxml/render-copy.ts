import type { ElementInsert } from './engraving/index.js';

export interface RenderCopyInserts {
  notes: Array<{ startOffset: number; tagLength: number; id: string }>;
  measures: Array<{ startOffset: number; tagLength: number; id: string }>;
  /** Engraving-completion inserts (accidentals, beams) spliced strictly inside note bodies - they never
   *  overlap a note/measure open tag, so no collision handling is needed against `notes`/`measures`. */
  elements?: ElementInsert[];
  /** Text replaced inside note bodies (017 T047: an unpitched note's display pitch, placed for Verovio). They never
   *  overlap a note/measure open tag or an element insert, and are applied in the same single pass. */
  rewrites?: Array<{ start: number; end: number; text: string }>;
  /** Byte ranges cut out of the copy (feature 019, render-copy contract 1.2.0): an Orchestra part's `<score-part>` and
   *  `<part>`, so Verovio never engraves it. They never overlap each other. A note, measure, element insert or rewrite
   *  that starts inside one is dropped - not an error: it belongs to what is cut. Applied in the same single pass. */
  removals?: Array<{ start: number; end: number }>;
}

interface Replacement {
  start: number;
  end: number;
  replacement: string;
}

/** Whether `offset` lies inside one of the `removals` (sorted by start, not overlapping). Binary search. */
function insideRemoval(removals: readonly { start: number; end: number }[], offset: number): boolean {
  let lo = 0;
  let hi = removals.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const removal = removals[mid];
    if (removal === undefined) return false;
    if (offset < removal.start) hi = mid - 1;
    else if (offset >= removal.end) lo = mid + 1;
    else return true;
  }
  return false;
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
  const removals = [...(inserts.removals ?? [])].sort((a, b) => a.start - b.start);
  const removed = (offset: number) => removals.length > 0 && insideRemoval(removals, offset);

  // The tags we rewrite. Note and measure tags never overlap - a `<measure ...>` start tag ends
  // before the first `<note>` inside it - so sorting by start is enough to walk them in order.
  const tags: Replacement[] = [];
  const usedIds = new Set<string>();

  for (const note of inserts.notes) {
    if (removed(note.startOffset)) continue;
    usedIds.add(note.id);
    const end = note.startOffset + note.tagLength;
    tags.push({
      start: note.startOffset,
      end,
      replacement: replaceIdInTag(xml.substring(note.startOffset, end), note.id),
    });
  }

  for (const measure of inserts.measures) {
    if (removed(measure.startOffset)) continue;
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
    if (removed(matchStart)) continue; // inside what is cut out anyway
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
  const elementInserts = [...(inserts.elements ?? [])]
    .filter((e) => !removed(e.offset))
    .sort((a, b) => (a.offset !== b.offset ? a.offset - b.offset : a.order - b.order));
  const elementReplacements: Replacement[] = elementInserts.map((e) => ({
    start: e.offset,
    end: e.offset,
    replacement: e.text,
  }));
  const withElements =
    elementReplacements.length === 0 ? tagsAndCollisions : merge(tagsAndCollisions, elementReplacements);
  const rewrites: Replacement[] = [...(inserts.rewrites ?? [])]
    .filter((r) => !removed(r.start))
    .sort((a, b) => a.start - b.start)
    .map((r) => ({ start: r.start, end: r.end, replacement: r.text }));
  const withRewrites = rewrites.length === 0 ? withElements : merge(withElements, rewrites);
  const replacements =
    removals.length === 0
      ? withRewrites
      : merge(
          withRewrites,
          removals.map((r) => ({ start: r.start, end: r.end, replacement: '' })),
        );

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

/** A `<measure-repeat>` element, self-closing or with its content (the number of measures repeated). */
const MEASURE_REPEAT = /<measure-repeat\b[^>]*?(?:\/>|>[^<]*<\/measure-repeat\s*>)/g;
/** A `<measure-style>` left with nothing but white space. */
const EMPTY_MEASURE_STYLE = /<measure-style\b[^>]*>\s*<\/measure-style\s*>/g;

/**
 * Leaves the measure-repeat simile sign out of the render copy (017 T021, from 001 T169). Verovio draws one repeat sign
 * in place of the notes a file encodes for such a measure; those notes are played, so they are in the Score model, and
 * every playable note needs its own drawn element carrying its Note ID (Constitution III) - a Grade marks it there.
 * Without the sign Verovio engraves the encoded notes. The file itself is untouched; a `<measure-style>` emptied by
 * this goes too, any other of its children stay. Where the measure encodes no notes the sign stays: nothing is
 * played there to draw instead (017 T029 audit). A document without measure repeats is returned unchanged.
 */
export function withoutMeasureRepeats(xml: string): string {
  if (!xml.includes('<measure-repeat')) return xml;
  return xml
    .replace(MEASURE_REPEAT, (sign, offset: number) => (measureHasNotes(xml, offset) ? '' : sign))
    .replace(EMPTY_MEASURE_STYLE, '');
}

/** A `<measure>` start tag: any white space may follow the name. */
const MEASURE_OPEN = /<measure[\s>]/g;

/** Whether the `<measure>` around `offset` encodes a pitched or unpitched note; true when there is no enclosing one. */
function measureHasNotes(xml: string, offset: number): boolean {
  let open = -1;
  MEASURE_OPEN.lastIndex = 0;
  for (let match = MEASURE_OPEN.exec(xml); match !== null && match.index < offset; match = MEASURE_OPEN.exec(xml)) {
    open = match.index;
  }
  const close = xml.indexOf('</measure>', offset);
  if (open < 0 || close < 0) return true;
  const measure = xml.slice(open, close);
  return measure.includes('<pitch') || measure.includes('<unpitched');
}
