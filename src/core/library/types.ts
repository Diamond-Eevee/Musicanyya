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
  /** An arrangement's deliberate departures from the original, naming the bars (contract library-index.md 1.1.0).
   *  Not displayed by the app in feature 007. */
  departures?: readonly string[];
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

  // The remaining fields feed `checkLevel` (data-model.md §4, criteria 6-27 not covered above). Not
  // part of the v1.0.0 contract's required set - a MINOR addition, same as `voicesPerStaff` and
  // `handIndependenceFraction` (T009).
  /** Number of parts in the Score (criterion 27: this library expects exactly 1). */
  parts?: number;
  /** Distinct tempo-value changes after the first mark (criterion 8). */
  tempoChanges?: number;
  /** Largest interval between consecutive onsets' top note, within one staff (criterion 17). */
  maxLeapSemitones?: number;
  /** Longest run of consecutive onsets at the shortest notated value, within one staff (criterion 6). */
  longestRunAtShortestValue?: number;
  /** Total note-attack count across both staves - one per onset, a chord counts once (criterion 18). */
  attackCount?: number;
  /** Highest note-attack count found in any 2-second window (criterion 19). */
  peakNotesPerSecond?: number;
  /** Explicit `<accidental>` markup count - accidentals outside the key signature (criterion 11). */
  accidentalMarkCount?: number;
  /** Longest chain of tied notes sharing a pitch, within one staff/voice (criterion 20). */
  maxTieChainNotes?: number;
  /** Most barlines a single tie chain crosses (criterion 20). */
  maxTieBarlinesCrossed?: number;
  /** A tuplet ratio other than 3:2 is used anywhere (criterion 21). */
  hasNonSimpleTuplet?: boolean;
  /** Grace note count (criterion 22). */
  graceNoteCount?: number;
  /** Ornament count: trill/mordent/turn/tremolo (criterion 23). */
  ornamentCount?: number;
  /** The repeat structure actually used (criterion 24). */
  repeatKind?: 'none' | 'simple' | 'voltas' | 'jumps';
  /** How many backward repeats the score has (criterion 24's "one backward repeat" cap). */
  backwardRepeatCount?: number;
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
