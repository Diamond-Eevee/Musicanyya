/** contracts/exercise-definition.md - the shape of `content/library/exercises/*.json`. Pure data: no
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

export interface ExerciseDefinition {
  version: 1;
  /** File-name stem prefix, e.g. "triads". */
  family: string;
  /** e.g. "{key} triads" - `{key}` is substituted with the key's display name. */
  titleTemplate: string;
  /** Index section id, e.g. "learning/chords". */
  section: string;
  metre: string;
  tempoBpm: number;
  beatUnit?: BeatUnit;
  keys: ExerciseKey[];
  steps: ExerciseStep[];
  /** Engrave a backward-repeat barline around the steps. */
  repeatBar?: boolean;
  /** The item-metadata template (contracts/library-index.md §1) minus `title` and
   *  `provenance.created` - the generator fills the title from `titleTemplate` and stamps the
   *  generation date. */
  meta: {
    kind: 'exercise';
    level: 'beginner' | 'intermediate' | 'advanced';
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
  };
}
