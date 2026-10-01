/** contracts/library-index.md, contracts/library-port.md - the shapes the library content formats
 *  and the app's in-memory model share. Pure data: no DOM, no `fetch` (Principle V). */

/** Feature 011 adds `introduction` below `beginner` (specs/011-learning-by-key/data-model.md §4). */
export type Level = 'introduction' | 'beginner' | 'intermediate' | 'advanced';

/** The step of a key or key-change folder an item belongs to (contracts/library-index.md 1.2.0 §1). `song` is
 *  the chord-practice songs of a key folder; the other four are the generated exercise steps. */
export type Step = 'introduction' | 'beginner' | 'intermediate' | 'advanced' | 'song';

/** Position of each step in a folder: the panel sorts by it, and `checkStepOrder` walks the four exercise steps in
 *  this order. */
export const STEP_RANK: Readonly<Record<Step, number>> = {
  introduction: 0,
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  song: 4,
};
export const STEPS: readonly Step[] = ['introduction', 'beginner', 'intermediate', 'advanced', 'song'];

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
  'key-changes',
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
  /** The step of a key or key-change folder this item belongs to (contracts/library-index.md 1.2.0). */
  step?: Step;
  /** Position inside its step: 0 = the step's main exercise, 10+ = more practice at the same step. */
  stepOrder?: number;
  /** Former library items this item replaces: old id and the SHA-256 of the old file. Read only by the session (settings
   *  adoption); never affects what is listed. */
  supersedes?: readonly { id: string; hash: string }[];
}

export interface LibrarySection {
  id: string;
  title: string;
  description?: string;
  path: string;
  parent: string | null;
  /** Position among siblings (same `parent`). */
  order: number;
  /** Section ids this section replaces; a persisted filter naming one is moved here (feature 011 FR-020). */
  formerIds?: readonly string[];
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
  /** The widest one-hand chord whose notes all carry `<arpeggiate>` (rolled); such chords are left out of
   *  `maxSpanSemitones`. Absent when there is none (feature 019, library-index 1.3.0). */
  maxArpeggiatedSpanSemitones?: number;
  staves: number;
  handsWithNotes?: 'right' | 'left' | 'both';
  /** Max distinct voices in any one staff (data-model.md §4, criterion 4). Not part of the v1.0.0
   *  contract's required fields; the schema allows additional facts (MINOR addition). */
  voicesPerStaff?: number;
  /** Fraction of measures where both staves have onsets and neither staff's onset-tick set is a subset of the
   *  other's (criterion 3, the B1 rule of feature 011: a held chord under a moving hand is dependent). 0 when the
   *  item has fewer than two staves. */
  handIndependenceFraction?: number;
  /** Mean over written measures of the chord attacks (onsets where one staff sounds 2+ notes) that differ from the
   *  previous chord attack of the same staff (feature 011, data-model.md §4). Summed over staves. */
  chordChangesPerBar?: number;
  /** 1 = whole, 4 = quarter, 16 = sixteenth ... */
  shortestDivision: number;
  notesPerBeat: number;
  /** Key-signature accidentals, max over the piece. */
  accidentals: number;
  /** The instrument names of the item's Orchestra parts - parts that sound but are not printed - in Score order; absent
   *  when there are none (feature 019, library-index 1.3.0). Every other fact is derived from the printed parts only. */
  orchestra?: readonly string[];
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
  /** How many of those accidentals sit on the 6th or 7th degree of the relative minor of a key signature in the score -
   *  the harmonic and melodic minor scale notes exercises are exempt from counting (D-2 B5, criterion 11). */
  minorScaleAccidentalCount?: number;
  /** Longest chain of tied notes sharing a pitch, within one staff/voice (criterion 20). */
  maxTieChainNotes?: number;
  /** Most barlines a single tie chain crosses (criterion 20). */
  maxTieBarlinesCrossed?: number;
  /** A tuplet ratio other than 3:2 is used anywhere (criterion 21). */
  hasNonSimpleTuplet?: boolean;
  /** Grace note count (criterion 22). */
  graceNoteCount?: number;
  /** Ornament count: trill/mordent/inverted mordent/turn/tremolo (criterion 23). */
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
