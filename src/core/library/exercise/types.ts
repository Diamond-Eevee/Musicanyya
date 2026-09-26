/** contracts/exercise-definition.md (1.1.0) - the shape of `content/library/exercises/*.json`. Pure data: no
 *  DOM, no `fetch` (Principle V). Read only by `tools/library/build-exercises.ts` and this module;
 *  nothing at run time (tests/architecture/layers.test.ts, tasks.md T086). */
import type { SkillTag } from '../types.js';

export type Mode = 'major' | 'minor';
export type Quality = 'major' | 'minor' | 'diminished' | 'augmented';
export type Inversion = 0 | 1 | 2;
export type StepDuration = 'whole' | 'half' | 'quarter' | 'eighth' | 'dotted-half' | 'dotted-quarter';
export type RestAfter = 'none' | 'eighth' | 'quarter' | 'half';
export type Voicing = 'triad' | 'root' | 'root-fifth' | 'octave' | 'rest';
export type BeatUnit = 'quarter' | 'eighth' | 'half' | 'dotted-quarter';

/** The four generated steps of a key folder (feature 011). */
export type StepName = 'introduction' | 'beginner' | 'intermediate' | 'advanced';
/** `chords` = the 1.0.0 families; `pattern` = a scale in one hand against chords in the other; `key-change` = two keys. */
export type DefinitionForm = 'chords' | 'pattern' | 'key-change';
/** The minor form a scale uses; a major key always uses the major scale, whatever the form says. */
export type ScaleForm = 'harmonic' | 'melodic';
export type PatternVoicing = 'triad' | 'broken' | 'root-fifth';
export type BarlineKind = 'regular' | 'light-light' | 'light-heavy';

export interface ExerciseKey {
  /** A single letter A-G, optionally followed by `#` or `b`. */
  tonic: string;
  mode: Mode;
  /** The key signature; authored, never inferred (contracts/exercise-definition.md §2.2). */
  fifths: number;
  /** Moves the whole exercise so a high or low tonic stays inside the hand's range. */
  octaveShift?: number;
}

export interface HandPart {
  voicing: Voicing;
  /** Scientific octave of the lowest sounding note. When omitted, the generator picks the octave
   *  nearest the exercise's register anchor (data-model.md §5.1's register rule). */
  octave?: number;
  /** Low note to high note; length must match the voicing's note count. */
  fingering?: number[];
}

export interface ExerciseStep {
  /** Roman-numeral degree of the key, e.g. "I", "IV", "V", "i", "iv" ("V" in a minor key is always
   *  the major dominant - the harmonic-minor raised leading tone). */
  degree: string;
  /** Overrides the quality the degree's case implies; used for the harmonic-minor dominant and for
   *  same-tonic quality changes (e.g. C major -> C minor). */
  quality?: Quality;
  inversion?: Inversion;
  duration: StepDuration;
  restAfter?: RestAfter;
  hands?: { left?: HandPart; right?: HandPart };
  /** Chord name engraved above the step, e.g. "C", "Am". */
  label?: string;
}

/** A scale in one hand: degrees counted up from the tonic (1 = the tonic, 8 = the tonic an octave up), one entry per note. */
export interface ScalePart {
  form: ScaleForm;
  shape: number[];
  value: StepDuration;
  /** The value of the final note, e.g. the closing whole note. */
  lastValue?: StepDuration;
}

/** One chord of a pattern section. `duration` is the whole entry: a `broken` chord splits it into four equal notes
 *  (root, third, fifth, third), a `root-fifth` chord into two (root, fifth). */
export interface PatternChord {
  degree: string;
  quality?: Quality;
  inversion?: Inversion;
  duration: StepDuration;
  voicing?: PatternVoicing;
  label?: string;
  /** What the chord is in a minor key when it differs from the major key's: the degree name (I -> i, ii -> iv), and
   *  optionally its quality, inversion or label. One definition then serves all 24 keys. */
  minor?: Partial<Pick<PatternChord, 'degree' | 'quality' | 'inversion' | 'label'>>;
}

/** What one hand does in a pattern section. `mirror` (with the section's `mirror` index) plays the earlier section's
 *  material with the hands swapped; `rest` writes whole-bar rests. */
export type PatternHandPart = { scale: ScalePart } | { chords: PatternChord[] } | { mirror: true } | { rest: true };

export interface PatternSection {
  bars: number;
  /** Key-change form only: which of the pair's keys this section is in. */
  inKey?: 'from' | 'to';
  /** A words direction at the section start; `{scale}` becomes "major scale", "harmonic minor scale" or "melodic minor scale". */
  label?: string;
  /** The barline at the section end. */
  barline?: BarlineKind;
  /** Index of an earlier section to repeat with the hands swapped. */
  mirror?: number;
  right: PatternHandPart;
  left: PatternHandPart;
}

export interface KeyPair {
  from: ExerciseKey;
  to: ExerciseKey;
  relation: 'relative' | 'parallel';
}

export interface ExerciseDefinition {
  version: 1;
  /** File-name stem prefix, e.g. "triads". */
  family: string;
  /** `chords` (the default) is the 1.0.0 behaviour. */
  form?: DefinitionForm;
  /** e.g. "{key} triads" - `{key}` is substituted with the key's display name (key-change form: `{from}` and `{to}`). */
  titleTemplate: string;
  /** Index section id, e.g. "learning/chords"; pattern and key-change forms write `{key}` or `{pair}` into it. */
  section: string;
  /** The step of a key or key-change folder this definition generates (pattern and key-change forms). */
  step?: StepName;
  stepOrder?: number;
  /** A fixed file stem written into every key's folder; when absent the 1.0.0 rule `<family>-<key-slug>` applies. */
  fileStem?: string;
  metre: string;
  tempoBpm: number;
  beatUnit?: BeatUnit;
  keys?: ExerciseKey[];
  steps?: ExerciseStep[];
  sections?: PatternSection[];
  keyPairs?: KeyPair[];
  /** Key slug (or pair slug) -> old item ids the generated item replaces; the build tool looks up their hashes. */
  supersedes?: Record<string, string[]>;
  /** Engrave a backward-repeat barline around the steps. */
  repeatBar?: boolean;
  /** The item-metadata template (contracts/library-index.md §1) minus `title` and
   *  `provenance.created` - the generator fills the title from `titleTemplate` and stamps the
   *  generation date. */
  meta: {
    kind: 'exercise';
    level: 'introduction' | 'beginner' | 'intermediate' | 'advanced';
    tags: SkillTag[];
    trains?: string;
    hands?: 'right' | 'left' | 'both';
    provenance: {
      origin: 'authored';
      licence: 'CC0-1.0';
      author: string;
      note?: string;
    };
    reviewedBy?: string;
    reviewedOn?: string;
    /** Required when the step's level is above the level the criteria compute for a generated key (analyze A3). */
    raisedBecause?: string;
  };
}
