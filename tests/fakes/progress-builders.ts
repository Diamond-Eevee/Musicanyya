// Test data builders for the Score browser and progress feature (013-score-browser-progress).
// Every builder returns a value valid by specs/013-score-browser-progress/data-model.md - no placeholder values.
import { PROGRESS_FORMAT_VERSION } from '../../src/core/defaults.js';
import type { LibraryIndex, LibraryItem, LibrarySection, Step } from '../../src/core/library/types.js';
import type {
  ItemRef,
  ProgressEvent,
  ProgressRecord,
  ProgressResult,
  ResultScope,
  UserFileEntry,
} from '../../src/core/progress/types.js';

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}
function hexHash(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(h, 31) + seed.charCodeAt(i)) | 0;
  const hex = (h >>> 0).toString(16).padStart(8, '0');
  return hex.repeat(8).slice(0, 64);
}

export function result(overrides: Partial<ProgressResult> = {}): ProgressResult {
  return {
    runId: overrides.runId ?? nextId('run'),
    finishedAt: overrides.finishedAt ?? '2026-01-01T00:00:00.000Z',
    notesCorrect: overrides.notesCorrect ?? { count: 80, total: 100 },
    notesOnTime: overrides.notesOnTime ?? { count: 70, total: 80 },
    extra: overrides.extra ?? 0,
    tempoPercent: overrides.tempoPercent ?? 100,
    strictness: overrides.strictness ?? 'beginner',
    complete: overrides.complete === undefined ? true : overrides.complete,
    scope: overrides.scope ?? ({ kind: 'whole' } satisfies ResultScope),
  };
}

export function record(overrides: Partial<ProgressRecord> = {}): ProgressRecord {
  const at = overrides.updatedAt ?? '2026-01-01T00:00:00.000Z';
  return {
    format: PROGRESS_FORMAT_VERSION,
    scoreKey: overrides.scoreKey ?? hexHash(nextId('score')),
    updatedAt: at,
    firstOpenedAt: overrides.firstOpenedAt === undefined ? at : overrides.firstOpenedAt,
    lastOpenedAt: overrides.lastOpenedAt === undefined ? at : overrides.lastOpenedAt,
    openedAs: overrides.openedAs ?? null,
    lastPractisedAt: overrides.lastPractisedAt ?? null,
    practisedBars: overrides.practisedBars ?? null,
    attempts: overrides.attempts ?? 0,
    firstPlayedAt: overrides.firstPlayedAt ?? null,
    lastPlayedAt: overrides.lastPlayedAt ?? null,
    best: overrides.best ?? null,
    masteredAt: overrides.masteredAt ?? null,
    masteredBy: overrides.masteredBy ?? null,
    results: overrides.results ?? [],
  };
}

export function userFile(overrides: Partial<UserFileEntry> = {}): UserFileEntry {
  const at = overrides.updatedAt ?? '2026-01-01T00:00:00.000Z';
  const fileName = overrides.fileName ?? 'Etude.musicxml';
  return {
    format: PROGRESS_FORMAT_VERSION,
    fileKey: overrides.fileKey ?? fileName.normalize('NFC').toLowerCase(),
    fileName,
    title: overrides.title ?? null,
    composer: overrides.composer ?? null,
    hash: overrides.hash ?? hexHash(nextId('file')),
    earlierHashes: overrides.earlierHashes ?? [],
    byteLength: overrides.byteLength ?? 2048,
    addedAt: overrides.addedAt === undefined ? at : overrides.addedAt,
    lastOpenedAt: overrides.lastOpenedAt === undefined ? at : overrides.lastOpenedAt,
    stored: overrides.stored === undefined ? true : overrides.stored,
    origin: overrides.origin ?? 'opened',
    updatedAt: at,
  };
}

function libraryItem(id: string, section: string, step?: Step): LibraryItem {
  return {
    id,
    section,
    file: `${id}.musicxml`,
    bytes: 1024,
    hash: hexHash(id),
    meta: {
      version: 1,
      title: id,
      composer: 'A. Composer',
      kind: 'piece',
      level: 'beginner',
      tags: ['sight-reading'],
      provenance: { origin: 'authored', licence: 'CC0-1.0', author: 'Musicanyya', created: '2026-01-01' },
      reviewedBy: 'music-domain-expert',
      reviewedOn: '2026-01-01',
      ...(step === undefined ? {} : { step, stepOrder: 0 }),
    },
    facts: {
      measures: 16,
      notes: 64,
      durationSeconds: 30,
      keys: ['C major'],
      metres: ['4/4'],
      tempoBpm: 100,
      lowestMidi: 60,
      highestMidi: 72,
      maxSpanSemitones: 7,
      staves: 2,
      shortestDivision: 8,
      notesPerBeat: 1,
      accidentals: 0,
      notices: [],
    },
  };
}

/** A synthetic library index of `n` items spread over a 3-level section tree with steps (like 011's 200-item
 *  synthetic index of the retired panel's tests): `Learning > Keys > Key {k}`, each key folder holding the four
 *  exercise steps in order, extra items appended to the last key folder once every step is used. */
export function libraryIndexOf(n: number): LibraryIndex {
  const steps: readonly Step[] = ['introduction', 'beginner', 'intermediate', 'advanced'];
  const sections: LibrarySection[] = [
    { id: 'learning', title: 'Learning', path: 'learning', parent: null, order: 1 },
    { id: 'learning/keys', title: 'Keys', path: 'learning/keys', parent: 'learning', order: 1 },
  ];
  const items: LibraryItem[] = [];
  let keyIndex = 0;
  while (items.length < n) {
    const keyId = `learning/keys/key-${keyIndex}`;
    sections.push({ id: keyId, title: `Key ${keyIndex}`, path: keyId, parent: 'learning/keys', order: keyIndex + 1 });
    for (let s = 0; s < steps.length && items.length < n; s++) {
      const step = steps.at(s);
      if (step === undefined) continue;
      items.push(libraryItem(`${keyId}/${step}`, keyId, step));
    }
    keyIndex++;
  }
  return { version: 1, generated: '2026-01-01T00:00:00.000Z', sections, items };
}

type HistoryEvent = ProgressEvent & { ref: ItemRef };

/** A deterministic (seeded) pseudo-random sequence of `n` progress events over one Score, with realistic counts:
 *  mostly `played`, some `practised` and `opened`, and occasional `resultRemoved` of an earlier `played` run. Used
 *  by the SC-004 reducer property test (T038) to compare a trimmed/reduced record against a naive recomputation
 *  over the full untrimmed list. */
export function historyOf(
  seed: number,
  n: number,
  ref: ItemRef = { kind: 'library', id: 'learning/keys/key-0/introduction' },
): HistoryEvent[] {
  // mulberry32, deterministic across platforms
  let s = seed >>> 0;
  const rand = (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const events: HistoryEvent[] = [];
  const playedRunIds: string[] = [];
  const startMs = Date.parse('2026-01-01T00:00:00.000Z');
  for (let i = 0; i < n; i++) {
    const at = new Date(startMs + i * 60_000).toISOString();
    const roll = rand();
    if (roll < 0.08 && i > 0) {
      events.push({ type: 'opened', at, as: ref, ref });
    } else if (roll < 0.16 && i > 0) {
      events.push({ type: 'practised', at, fromMeasure: 1, toMeasure: 8, ref });
    } else if (roll < 0.22 && playedRunIds.length > 0) {
      const runId = playedRunIds.at(Math.floor(rand() * playedRunIds.length));
      if (runId === undefined) continue;
      events.push({ type: 'resultRemoved', at, runId, ref });
    } else {
      const total = 100;
      const count = Math.floor(rand() * (total + 1));
      const onTimeTotal = count;
      const onTimeCount = Math.floor(rand() * (onTimeTotal + 1));
      const runId = nextId('hist-run');
      playedRunIds.push(runId);
      events.push({
        type: 'played',
        at,
        result: result({
          runId,
          finishedAt: at,
          notesCorrect: { count, total },
          notesOnTime: { count: onTimeCount, total: onTimeTotal },
          extra: Math.floor(rand() * 5),
          tempoPercent: 100,
          strictness: 'beginner',
          complete: rand() > 0.1,
        }),
        ref,
      });
    }
  }
  return events;
}
