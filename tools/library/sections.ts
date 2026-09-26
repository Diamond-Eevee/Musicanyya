import { displayKeyName, KEY_CHANGE_PAIRS, KEYS } from '../../src/core/library/exercise/keys.js';

/** The shelf's wording, in one place (data-model.md §2). `tools/library/build-index.ts` copies this
 *  table into `index.json` verbatim; nothing else names a section's title or description. A folder
 *  with no items is left out of the generated index by the builder, not by this table (feature 011: a folder that holds no
 *  items itself but has children that do is kept, so readers can build the tree). */
export interface LibrarySectionDefinition {
  id: string;
  title: string;
  description?: string;
  /** Folder under `public/library/` this section reads from. */
  path: string;
  parent: string | null;
  /** Position among siblings (same `parent`). */
  order: number;
  /** Section ids this section replaces (feature 011 FR-020): copied into `index.json`. */
  formerIds?: readonly string[];
}

/** Learning > Keys: one folder per key of the key table, in circle-of-fifths order (feature 011 FR-002). Generated from the
 *  table, so a key's title and place cannot drift from the generator's. */
const KEY_SECTIONS: readonly LibrarySectionDefinition[] = KEYS.map((key) => {
  const relative = KEYS.find((k) => k.slug === key.relativeSlug);
  // F sharp major is paired with E flat minor, not D sharp minor (research R2): the description says so once.
  const note = key.slug === 'f-sharp-major' ? ' (written as E♭ minor: D♯ minor needs a double sharp)' : '';
  return {
    id: `learning/keys/${key.slug}`,
    title: key.displayName,
    description: relative ? `Relative key: ${relative.displayName}${note}.` : '',
    path: `learning/keys/${key.slug}`,
    parent: 'learning/keys',
    order: key.circleIndex,
  };
});

/** Learning > Key changes: one folder per pair of the key-pair table, in its order (feature 011 FR-013, data-model §2-3). */
const KEY_CHANGE_SECTIONS: readonly LibrarySectionDefinition[] = KEY_CHANGE_PAIRS.map((pair, index) => ({
  id: `learning/key-changes/${pair.slug}`,
  title: `${displayKeyName(pair.from)} -> ${displayKeyName(pair.to)}`,
  description: pair.relation,
  path: `learning/key-changes/${pair.slug}`,
  parent: 'learning/key-changes',
  order: index + 1,
}));

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
    id: 'learning/keys',
    title: 'Keys',
    description: 'Every key, step by step.',
    path: 'learning/keys',
    parent: 'learning',
    order: 1,
    formerIds: ['learning/chords'],
  },
  ...KEY_SECTIONS,
  {
    id: 'learning/key-changes',
    title: 'Key changes',
    description: 'Moving from one key to another.',
    path: 'learning/key-changes',
    parent: 'learning',
    order: 2,
    formerIds: ['learning/chords/changes'],
  },
  ...KEY_CHANGE_SECTIONS,
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
