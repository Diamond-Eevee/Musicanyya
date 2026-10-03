// The lesson definition (contract lesson-definition 1.0.0 §1, feature 022): content/library/lessons/*.json, one Basics
// lesson or one chord lesson (or a family of transposed ones). Validated by hand, like the song definition, so every
// problem names the field. Read by tools/library/build-lessons.ts only; the app never sees it.
import { keySlug } from '../../../src/core/library/exercise/keys';
import { SKILL_TAGS } from '../../../src/core/library/types';

export class LessonDefinitionError extends Error {
  constructor(detail: string) {
    super(`lesson definition: ${detail}`);
    this.name = 'LessonDefinitionError';
  }
}

export type LessonLevel = 'introduction' | 'beginner' | 'intermediate';
export type LessonHands = 'right' | 'left' | 'both';
export type LessonBarline = 'repeat-start' | 'repeat-end' | 'repeat-both' | 'final';

export interface LessonKey {
  tonic: string;
  mode: 'major' | 'minor';
  fifths: number;
}

export interface LessonTransposition extends LessonKey {
  /** The key's folder slug (`keySlug`), put in place of `{key}` in the id. */
  slug: string;
  /** A signed interval like "+P5" or "-M2" from the written key. */
  interval: string;
}

export interface LessonClaims {
  /** Notation feature ids (contract §3) this lesson introduces. */
  introduces?: string[];
  singlePitch?: boolean;
  /** A Basics lesson that only combines earlier ideas; `introduces` may then be empty. */
  practice?: boolean;
  /** A chord switch keeps this key down, or strikes it again, from the previous chord. */
  commonTones?: { bar: number; beat: number; pitch: string }[];
}

export interface LessonBarDefinition {
  rh: string;
  lh: string;
  barline?: LessonBarline;
}

export interface LessonDefinition {
  version: 1;
  id: string;
  title: string;
  section: string;
  stepOrder: number;
  level: LessonLevel;
  raisedBecause?: string;
  hands: LessonHands;
  tags: string[];
  trains: string;
  scoreText?: string;
  metre: string;
  tempoBpm: number;
  key: LessonKey;
  pickup?: boolean;
  claims: LessonClaims;
  simplifies?: string;
  departures?: string[];
  transpositions?: LessonTransposition[];
  bars: LessonBarDefinition[];
  author: string;
  reviewedBy: string;
  reviewedOn: string;
}

/** The notation feature ids of contract §3 (`claims.introduces`). */
export const NOTATION_FEATURES = [
  'staff',
  'treble-clef',
  'bass-clef',
  'middle-c',
  'whole',
  'half',
  'quarter',
  'eighth',
  'sixteenth',
  'dotted-half',
  'dotted-quarter',
  'whole-rest',
  'half-rest',
  'quarter-rest',
  'eighth-rest',
  'tie',
  'tie-across-barline',
  'slur',
  'staccato',
  'accent',
  'tenuto',
  'metre-4-4',
  'metre-3-4',
  'metre-2-4',
  'metre-6-8',
  'pickup',
  'repeat',
  'steps',
  'five-finger-position',
  'left-hand',
  'hands-alternate',
  'hands-together',
  'chord',
  'chord-symbol',
] as const;

const TOP_FIELDS = [
  'version',
  'id',
  'title',
  'section',
  'stepOrder',
  'level',
  'raisedBecause',
  'hands',
  'tags',
  'trains',
  'scoreText',
  'metre',
  'tempoBpm',
  'key',
  'pickup',
  'claims',
  'simplifies',
  'departures',
  'transpositions',
  'bars',
  'author',
  'reviewedBy',
  'reviewedOn',
];
const KEY_FIELDS = ['tonic', 'mode', 'fifths'];
const TRANSPOSITION_FIELDS = ['slug', 'tonic', 'mode', 'fifths', 'interval'];
const CLAIM_FIELDS = ['introduces', 'singlePitch', 'practice', 'commonTones'];
const BAR_FIELDS = ['rh', 'lh', 'barline'];
const ID = /^(basics|learning\/chord-lessons\/(single-chords|switches|progressions))\/[a-z0-9{}-]+$/;
const METRE = /^(\d+)\/(2|4|8)$/;
const TONIC = /^[A-G](#|b)?$/;
const INTERVAL = /^[+-](?:P1|m2|M2|m3|M3|P4|A4|d5|P5|m6|M6|m7|M7|P8)$/;
const LEVELS = ['introduction', 'beginner', 'intermediate'];
const HANDS = ['right', 'left', 'both'];
const BARLINES = ['repeat-start', 'repeat-end', 'repeat-both', 'final'];
const TEMPO_MIN = 30;
const TEMPO_MAX = 160;

type Fail = (detail: string) => never;
type Json = Record<string, unknown>;

/** True for a compound metre (6/8, 9/8, 12/8): its beat is a dotted quarter. */
export function isCompoundMetre(metre: string): boolean {
  const m = METRE.exec(metre);
  if (!m) return false;
  const beats = Number(m[1]);
  return m[2] === '8' && beats > 3 && beats % 3 === 0;
}

/** Validates `json` against the contract's schema and its single-definition rules (§4 step 1); the bars' tokens are
 *  checked by `parseLessonBars`, the rules across definitions by the builder. */
export function validateLessonDefinition(json: unknown): LessonDefinition {
  const fail: Fail = (detail) => {
    throw new LessonDefinitionError(detail);
  };
  const top = object(json, 'the definition', fail);
  known(top, TOP_FIELDS, 'the definition', fail);
  if (top.version !== 1) fail('version must be 1');

  const id = string(top.id, 'id', fail, 160);
  if (!ID.test(id)) fail(`id "${id}" must be basics/<name> or learning/chord-lessons/<folder>/<name>`);
  const transposed = top.transpositions !== undefined;
  if (id.includes('{key}') !== transposed) fail('id contains "{key}" exactly when transpositions is given');
  string(top.title, 'title', fail, 80);
  const section = string(top.section, 'section', fail, 160);
  if (section !== id.slice(0, id.lastIndexOf('/')))
    fail(`section "${section}" must be the id without its last segment`);
  if (!Number.isInteger(top.stepOrder) || (top.stepOrder as number) < 10)
    fail('stepOrder must be an integer of 10 or more');
  if (!LEVELS.includes(top.level as string)) fail(`level must be one of ${LEVELS.join(', ')}`);
  if (top.raisedBecause !== undefined) string(top.raisedBecause, 'raisedBecause', fail, 500);
  if (!HANDS.includes(top.hands as string)) fail(`hands must be one of ${HANDS.join(', ')}`);
  if (!Array.isArray(top.tags) || top.tags.length === 0) fail('tags must be a non-empty list');
  for (const tag of top.tags as unknown[]) {
    if (!(SKILL_TAGS as readonly unknown[]).includes(tag)) fail(`tags: "${String(tag)}" is not a skill tag`);
  }
  string(top.trains, 'trains', fail, 300);
  if (top.scoreText !== undefined) string(top.scoreText, 'scoreText', fail, 60);
  const basics = section === 'basics';
  if (basics && top.scoreText === undefined) fail('a Basics lesson needs scoreText, the line printed above bar 1');

  const metre = typeof top.metre === 'string' ? top.metre : '';
  if (!METRE.test(metre)) fail('metre must be like "4/4", "3/4" or "6/8"');
  if (typeof top.tempoBpm !== 'number' || top.tempoBpm < TEMPO_MIN || top.tempoBpm > TEMPO_MAX)
    fail(`tempoBpm must be a number from ${TEMPO_MIN} to ${TEMPO_MAX}`);
  if (isCompoundMetre(metre) && !Number.isInteger((top.tempoBpm as number) / 1.5))
    fail(`tempoBpm ${top.tempoBpm} in ${metre} must give a whole dotted-quarter mark (tempoBpm / 1.5)`);
  validKey(top.key, 'key', fail);
  if (top.pickup !== undefined && typeof top.pickup !== 'boolean') fail('pickup must be true or false');

  const claims = object(top.claims, 'claims', fail);
  known(claims, CLAIM_FIELDS, 'claims', fail);
  if (claims.introduces !== undefined) {
    if (!Array.isArray(claims.introduces)) fail('claims.introduces must be a list');
    for (const feature of claims.introduces as unknown[]) {
      if (!(NOTATION_FEATURES as readonly unknown[]).includes(feature))
        fail(`claims.introduces: "${String(feature)}" is not a notation feature id (contract §3)`);
    }
  }
  for (const flag of ['singlePitch', 'practice'] as const) {
    if (claims[flag] !== undefined && typeof claims[flag] !== 'boolean') fail(`claims.${flag} must be true or false`);
  }
  if (claims.commonTones !== undefined) {
    if (!Array.isArray(claims.commonTones)) fail('claims.commonTones must be a list');
    (claims.commonTones as unknown[]).forEach((raw, i) => {
      const tone = object(raw, `claims.commonTones[${i}]`, fail);
      known(tone, ['bar', 'beat', 'pitch'], `claims.commonTones[${i}]`, fail);
      if (!Number.isInteger(tone.bar)) fail(`claims.commonTones[${i}].bar must be an integer`);
      if (typeof tone.beat !== 'number' || tone.beat < 1) fail(`claims.commonTones[${i}].beat must be 1 or more`);
      string(tone.pitch, `claims.commonTones[${i}].pitch`, fail, 4);
    });
  }
  const introduces = (claims.introduces as unknown[] | undefined) ?? [];
  if (basics && introduces.length === 0 && claims.practice !== true)
    fail('claims.introduces must name what a Basics lesson introduces, unless claims.practice is true');

  if (top.simplifies !== undefined) {
    string(top.simplifies, 'simplifies', fail, 160);
    if (!Array.isArray(top.departures) || top.departures.length === 0)
      fail('departures must say what was simplified when simplifies is given');
  } else if (top.departures !== undefined) {
    fail('departures belongs to a simplified lesson (one with simplifies)');
  }
  for (const d of (top.departures as unknown[] | undefined) ?? []) string(d, 'departures[]', fail, 500);

  if (transposed) {
    if (!Array.isArray(top.transpositions) || top.transpositions.length === 0)
      fail('transpositions must be a non-empty list');
    (top.transpositions as unknown[]).forEach((raw, i) => {
      const at = `transpositions[${i}]`;
      const t = object(raw, at, fail);
      known(t, TRANSPOSITION_FIELDS, at, fail);
      validKey(t, at, fail, true);
      if (typeof t.interval !== 'string' || !INTERVAL.test(t.interval))
        fail(`${at}.interval must be an interval like "+P5" or "-M2"`);
      const slug = keySlug({ tonic: t.tonic as string, mode: t.mode as 'major' | 'minor' });
      if (t.slug !== slug) fail(`${at}.slug must be "${slug}"`);
    });
  }

  if (!Array.isArray(top.bars) || top.bars.length === 0) fail('bars must be a non-empty list');
  (top.bars as unknown[]).forEach((raw, i) => {
    const bar = object(raw, `bars[${i}]`, fail);
    known(bar, BAR_FIELDS, `bars[${i}]`, fail);
    if (typeof bar.rh !== 'string' || typeof bar.lh !== 'string') fail(`bars[${i}] needs rh and lh token strings`);
    if (bar.barline !== undefined && !BARLINES.includes(bar.barline as string))
      fail(`bars[${i}].barline must be one of ${BARLINES.join(', ')}`);
  });

  string(top.author, 'author', fail, 100);
  string(top.reviewedBy, 'reviewedBy', fail, 100);
  if (
    typeof top.reviewedOn !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(top.reviewedOn) ||
    Number.isNaN(Date.parse(top.reviewedOn))
  )
    fail('reviewedOn must be a date YYYY-MM-DD');
  return json as LessonDefinition;
}

function validKey(raw: unknown, at: string, fail: Fail, extraFields = false): void {
  const key = object(raw, at, fail);
  if (!extraFields) known(key, KEY_FIELDS, at, fail);
  if (typeof key.tonic !== 'string' || !TONIC.test(key.tonic))
    fail(`${at}.tonic must be a letter with an optional # or b`);
  if (key.mode !== 'major' && key.mode !== 'minor') fail(`${at}.mode must be "major" or "minor"`);
  if (!Number.isInteger(key.fifths) || Math.abs(key.fifths as number) > 7) fail(`${at}.fifths must be from -7 to 7`);
}

function object(v: unknown, what: string, fail: Fail): Json {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(`${what} must be an object`);
  return v as Json;
}

function known(o: Json, fields: readonly string[], what: string, fail: Fail): void {
  for (const k of Object.keys(o)) if (!fields.includes(k)) fail(`${what} has an unknown field "${k}"`);
}

function string(v: unknown, what: string, fail: Fail, max: number): string {
  if (typeof v !== 'string' || v.trim() === '') fail(`${what} must be a non-empty string`);
  if ((v as string).length > max) fail(`${what} is longer than ${max} characters`);
  return v as string;
}
