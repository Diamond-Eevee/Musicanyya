const SOUNDING_CLASS = 'playing';

/** Off before on (Constitution VI): notes no longer sounding lose the class before newly-sounding ones gain it. */
export function applyHighlights(
  container: HTMLElement,
  currentNoteIds: ReadonlySet<string>,
  previousNoteIds: ReadonlySet<string>,
): void {
  for (const id of previousNoteIds) {
    if (currentNoteIds.has(id)) continue;
    container.querySelector(`#${CSS.escape(id)}`)?.classList.remove(SOUNDING_CLASS);
  }
  for (const id of currentNoteIds) {
    container.querySelector(`#${CSS.escape(id)}`)?.classList.add(SOUNDING_CLASS);
  }
}
