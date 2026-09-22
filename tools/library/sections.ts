/** The shelf's wording, in one place (data-model.md §2). `tools/library/build-index.ts` copies this
 *  table into `index.json` verbatim; nothing else names a section's title or description. A folder
 *  with no items is left out of the generated index by the builder, not by this table. */
export interface LibrarySectionDefinition {
  id: string;
  title: string;
  description?: string;
  /** Folder under `public/library/` this section reads from. */
  path: string;
  parent: string | null;
  order: number;
}

export const LIBRARY_SECTIONS: readonly LibrarySectionDefinition[] = [
  {
    id: 'learning',
    title: 'Learning',
    description: 'Exercises written for this app.',
    path: 'learning',
    parent: null,
    order: 1,
  },
  {
    id: 'learning/chords',
    title: 'Chords',
    description: 'One exercise per key - the same drill in all of them.',
    path: 'learning/chords',
    parent: 'learning',
    order: 1,
  },
  {
    id: 'learning/chords/changes',
    title: 'Chord changes',
    description: 'Moving from one chord to the next without losing the beat.',
    path: 'learning/chords/changes',
    parent: 'learning/chords',
    order: 2,
  },
  {
    id: 'repertoire',
    title: 'Repertoire',
    description: 'Pieces.',
    path: 'repertoire',
    parent: null,
    order: 2,
  },
  {
    id: 'repertoire/beginner',
    title: 'Beginner',
    path: 'repertoire/beginner',
    parent: 'repertoire',
    order: 1,
  },
  {
    id: 'repertoire/intermediate',
    title: 'Intermediate',
    path: 'repertoire/intermediate',
    parent: 'repertoire',
    order: 2,
  },
  {
    id: 'repertoire/advanced',
    title: 'Advanced',
    path: 'repertoire/advanced',
    parent: 'repertoire',
    order: 3,
  },
];
