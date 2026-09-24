import { MAX_FILE_BYTES } from '../defaults.js';
import type {
  ItemFacts,
  ItemMetadata,
  Level,
  LevelCheck,
  LibraryIndex,
  LibraryItem,
  LibrarySection,
  Provenance,
  SkillTag,
} from './types.js';
import { SKILL_TAGS } from './types.js';

/** contracts/library-index.md §3: an item that fails validation is skipped and reported, never fatal
 *  to the rest of the index; a `version` other than 1 rejects the whole index with one notice. */
export type IndexNotice =
  | { code: 'unsupportedVersion' }
  | { code: 'invalidItem'; id: string }
  | { code: 'itemTooLarge'; id: string }
  | { code: 'invalidSection'; id: string };

export interface ParsedLibraryIndex {
  index: LibraryIndex;
  notices: readonly IndexNotice[];
}

const LEVELS: readonly Level[] = ['beginner', 'intermediate', 'advanced'];
const KINDS = ['exercise', 'piece'] as const;
const HANDS = ['right', 'left', 'both'] as const;
/** contracts/library-index.md 1.1.0 `departures`: 1 to 8 entries, each 1 to 200 characters. */
const DEPARTURES_MAX_ENTRIES = 8;
const DEPARTURE_MAX_CHARS = 200;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isSkillTag(value: unknown): value is SkillTag {
  return typeof value === 'string' && (SKILL_TAGS as readonly string[]).includes(value);
}

function validProvenance(raw: unknown): Provenance | null {
  if (!isObject(raw)) return null;
  if (raw.origin === 'authored') {
    if (raw.licence !== 'CC0-1.0') return null;
    if (!isNonEmptyString(raw.author) || !isNonEmptyString(raw.created)) return null;
    const provenance: Provenance = { origin: 'authored', licence: 'CC0-1.0', author: raw.author, created: raw.created };
    if (isNonEmptyString(raw.basedOn)) provenance.basedOn = raw.basedOn;
    if (isNonEmptyString(raw.note)) provenance.note = raw.note;
    return provenance;
  }
  if (raw.origin === 'downloaded') {
    if (raw.licence !== 'CC0-1.0' && raw.licence !== 'public-domain') return null;
    if (!isNonEmptyString(raw.source) || !isNonEmptyString(raw.obtained)) return null;
    const provenance: Provenance = {
      origin: 'downloaded',
      licence: raw.licence,
      source: raw.source,
      obtained: raw.obtained,
    };
    if (isNonEmptyString(raw.sourcePath)) provenance.sourcePath = raw.sourcePath;
    if (isNonEmptyString(raw.credit)) provenance.credit = raw.credit;
    if (typeof raw.unmodified === 'boolean') provenance.unmodified = raw.unmodified;
    if (isNonEmptyString(raw.note)) provenance.note = raw.note;
    return provenance;
  }
  return null;
}

/** Exported so `tools/library/build-index.ts` validates a sidecar against exactly the same rules the
 *  runtime index reader uses - one schema, never two that can drift apart. */
export function validMetadata(raw: unknown): ItemMetadata | null {
  if (!isObject(raw)) return null;
  if (raw.version !== 1) return null;
  if (!isNonEmptyString(raw.title)) return null;
  if (!KINDS.includes(raw.kind as (typeof KINDS)[number])) return null;
  if (!LEVELS.includes(raw.level as Level)) return null;
  if (!Array.isArray(raw.tags) || raw.tags.length === 0 || !raw.tags.every(isSkillTag)) return null;
  const provenance = validProvenance(raw.provenance);
  if (!provenance) return null;
  if (!isNonEmptyString(raw.reviewedBy) || !isNonEmptyString(raw.reviewedOn)) return null;
  if (raw.departures !== undefined && !validDepartures(raw.departures)) return null;

  const meta: ItemMetadata = {
    version: 1,
    title: raw.title,
    kind: raw.kind as ItemMetadata['kind'],
    level: raw.level as Level,
    tags: raw.tags as SkillTag[],
    provenance,
    reviewedBy: raw.reviewedBy,
    reviewedOn: raw.reviewedOn,
  };
  if (isNonEmptyString(raw.subtitle)) meta.subtitle = raw.subtitle;
  if (raw.composer === null || isNonEmptyString(raw.composer)) meta.composer = raw.composer;
  if (raw.arranger === null || isNonEmptyString(raw.arranger)) meta.arranger = raw.arranger;
  if (isNonEmptyString(raw.trains)) meta.trains = raw.trains;
  if (HANDS.includes(raw.hands as (typeof HANDS)[number])) meta.hands = raw.hands as (typeof HANDS)[number];
  if (typeof raw.arrangement === 'boolean') meta.arrangement = raw.arrangement;
  if (isObject(raw.expected) && (raw.expected.notices === undefined || isStringArray(raw.expected.notices))) {
    meta.expected = isStringArray(raw.expected.notices) ? { notices: raw.expected.notices } : {};
  }
  if (isNonEmptyString(raw.raisedBecause)) meta.raisedBecause = raw.raisedBecause;
  if (isStringArray(raw.limitations)) meta.limitations = raw.limitations;
  if (validDepartures(raw.departures)) meta.departures = raw.departures;
  return meta;
}

function validDepartures(value: unknown): value is string[] {
  return (
    isStringArray(value) &&
    value.length >= 1 &&
    value.length <= DEPARTURES_MAX_ENTRIES &&
    value.every((d) => d.length >= 1 && d.length <= DEPARTURE_MAX_CHARS)
  );
}

function validFacts(raw: unknown): ItemFacts | null {
  if (!isObject(raw)) return null;
  const required = [
    'measures',
    'notes',
    'durationSeconds',
    'lowestMidi',
    'highestMidi',
    'maxSpanSemitones',
    'staves',
    'shortestDivision',
    'notesPerBeat',
    'accidentals',
  ];
  for (const key of required) {
    if (!isFiniteNumber(raw[key])) return null;
  }
  if (!isStringArray(raw.keys) || !isStringArray(raw.metres) || !isStringArray(raw.notices)) return null;
  if (raw.tempoBpm !== null && !isFiniteNumber(raw.tempoBpm)) return null;

  const facts: ItemFacts = {
    measures: raw.measures as number,
    notes: raw.notes as number,
    durationSeconds: raw.durationSeconds as number,
    keys: raw.keys,
    metres: raw.metres,
    tempoBpm: raw.tempoBpm as number | null,
    lowestMidi: raw.lowestMidi as number,
    highestMidi: raw.highestMidi as number,
    maxSpanSemitones: raw.maxSpanSemitones as number,
    staves: raw.staves as number,
    shortestDivision: raw.shortestDivision as number,
    notesPerBeat: raw.notesPerBeat as number,
    accidentals: raw.accidentals as number,
    notices: raw.notices,
  };
  if (typeof raw.tempoDefaulted === 'boolean') facts.tempoDefaulted = raw.tempoDefaulted;
  if (HANDS.includes(raw.handsWithNotes as (typeof HANDS)[number])) {
    facts.handsWithNotes = raw.handsWithNotes as (typeof HANDS)[number];
  }
  for (const flag of ['hasTies', 'hasTuplets', 'hasGraceNotes', 'hasOctaveShift', 'hasRepeats', 'hasPedal'] as const) {
    if (typeof raw[flag] === 'boolean') facts[flag] = raw[flag] as boolean;
  }
  if (isFiniteNumber(raw.fingeringCoverage)) facts.fingeringCoverage = raw.fingeringCoverage;

  // The `checkLevel` inputs (data-model.md §4) - a MINOR addition, same reasoning as the flags above.
  for (const numeric of [
    'parts',
    'tempoChanges',
    'maxLeapSemitones',
    'longestRunAtShortestValue',
    'peakNotesPerSecond',
    'accidentalMarkCount',
    'maxTieChainNotes',
    'maxTieBarlinesCrossed',
    'graceNoteCount',
    'ornamentCount',
    'backwardRepeatCount',
  ] as const) {
    if (isFiniteNumber(raw[numeric])) facts[numeric] = raw[numeric] as number;
  }
  if (typeof raw.hasNonSimpleTuplet === 'boolean') facts.hasNonSimpleTuplet = raw.hasNonSimpleTuplet;
  if (['none', 'simple', 'voltas', 'jumps'].includes(raw.repeatKind as string)) {
    facts.repeatKind = raw.repeatKind as 'none' | 'simple' | 'voltas' | 'jumps';
  }
  return facts;
}

function validLevelCheck(raw: unknown): LevelCheck | undefined {
  if (!isObject(raw)) return undefined;
  if (!LEVELS.includes(raw.level as Level)) return undefined;
  if (typeof raw.pass !== 'boolean') return undefined;
  if (!isStringArray(raw.failed)) return undefined;
  return { level: raw.level as Level, pass: raw.pass, failed: raw.failed };
}

function validSection(raw: unknown): LibrarySection | null {
  if (!isObject(raw)) return null;
  if (!isNonEmptyString(raw.id) || !isNonEmptyString(raw.title) || !isNonEmptyString(raw.path)) return null;
  if (raw.parent !== null && typeof raw.parent !== 'string') return null;
  if (!Number.isInteger(raw.order)) return null;
  const section: LibrarySection = {
    id: raw.id,
    title: raw.title,
    path: raw.path,
    parent: raw.parent as string | null,
    order: raw.order as number,
  };
  if (isNonEmptyString(raw.description)) section.description = raw.description;
  return section;
}

function validItem(raw: unknown): { item: LibraryItem | null; tooLarge: boolean } {
  if (!isObject(raw)) return { item: null, tooLarge: false };
  if (!isNonEmptyString(raw.id) || !isNonEmptyString(raw.section) || !isNonEmptyString(raw.file)) {
    return { item: null, tooLarge: false };
  }
  if (!isFiniteNumber(raw.bytes) || raw.bytes < 1 || !isNonEmptyString(raw.hash)) {
    return { item: null, tooLarge: false };
  }
  const meta = validMetadata(raw.meta);
  const facts = validFacts(raw.facts);
  if (!meta || !facts) return { item: null, tooLarge: false };
  if (raw.bytes > MAX_FILE_BYTES) return { item: null, tooLarge: true };

  const item: LibraryItem = {
    id: raw.id,
    section: raw.section,
    file: raw.file,
    bytes: raw.bytes,
    hash: raw.hash,
    meta,
    facts,
  };
  const levelCheck = validLevelCheck(raw.levelCheck);
  if (levelCheck) item.levelCheck = levelCheck;
  return { item, tooLarge: false };
}

const EMPTY_INDEX: LibraryIndex = { version: 1, generated: '', sections: [], items: [] };

/** Parses and validates a raw `index.json` payload (contracts/library-index.md §3). Never throws. */
export function parseLibraryIndex(raw: unknown): ParsedLibraryIndex {
  if (!isObject(raw) || raw.version !== 1) {
    return { index: EMPTY_INDEX, notices: [{ code: 'unsupportedVersion' }] };
  }

  const notices: IndexNotice[] = [];

  const sections: LibrarySection[] = [];
  const rawSections = Array.isArray(raw.sections) ? raw.sections : [];
  for (const rawSection of rawSections) {
    const section = validSection(rawSection);
    if (section) {
      sections.push(section);
    } else if (isObject(rawSection) && isNonEmptyString(rawSection.id)) {
      notices.push({ code: 'invalidSection', id: rawSection.id });
    }
  }

  const items: LibraryItem[] = [];
  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  for (const rawItem of rawItems) {
    const { item, tooLarge } = validItem(rawItem);
    if (item) {
      items.push(item);
    } else if (isObject(rawItem) && isNonEmptyString(rawItem.id)) {
      notices.push({ code: tooLarge ? 'itemTooLarge' : 'invalidItem', id: rawItem.id });
    }
  }

  const generated = isNonEmptyString(raw.generated) ? raw.generated : '';
  return { index: { version: 1, generated, sections, items }, notices };
}
