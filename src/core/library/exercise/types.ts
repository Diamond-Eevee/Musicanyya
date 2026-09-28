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

export type MelodyValue = 'whole' | 'half' | 'quarter' | 'eighth' | 'dotted-half' | 'dotted-quarter';

/** One note of a melody phrase (contract exercise-definition 1.3 §1c). Exactly one of `step`/`rest` is set. */
export interface MelodyNote {
  /** 1 = the key's tonic in octave 4; 8 = the tonic above; 9, 10; 0, -1, -2, -3 = the 7th, 6th, 5th, 4th below
   *  (data-model.md 014 §1). */
  step?: number;
  value: MelodyValue;
  /** Against the natural scale (major / natural minor); +1 on a minor 6th/7th = raised. */
  alter?: -1 | 0 | 1;
  /** A rest of `value`; `step` must be absent. */
  rest?: true;
  /** Overrides the computed finger (data-model §1, research R6 of feature 014). */
  finger?: 1 | 2 | 3 | 4 | 5;
  /** This note starts a new hand position; its finger is written. */
  shift?: true;
}

/** One variant of a melody section part: the five-finger position at the phrase's start, and its notes
 *  (fills the section's bars exactly). */
export interface MelodyPhrase {
  position: number;
  notes: MelodyNote[];
}

/** A section's right-hand melody (contract exercise-definition 1.3 §1c): variants for a major-key section, for a
 *  minor-key section, or both; item *i* of the family uses `variants[i mod variants.length]` (data-model §1). */
export interface MelodyPart {
  major?: MelodyPhrase[];
  minor?: MelodyPhrase[];
}

/** What one hand does in a pattern section. `mirror` (with the section's `mirror` index) plays the earlier section's
 *  material with the hands swapped; `rest` writes whole-bar rests; `melody` (feature 014, right hand only) is a
 *  single-note phrase over the other hand's chords. */
export type PatternHandPart =
  | { scale: ScalePart }
  | { chords: PatternChord[] }
  | { melody: MelodyPart }
  | { mirror: true }
  | { rest: true };

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
  /** Chords form (drills) only, `family` starting with `changes` (contract exercise-definition 1.3 §1d): replaces
   *  the right hand's triads with a melody laid out over the cycle (`sectionA`, `sectionB`, `final`). */
  melody?: { sectionA: MelodyPart; sectionB: MelodyPart; final: MelodyPart };
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
