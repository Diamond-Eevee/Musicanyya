// specs/013-score-browser-progress T059 (US3) - data-model.md §5, research.md R-11: identity, versions and the
// display progress of a musician's own file.
import { describe, expect, it } from 'vitest';
import { buildBrowserItems } from '../../../src/core/browser/items.js';
import { USER_FILE_VERSIONS_MAX } from '../../../src/core/defaults.js';
import { DEFAULT_MASTERY_THRESHOLDS } from '../../../src/core/progress/types.js';
import { entryProgress, fileKey, nextEntry } from '../../../src/core/progress/user-files.js';
import { record, result, userFile } from '../../fakes/progress-builders.js';

const compare = (a: string, b: string) => a.localeCompare(b);

describe('fileKey (R-11)', () => {
  it('folds case', () => {
    expect(fileKey('Etude.xml')).toBe(fileKey('etude.xml'));
  });

  it('folds Unicode normalisation (NFC composed = NFD decomposed)', () => {
    const composed = 'Étude.xml'; // U+00C9 (single code point)
    const decomposed = 'Étude.xml'; // E + U+0301 combining acute accent
    expect(fileKey(composed)).toBe(fileKey(decomposed));
  });
});

describe('nextEntry (data-model.md §5, FR-021)', () => {
  const openedAt = '2026-02-01T00:00:00.000Z';

  it('a new name creates a fresh entry, origin opened, no earlier hashes', () => {
    const entry = nextEntry(null, {
      fileName: 'Etude.musicxml',
      hash: 'a'.repeat(64),
      byteLength: 1024,
      title: 'Etude',
      composer: 'Composer',
      openedAt,
    });
    expect(entry.fileKey).toBe('etude.musicxml');
    expect(entry.fileName).toBe('Etude.musicxml');
    expect(entry.hash).toBe('a'.repeat(64));
    expect(entry.earlierHashes).toEqual([]);
    expect(entry.origin).toBe('opened');
    expect(entry.addedAt).toBe(openedAt);
    expect(entry.lastOpenedAt).toBe(openedAt);
    expect(entry.stored).toBe(true);
  });

  it('the same name and content touches the entry: lastOpenedAt updates, no new version', () => {
    const existing = userFile({
      fileName: 'Etude.musicxml',
      hash: 'a'.repeat(64),
      earlierHashes: ['b'.repeat(64)],
      addedAt: '2026-01-01T00:00:00.000Z',
      lastOpenedAt: '2026-01-01T00:00:00.000Z',
    });
    const touched = nextEntry(existing, {
      fileName: 'Etude.musicxml',
      hash: 'a'.repeat(64),
      byteLength: existing.byteLength,
      title: existing.title,
      composer: existing.composer,
      openedAt,
    });
    expect(touched.hash).toBe('a'.repeat(64));
    expect(touched.earlierHashes).toEqual(['b'.repeat(64)]);
    expect(touched.addedAt).toBe('2026-01-01T00:00:00.000Z'); // unchanged
    expect(touched.lastOpenedAt).toBe(openedAt);
  });

  it('the same name with new content moves the old hash to the front of earlierHashes', () => {
    const existing = userFile({ fileName: 'Etude.musicxml', hash: 'a'.repeat(64), earlierHashes: ['b'.repeat(64)] });
    const versioned = nextEntry(existing, {
      fileName: 'Etude.musicxml',
      hash: 'c'.repeat(64),
      byteLength: existing.byteLength,
      title: existing.title,
      composer: existing.composer,
      openedAt,
    });
    expect(versioned.hash).toBe('c'.repeat(64));
    expect(versioned.earlierHashes).toEqual(['a'.repeat(64), 'b'.repeat(64)]);
  });

  it('earlierHashes is capped at USER_FILE_VERSIONS_MAX', () => {
    const full = Array.from({ length: USER_FILE_VERSIONS_MAX }, (_, i) => i.toString(16).padStart(64, '0'));
    const existing = userFile({ fileName: 'Etude.musicxml', hash: 'a'.repeat(64), earlierHashes: full });
    const versioned = nextEntry(existing, {
      fileName: 'Etude.musicxml',
      hash: 'c'.repeat(64),
      byteLength: existing.byteLength,
      title: existing.title,
      composer: existing.composer,
      openedAt,
    });
    expect(versioned.earlierHashes).toHaveLength(USER_FILE_VERSIONS_MAX);
    expect(versioned.earlierHashes[0]).toBe('a'.repeat(64)); // the just-replaced hash is kept
    expect(versioned.earlierHashes).not.toContain(full.at(-1)); // the oldest one fell off
  });

  it('the same content under another name is a separate entry with the same hash (existing looked up by name)', () => {
    const entry = nextEntry(null, {
      fileName: 'Copy of Etude.musicxml',
      hash: 'a'.repeat(64),
      byteLength: 1024,
      title: 'Etude',
      composer: null,
      openedAt,
    });
    expect(entry.fileKey).toBe('copy of etude.musicxml');
    expect(entry.hash).toBe('a'.repeat(64));
    expect(entry.earlierHashes).toEqual([]);
  });
});

describe('entryProgress (data-model.md §5)', () => {
  it('takes status, best, Mastered and trend from the current hash only; sums attempts; flags earlier-version results', () => {
    const currentHash = 'a'.repeat(64);
    const olderHash = 'b'.repeat(64);
    const currentBest = result({ runId: 'current', finishedAt: '2026-02-01T00:00:00.000Z' });
    const olderBest = result({
      runId: 'older',
      finishedAt: '2026-01-01T00:00:00.000Z',
      notesCorrect: { count: 99, total: 100 },
    });
    const records = new Map([
      [
        currentHash,
        record({
          scoreKey: currentHash,
          attempts: 2,
          results: [currentBest],
          best: currentBest,
          masteredAt: null,
          lastPlayedAt: currentBest.finishedAt,
        }),
      ],
      [
        olderHash,
        record({
          scoreKey: olderHash,
          attempts: 3,
          results: [olderBest],
          best: olderBest,
          masteredAt: '2026-01-01T00:00:00.000Z',
          masteredBy: 'older',
          lastPlayedAt: olderBest.finishedAt,
        }),
      ],
    ]);
    const entry = userFile({ hash: currentHash, earlierHashes: [olderHash] });

    const view = entryProgress(entry, records);

    // Status/best/Mastered/trend come from the current hash only - the older record's Mastered does not carry over.
    expect(view.status).toBe('played');
    expect(view.best).toEqual(currentBest);
    expect(view.attempts).toBe(5); // summed over both hashes
    expect(view.history).toHaveLength(2);
    const currentEntry = view.history.find((h) => h.result.runId === 'current');
    const olderEntry = view.history.find((h) => h.result.runId === 'older');
    expect(currentEntry?.earlierVersion).toBe(false);
    expect(olderEntry?.earlierVersion).toBe(true);
  });
});

describe('buildBrowserItems file rows (FR-026, analyze A13)', () => {
  it('puts the file name into a file row searchText, so search finds a file by its name', () => {
    const entry = userFile({ fileName: 'Nocturne in E flat.musicxml', title: null });
    const items = buildBrowserItems(null, [entry], [], DEFAULT_MASTERY_THRESHOLDS, compare);
    const row = items.find((i) => i.ref.kind === 'file' && i.ref.fileKey === entry.fileKey);
    expect(row).toBeDefined();
    expect(row?.searchText).toContain('nocturne in e flat.musicxml');
  });
});
