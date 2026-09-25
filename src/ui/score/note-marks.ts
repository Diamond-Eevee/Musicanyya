import type { MarkState } from '../../core/practice/types.js';
import type { NoteId } from '../../core/score/model.js';

/**
 * The Practice state of a written note, shown as a class on the note's own SVG element (feature 008, research R-01):
 * `g.note.<class> > g.notehead` recolours exactly the notehead glyph of exactly that Note ID (score.css), so hollow
 * heads stay hollow, stems, dots and accidentals stay black, and the mark follows scroll, zoom and reflow for free.
 */
export type NoteMarkClass = 'mx-mark-correct' | 'mx-mark-heldover' | 'mx-mark-skipped';

/** MarkState -> class (data-model section 5). `waiting` has no mark of its own (the band shows it), and the three wrong
 *  states have no written note to mark (they are discs, US2). */
export function noteMarkClass(state: MarkState): NoteMarkClass | null {
  switch (state) {
    case 'correct':
    case 'correctSoFar':
    case 'playedAlong':
      return 'mx-mark-correct';
    case 'heldOver':
      return 'mx-mark-heldover';
    case 'skipped':
      return 'mx-mark-skipped';
    default:
      return null;
  }
}

/**
 * Makes the page show exactly `wanted`: a note that is no longer wanted (or wants another class) loses its class
 * first, then the wanted ones gain theirs (off before on, as `highlight.ts` does). Idempotent and cheap when nothing
 * changed: the DOM is looked at for every wanted note, but only written where a class is missing, so it can be
 * called again after a page is mounted again (the new elements carry no class) with the same `applied` map.
 * `applied` is updated to mirror `wanted`. A note whose page is not mounted is skipped and gets its class once it is.
 */
export function applyNoteMarks(
  container: HTMLElement,
  wanted: ReadonlyMap<NoteId, NoteMarkClass>,
  applied: Map<NoteId, NoteMarkClass>,
): void {
  for (const [id, cls] of applied) {
    if (wanted.get(id) === cls) continue;
    container.querySelector(`#${CSS.escape(id)}`)?.classList.remove(cls);
    applied.delete(id);
  }
  for (const [id, cls] of wanted) {
    const el = container.querySelector(`#${CSS.escape(id)}`);
    if (el && !el.classList.contains(cls)) el.classList.add(cls);
    applied.set(id, cls);
  }
}
