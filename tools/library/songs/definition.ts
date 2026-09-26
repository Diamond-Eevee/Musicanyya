// The song definition (contract song-definition 1.0.0 §1): content/library/songs/*.json. Validated by hand, like the source
// manifest, so every problem names the field. Read by tools/library/build-songs.ts only; the app never sees it.
import { keySlug } from '../../../src/core/library/exercise/keys';

export class SongDefinitionError extends Error {
  constructor(detail: string) {
    super(`song definition: ${detail}`);
    this.name = 'SongDefinitionError';
  }
}

export type SongInversion = 0 | 1 | 2;
export type SongQuality = 'major' | 'minor' | 'diminished' | 'augmented';

export interface SongChordEntry {
  /** Written bar of the item (0 = pickup). */
  bar: number;
  /** Beat of that bar, counted in the metre's beat unit from 1. */
  beat?: number;
  /** A Roman numeral of the shelf key: its case says major or minor unless `quality` says otherwise. */
  degree: string;
  quality?: SongQuality;
  inversion?: SongInversion;
  /** "bar:beat" the chord lasts until; default: the next chord, or the end. */
  until?: string;
}

export interface SongDefinition {
  version: 1;
  /** The item id to write: `learning/keys/<key>/song-<slug>`. */
  id: string;
  title: string;
  /** An approved source-manifest id under content/library/sources/. */
  source: string;
  melody: {
    staff: number;
    voice: string;
    topVoice?: boolean;
    /** "all" or "N-M" in the source's printed bar numbers. */
    bars: string;
    /** A signed interval like "-M2" or "+P4". */
    transpose?: string;
  };
  key: { tonic: string; mode: 'major' | 'minor'; fifths: number };
  tempoBpm: number;
  chords: SongChordEntry[];
  meta: {
    level: 'beginner' | 'intermediate';
    trains: string;
    composer?: string;
    departures?: string[];
    reviewedBy: string;
    reviewedOn: string;
  };
}

const TOP_FIELDS = ['version', 'id', 'title', 'source', 'melody', 'key', 'tempoBpm', 'chords', 'meta'];
const MELODY_FIELDS = ['staff', 'voice', 'topVoice', 'bars', 'transpose'];
const KEY_FIELDS = ['tonic', 'mode', 'fifths'];
const CHORD_FIELDS = ['bar', 'beat', 'degree', 'quality', 'inversion', 'until'];
const META_FIELDS = ['level', 'trains', 'composer', 'departures', 'reviewedBy', 'reviewedOn'];
const QUALITIES = ['major', 'minor', 'diminished', 'augmented'];
const ID = /^learning\/keys\/([a-z0-9-]+)\/song-[a-z0-9-]+$/;
const BARS = /^(?:all|\d+-\d+)$/;
const TRANSPOSE = /^[+-](?:P1|m2|M2|m3|M3|P4|A4|d5|P5|m6|M6|m7|M7|P8)$/;
const DEGREE = /^(?:i{1,3}|iv|v|vi{1,2})$/i;
const UNTIL = /^(\d+):(\d+(?:\.\d+)?)$/;
const TEMPO_MIN = 30;
const TEMPO_MAX = 160;

type Fail = (detail: string) => never;
type Json = Record<string, unknown>;

/** Validates `json` against the contract's schema and rules; `sources` is the set of approved source ids. */
export function validateSongDefinition(json: unknown, sources: ReadonlySet<string>): SongDefinition {
  const fail: Fail = (detail) => {
    throw new SongDefinitionError(detail);
  };
  const top = object(json, 'the definition', fail);
  known(top, TOP_FIELDS, 'the definition', fail);
  if (top.version !== 1) fail('version must be 1');

  const id = string(top.id, 'id', fail, 120);
  const idMatch = ID.exec(id);
  if (!idMatch) fail(`id "${id}" must be learning/keys/<key>/song-<name> (lower case letters, digits and hyphens)`);
  string(top.title, 'title', fail, 80);
  const source = string(top.source, 'source', fail, 100);
  if (!sources.has(source)) fail(`source "${source}" is not an approved source under content/library/sources`);

  const melody = object(top.melody, 'melody', fail);
  known(melody, MELODY_FIELDS, 'melody', fail);
  if (!Number.isInteger(melody.staff) || (melody.staff as number) < 1)
    fail('melody.staff must be an integer of 1 or more');
  string(melody.voice, 'melody.voice', fail, 100);
  if (melody.topVoice !== undefined && typeof melody.topVoice !== 'boolean')
    fail('melody.topVoice must be true or false');
  if (typeof melody.bars !== 'string' || !BARS.test(melody.bars)) fail('melody.bars must be "all" or "N-M"');
  if (melody.transpose !== undefined && (typeof melody.transpose !== 'string' || !TRANSPOSE.test(melody.transpose)))
    fail('melody.transpose must be an interval like "-M2" or "+P4"');

  const key = object(top.key, 'key', fail);
  known(key, KEY_FIELDS, 'key', fail);
  const tonic = string(key.tonic, 'key.tonic', fail, 4);
  if (key.mode !== 'major' && key.mode !== 'minor') fail('key.mode must be "major" or "minor"');
  if (!Number.isInteger(key.fifths) || Math.abs(key.fifths as number) > 7)
    fail('key.fifths must be an integer from -7 to 7');
  const folder = keySlug({ tonic, mode: key.mode as 'major' | 'minor' });
  if (idMatch?.[1] !== folder) fail(`id "${id}" sits in the folder ${idMatch?.[1]}, but the key is ${folder}`);

  if (typeof top.tempoBpm !== 'number' || top.tempoBpm < TEMPO_MIN || top.tempoBpm > TEMPO_MAX)
    fail(`tempoBpm must be a number from ${TEMPO_MIN} to ${TEMPO_MAX}`);

  if (!Array.isArray(top.chords) || top.chords.length === 0) fail('chords must be a non-empty list');
  let previous = -1;
  (top.chords as unknown[]).forEach((raw, i) => {
    const at = `chords[${i}]`;
    const chord = object(raw, at, fail);
    known(chord, CHORD_FIELDS, at, fail);
    if (!Number.isInteger(chord.bar) || (chord.bar as number) < 0) fail(`${at}.bar must be an integer of 0 or more`);
    if (chord.beat !== undefined && (typeof chord.beat !== 'number' || chord.beat < 1))
      fail(`${at}.beat must be a number of 1 or more`);
    if (typeof chord.degree !== 'string' || !DEGREE.test(chord.degree))
      fail(`${at}.degree must be a Roman numeral from I to VI`);
    if (chord.quality !== undefined && !QUALITIES.includes(chord.quality as string))
      fail(`${at}.quality must be one of ${QUALITIES.join(', ')}`);
    if (chord.inversion !== undefined && ![0, 1, 2].includes(chord.inversion as number))
      fail(`${at}.inversion must be 0, 1 or 2`);
    if (chord.until !== undefined && (typeof chord.until !== 'string' || !UNTIL.test(chord.until)))
      fail(`${at}.until must be "bar:beat"`);
    const position = (chord.bar as number) * 1000 + ((chord.beat as number | undefined) ?? 1);
    if (position <= previous) fail(`${at} does not come after the chord before it`);
    previous = position;
  });

  const meta = object(top.meta, 'meta', fail);
  known(meta, META_FIELDS, 'meta', fail);
  if (meta.level !== 'beginner' && meta.level !== 'intermediate')
    fail('meta.level must be "beginner" or "intermediate"');
  string(meta.trains, 'meta.trains', fail, 1000);
  if (meta.composer !== undefined) string(meta.composer, 'meta.composer', fail, 200);
  if (meta.departures !== undefined) {
    if (!Array.isArray(meta.departures) || meta.departures.length === 0)
      fail('meta.departures must list at least one departure when present');
    for (const d of meta.departures as unknown[]) string(d, 'meta.departures[]', fail, 500);
  }
  string(meta.reviewedBy, 'meta.reviewedBy', fail, 100);
  if (
    typeof meta.reviewedOn !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(meta.reviewedOn) ||
    Number.isNaN(Date.parse(meta.reviewedOn))
  )
    fail('meta.reviewedOn must be a date YYYY-MM-DD');
  return json as SongDefinition;
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
