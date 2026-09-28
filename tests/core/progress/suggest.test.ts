import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildBrowserItems } from '../../../src/core/browser/items.js';
import type { BrowserItem } from '../../../src/core/browser/types.js';
import { CONTINUE_ITEMS_MAX, MORE_PRACTICE_AFTER_RUNS } from '../../../src/core/defaults.js';
import { buildSectionTree } from '../../../src/core/library/tree.js';
import type { LibraryIndex } from '../../../src/core/library/types.js';
import { continueItems, morePractice, suggestNext } from '../../../src/core/progress/suggest.js';
import {
  DEFAULT_MASTERY_THRESHOLDS,
  type ItemRef,
  type ProgressRecord,
  type ProgressResult,
} from '../../../src/core/progress/types.js';
import { record, result, userFile } from '../../fakes/progress-builders.js';

// Real library index (T071): the suggestions must hold on the content the musician actually gets.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const index: LibraryIndex = JSON.parse(fs.readFileSync(path.join(root, 'public/library/index.json'), 'utf8'));
const tree = buildSectionTree(index.sections, index.items);
const compare = (a: string, b: string) => a.localeCompare(b);

const C = 'learning/keys/c-major';
const A_MINOR = 'learning/keys/a-minor';
const G_MAJOR = 'learning/keys/g-major';
const KC_LAST = 'learning/key-changes/a-major-to-a-minor';
const KC_EXTRA_FOLDER = 'learning/key-changes/a-minor-to-a-major';

const lib = (id: string): ItemRef => ({ kind: 'library', id });

function hashOf(id: string): string {
  const item = index.items.find((i) => i.id === id);
  if (!item) throw new Error(`no such library item: ${id}`);
  return item.hash;
}

/** A moment `n` minutes after a fixed start, so ordering in the tests is explicit. */
function at(n: number): string {
  return new Date(Date.UTC(2026, 8, 1, 10, n)).toISOString();
}

let runCounter = 0;
function wholeRun(n: number, overrides: Partial<ProgressResult> = {}): ProgressResult {
  runCounter += 1;
  return result({ runId: `suggest-run-${runCounter}`, finishedAt: at(n), ...overrides });
}

/** A record that only says "opened" - status New. */
function opened(id: string, minute: number, extra: Partial<ProgressRecord> = {}): ProgressRecord {
  return record({
    scoreKey: hashOf(id),
    openedAs: lib(id),
    firstOpenedAt: at(minute),
    lastOpenedAt: at(minute),
    updatedAt: at(minute),
    ...extra,
  });
}

/** A mastered record (status Mastered), opened at `minute`. */
function mastered(id: string, minute: number): ProgressRecord {
  const r = wholeRun(minute, { notesCorrect: { count: 100, total: 100 }, notesOnTime: { count: 100, total: 100 } });
  return opened(id, minute, {
    attempts: 1,
    firstPlayedAt: r.finishedAt,
    lastPlayedAt: r.finishedAt,
    best: r,
    masteredAt: r.finishedAt,
    masteredBy: r.runId,
    results: [r],
  });
}

/** A record with `runs` played runs and no mastery. */
function played(id: string, minute: number, runs: ProgressResult[]): ProgressRecord {
  const sorted = [...runs].sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt));
  return opened(id, minute, {
    attempts: runs.length,
    firstPlayedAt: sorted[sorted.length - 1]?.finishedAt ?? null,
    lastPlayedAt: sorted[0]?.finishedAt ?? null,
    best: sorted[0] ?? null,
    results: sorted,
  });
}

/** Every id mastered, `lastId` opened last (so it is the anchor of the suggestion); `lastId` need not be in `ids`. */
function masteredAll(ids: readonly string[], lastId: string): ProgressRecord[] {
  const others = ids.filter((id) => id !== lastId).map((id, n) => mastered(id, n));
  return [...others, mastered(lastId, 9999)];
}

function itemsFor(records: readonly ProgressRecord[], files = [] as ReturnType<typeof userFile>[]): BrowserItem[] {
  return buildBrowserItems(index, files, records, DEFAULT_MASTERY_THRESHOLDS, compare);
}

function idsOfSection(sectionId: string, pick: (step: string | undefined, order: number) => boolean): string[] {
  return index.items
    .filter((i) => i.section === sectionId && pick(i.meta.step, i.meta.stepOrder ?? 0))
    .map((i) => i.id);
}

describe('continueItems (T071, US4 #1)', () => {
  it('lists up to CONTINUE_ITEMS_MAX items, newest lastOpenedAt first', () => {
    const ids = index.items.slice(0, CONTINUE_ITEMS_MAX + 4).map((i) => i.id);
    const records = ids.map((id, n) => opened(id, n));
    const entries = continueItems(itemsFor(records), records);
    expect(entries).toHaveLength(CONTINUE_ITEMS_MAX);
    const expected = [...ids].reverse().slice(0, CONTINUE_ITEMS_MAX);
    expect(entries.map((e) => (e.item.ref.kind === 'library' ? e.item.ref.id : null))).toEqual(expected);
    expect(entries[0]?.lastOpenedAt).toBe(at(ids.length - 1));
  });

  it('skips records whose item no longer exists, and records that were never opened', () => {
    const gone = record({
      scoreKey: 'f'.repeat(64),
      openedAs: lib('learning/keys/removed-folder/gone'),
      lastOpenedAt: at(50),
    });
    const neverOpened = record({ scoreKey: hashOf(`${C}/beginner`), lastOpenedAt: null, openedAs: null, attempts: 1 });
    const kept = opened(`${C}/introduction`, 10);
    const records = [gone, neverOpened, kept];
    const entries = continueItems(itemsFor(records), records);
    expect(entries.map((e) => e.item.ref)).toEqual([lib(`${C}/introduction`)]);
  });

  it('lists one card per item when two records (an older hash and the current one) point at it', () => {
    const current = opened(`${C}/introduction`, 20);
    const older = opened(`${C}/introduction`, 30, { scoreKey: 'a'.repeat(64) });
    const records = [current, older];
    const entries = continueItems(itemsFor(records), records);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.lastOpenedAt).toBe(at(30));
  });

  it('resolves a My files record through its fileKey', () => {
    const file = userFile({ fileKey: 'etude.xml', fileName: 'Etude.xml' });
    const rec = record({
      scoreKey: file.hash,
      openedAs: { kind: 'file', fileKey: 'etude.xml' },
      lastOpenedAt: at(5),
    });
    const entries = continueItems(itemsFor([rec], [file]), [rec]);
    expect(entries.map((e) => e.item.ref)).toEqual([{ kind: 'file', fileKey: 'etude.xml' }]);
  });

  it('is empty for no records', () => {
    expect(continueItems(itemsFor([]), [])).toEqual([]);
  });
});

describe('suggestNext (T071, US4 #2 and #3, R-10)', () => {
  it('an unmastered recent stepped item -> continue it', () => {
    const records = [opened(`${C}/beginner`, 5), played(`${C}/introduction`, 9, [wholeRun(9)])];
    expect(suggestNext(itemsFor(records), records, tree)).toEqual({ kind: 'continue', ref: lib(`${C}/introduction`) });
  });

  it('mastered C major - Introduction -> C major - Beginner, after Introduction', () => {
    const records = [mastered(`${C}/introduction`, 5)];
    expect(suggestNext(itemsFor(records), records, tree)).toEqual({
      kind: 'next',
      ref: lib(`${C}/beginner`),
      after: lib(`${C}/introduction`),
    });
  });

  it('mastered Beginner with Introduction never played -> Intermediate, not back to Introduction', () => {
    const records = [mastered(`${C}/beginner`, 5)];
    expect(suggestNext(itemsFor(records), records, tree)).toEqual({
      kind: 'next',
      ref: lib(`${C}/intermediate`),
      after: lib(`${C}/beginner`),
    });
  });

  it('mastered Advanced -> the folders first unmastered song', () => {
    const records = [mastered(`${C}/advanced`, 5)];
    expect(suggestNext(itemsFor(records), records, tree)).toEqual({
      kind: 'next',
      ref: lib(`${C}/song-au-clair-de-la-lune`),
      after: lib(`${C}/advanced`),
    });
  });

  it('everything in C major mastered -> A minor, its first unmastered main step', () => {
    const records = masteredAll(
      idsOfSection(C, (step) => step !== undefined),
      `${C}/advanced`,
    );
    const suggestion = suggestNext(itemsFor(records), records, tree);
    expect(suggestion).toEqual({ kind: 'next', ref: lib(`${A_MINOR}/introduction`), after: lib(`${C}/advanced`) });
  });

  it('skips a fully mastered next folder', () => {
    const everyStepOf = (section: string) => idsOfSection(section, (step) => step !== undefined);
    const records = masteredAll([...everyStepOf(C), ...everyStepOf(A_MINOR)], `${C}/advanced`);
    const suggestion = suggestNext(itemsFor(records), records, tree);
    expect(suggestion).toEqual({ kind: 'next', ref: lib(`${G_MAJOR}/introduction`), after: lib(`${C}/advanced`) });
  });

  it('a folder with main steps mastered but a song left offers the song before moving on', () => {
    const mains = idsOfSection(A_MINOR, (step, order) => step !== 'song' && step !== undefined && order < 10);
    const records = masteredAll(mains, `${A_MINOR}/advanced`);
    expect(suggestNext(itemsFor(records), records, tree)).toEqual({
      kind: 'next',
      ref: lib(`${A_MINOR}/song-greensleeves`),
      after: lib(`${A_MINOR}/advanced`),
    });
  });

  it('never suggests an extra (stepOrder >= 10) as the next step', () => {
    // a-minor-to-a-major has Introduction, Beginner, Intermediate and the extra "minor-and-major" (intermediate:10).
    const mains = [`${KC_EXTRA_FOLDER}/introduction`, `${KC_EXTRA_FOLDER}/beginner`, `${KC_EXTRA_FOLDER}/intermediate`];
    const records = masteredAll(mains, `${KC_EXTRA_FOLDER}/intermediate`);
    const suggestion = suggestNext(itemsFor(records), records, tree);
    expect(suggestion).toEqual({
      kind: 'next',
      ref: lib(`${KC_LAST}/introduction`),
      after: lib(`${KC_EXTRA_FOLDER}/intermediate`),
    });
    for (const id of index.items.filter((i) => (i.meta.stepOrder ?? 0) >= 10 && i.meta.step !== 'song')) {
      expect(suggestion).not.toMatchObject({ ref: lib(id.id) });
    }
  });

  it('a mastered extra with no main step mastered suggests the folders first main step', () => {
    const records = [mastered(`${C}/i-v-vi-iv`, 5)];
    expect(suggestNext(itemsFor(records), records, tree)).toEqual({
      kind: 'next',
      ref: lib(`${C}/introduction`),
      after: lib(`${C}/i-v-vi-iv`),
    });
  });

  it('most recent item not stepped -> the most recent stepped one in history', () => {
    const records = [
      opened(`${C}/beginner`, 5),
      opened('repertoire/beginner/ode-to-joy', 20),
      opened(`${C}/introduction`, 3),
    ];
    expect(suggestNext(itemsFor(records), records, tree)).toEqual({ kind: 'continue', ref: lib(`${C}/beginner`) });
  });

  it('wraps to an earlier unmastered folder when everything after the last one is mastered', () => {
    const steppedAfterC = index.items.filter((i) => i.meta.step !== undefined && !i.id.startsWith(`${C}/`));
    const records = masteredAll(
      steppedAfterC.map((i) => i.id),
      `${KC_LAST}/intermediate`,
    );
    expect(suggestNext(itemsFor(records), records, tree)).toEqual({
      kind: 'next',
      ref: lib(`${C}/introduction`),
      after: lib(`${KC_LAST}/intermediate`),
    });
  });

  it('every stepped item mastered -> none', () => {
    const records = masteredAll(
      index.items.filter((i) => i.meta.step !== undefined).map((i) => i.id),
      `${KC_LAST}/intermediate`,
    );
    expect(suggestNext(itemsFor(records), records, tree)).toEqual({ kind: 'none' });
  });

  it('no history -> firstSteps: the first key folders first main step and the Repertoire > Beginner section id', () => {
    expect(suggestNext(itemsFor([]), [], tree)).toEqual({
      kind: 'firstSteps',
      ref: lib(`${C}/introduction`),
      repertoireSectionId: 'repertoire/beginner',
    });
  });

  it('history of only non-stepped items (Repertoire, My files) -> firstSteps as well', () => {
    const file = userFile({ fileKey: 'etude.xml', fileName: 'Etude.xml' });
    const records = [
      opened('repertoire/beginner/ode-to-joy', 5),
      record({ scoreKey: file.hash, openedAs: { kind: 'file', fileKey: 'etude.xml' }, lastOpenedAt: at(8) }),
    ];
    expect(suggestNext(itemsFor(records, [file]), records, tree)).toMatchObject({ kind: 'firstSteps' });
  });

  it('no library at all -> none', () => {
    const items = buildBrowserItems(null, [], [], DEFAULT_MASTERY_THRESHOLDS, compare);
    expect(suggestNext(items, [], [])).toEqual({ kind: 'none' });
  });
});

describe('morePractice (T071, R-10)', () => {
  const folder = KC_EXTRA_FOLDER;

  it(`offers the same steps first extra after ${MORE_PRACTICE_AFTER_RUNS} whole complete runs without Mastered`, () => {
    const runs = Array.from({ length: MORE_PRACTICE_AFTER_RUNS }, (_, n) => wholeRun(n));
    const records = [played(`${folder}/intermediate`, 10, runs)];
    expect(morePractice(itemsFor(records), records)).toEqual(lib(`${folder}/minor-and-major`));
  });

  it('is null one run short', () => {
    const runs = Array.from({ length: MORE_PRACTICE_AFTER_RUNS - 1 }, (_, n) => wholeRun(n));
    const records = [played(`${folder}/intermediate`, 10, runs)];
    expect(morePractice(itemsFor(records), records)).toBeNull();
  });

  it('does not count stopped runs, runs of unknown completeness or partial scopes', () => {
    const runs = [
      wholeRun(1, { complete: false }),
      wholeRun(2, { complete: null }),
      wholeRun(3, { scope: { kind: 'partial', fromMeasure: 1, toMeasure: 4, hands: null } }),
      wholeRun(4),
      wholeRun(5),
    ];
    const records = [played(`${folder}/intermediate`, 10, runs)];
    expect(morePractice(itemsFor(records), records)).toBeNull();
  });

  it('is null once the item is Mastered', () => {
    const runs = Array.from({ length: MORE_PRACTICE_AFTER_RUNS }, (_, n) => wholeRun(n));
    const base = played(`${folder}/intermediate`, 10, runs);
    const records = [{ ...base, masteredAt: at(9), masteredBy: runs[0]?.runId ?? null }];
    expect(morePractice(itemsFor(records), records)).toBeNull();
  });

  it('is null when the step has no extra', () => {
    const runs = Array.from({ length: MORE_PRACTICE_AFTER_RUNS }, (_, n) => wholeRun(n));
    const records = [played(`${folder}/beginner`, 10, runs)];
    expect(morePractice(itemsFor(records), records)).toBeNull();
  });

  it('is null when there is no stepped history, or the anchor is itself an extra', () => {
    const runs = Array.from({ length: MORE_PRACTICE_AFTER_RUNS }, (_, n) => wholeRun(n));
    expect(morePractice(itemsFor([]), [])).toBeNull();
    const extra = [played(`${folder}/minor-and-major`, 10, runs)];
    expect(morePractice(itemsFor(extra), extra)).toBeNull();
  });
});
