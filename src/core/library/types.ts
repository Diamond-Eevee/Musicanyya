/** contracts/library-index.md, contracts/library-port.md - the shapes the library content formats
 *  and the app's in-memory model share. Pure data: no DOM, no `fetch` (Principle V). */

export type Level = 'beginner' | 'intermediate' | 'advanced';

export const SKILL_TAGS = [
  'chords',
  'chord-changes',
  'scales',
  'arpeggios',
  'five-finger',
  'hands-together',
  'hands-separate',
  'steady-eighths',
  'dotted-rhythm',
  'triplets',
  'ties',
  'repeats',
  'pedal',
  'octave-shift',
  'ornaments',
  'sight-reading',
  'dynamics',
  'phrasing',
] as const;
export type SkillTag = (typeof SKILL_TAGS)[number];

export interface ProvenanceAuthored {
  origin: 'authored';
  licence: 'CC0-1.0';
  author: string;
  created: string;
  basedOn?: string;
  note?: string;
}

export interface ProvenanceDownloaded {
  origin: 'downloaded';
  licence: 'CC0-1.0' | 'public-domain';
  source: string;
  sourcePath?: string;
  obtained: string;
  credit?: string;
  unmodified?: boolean;
  note?: string;
}

export type Provenance = ProvenanceAuthored | ProvenanceDownloaded;

export interface ExpectedNotices {
  notices?: readonly string[];
}

/** The authored `<name>.json` sidecar (contracts/library-index.md §1) - everything a human decided. */
export interface ItemMetadata {
  version: 1;
  title: string;
  subtitle?: string;
  composer?: string | null;
  arranger?: string | null;
  kind: 'exercise' | 'piece';
  level: Level;
  tags: readonly SkillTag[];
  trains?: string;
  hands?: 'right' | 'left' | 'both';
  arrangement?: boolean;
  provenance: Provenance;
  expected?: ExpectedNotices;
  /** Who checked the *music* - a person or an agent id (data-model.md §4.2). */
  reviewedBy: string;
  reviewedOn: string;
  /** Required when the assigned level sits above the level `checkLevel` computes. */
  raisedBecause?: string;
  limitations?: readonly string[];
}

export interface LibrarySection {
  id: string;
  title: string;
  description?: string;
  path: string;
  parent: string | null;
  order: number;
}

/** Derived by `tools/library/build-index.ts` through `readXml` + `buildScore`. Display and filtering
 *  only - playback, Practice and grading always use the tempo map built from the file itself
 *  (data-model.md §3, Principle II). */
export interface ItemFacts {
  measures: number;
  notes: number;
  durationSeconds: number;
  keys: readonly string[];
  metres: readonly string[];
  tempoBpm: number | null;
  tempoDefaulted?: boolean;
  lowestMidi: number;
  highestMidi: number;
  /** Largest simultaneous interval within one hand, in semitones. */
  maxSpanSemitones: number;
  staves: number;
  handsWithNotes?: 'right' | 'left' | 'both';
  /** Max distinct voices in any one staff (data-model.md §4, criterion 4). Not part of the v1.0.0
   *  contract's required fields; the schema allows additional facts (MINOR addition). */
  voicesPerStaff?: number;
  /** Fraction of measures whose staves 1 and 2 have different onset-tick sets (criterion 3). 0 when
   *  the item has fewer than two staves. */
  handIndependenceFraction?: number;
  /** 1 = whole, 4 = quarter, 16 = sixteenth ... */
  shortestDivision: number;
  notesPerBeat: number;
  /** Key-signature accidentals, max over the piece. */
  accidentals: number;
  hasTies?: boolean;
  hasTuplets?: boolean;
  hasGraceNotes?: boolean;
  hasOctaveShift?: boolean;
  hasRepeats?: boolean;
  hasPedal?: boolean;
  fingeringCoverage?: number;
  notices: readonly string[];
}

export interface LevelCheck {
  level: Level;
  pass: boolean;
  /** Criterion ids that failed (data-model.md §4). */
  failed: readonly string[];
}

export interface LibraryItem {
  /** The path under `public/library/` without the extension. Stable: renaming a file is a breaking
   *  change, never a refactor (contracts/library-index.md §3). */
  id: string;
  section: string;
  /** Path relative to the library root, URL-encoded on fetch. */
  file: string;
  bytes: number;
  hash: string;
  meta: ItemMetadata;
  facts: ItemFacts;
  levelCheck?: LevelCheck;
}

export interface LibraryIndex {
  version: 1;
  generated: string;
  sections: readonly LibrarySection[];
  items: readonly LibraryItem[];
}

/** contracts/library-port.md §3 - the musician's current narrowing, persisted under `musicanyya.library.v1`. */
export interface LibraryFilter {
  sectionId: string | null;
  level: Level | null;
  key: string | null;
  tag: SkillTag | null;
  text: string;
}
