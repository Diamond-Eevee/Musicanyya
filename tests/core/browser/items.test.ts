import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildBrowserItems } from '../../../src/core/browser/items.js';
import { filterItems } from '../../../src/core/library/filter.js';
import type { LibraryIndex } from '../../../src/core/library/types.js';
import { DEFAULT_MASTERY_THRESHOLDS } from '../../../src/core/progress/types.js';
import { libraryIndexOf, record, result, userFile } from '../../fakes/progress-builders.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const compare = (a: string, b: string) => a.localeCompare(b);

function realIndex(): LibraryIndex {
  return JSON.parse(fs.readFileSync(path.join(root, 'public/library/index.json'), 'utf8'));
}

describe('buildBrowserItems (T013)', () => {
  it('gives one row per library item, with title, subtitle, folderPath, level, keys, measures, duration and step', () => {
    const index = realIndex();
    const items = buildBrowserItems(index, [], [], DEFAULT_MASTERY_THRESHOLDS, compare);
    expect(items.length).toBe(index.items.length);

    const row = items.find((i) => i.ref.kind === 'library' && i.ref.id === 'learning/keys/a-minor/song-greensleeves');
    expect(row).toBeDefined();
    if (!row) throw new Error('unreachable');
    expect(row.title).toBe('Song - Greensleeves');
    expect(row.subtitle).toBe('Traditional (English) (arr. Musicanyya practice material)');
    expect(row.folderPath).toEqual(['Learning', 'Keys', 'A minor']);
    expect(row.sectionId).toBe('learning/keys/a-minor');
    expect(row.level).toBe('intermediate');
    expect(row.keys).toEqual(['A minor']);
    expect(row.measures).toBe(17);
    expect(row.durationSeconds).toBeCloseTo(34.642857142857146);
    expect(row.step).toBe('song');
    expect(row.stepOrder).toBe(10);
    expect(row.stored).toBe(true);
  });

  it('libraryOrder equals 011s panel order (buildSectionTree depth-first, then step rank, stepOrder, title)', () => {
    const index = realIndex();
    const items = buildBrowserItems(index, [], [], DEFAULT_MASTERY_THRESHOLDS, compare);
    const byLibraryOrder = [...items]
      .sort((a, b) => a.libraryOrder - b.libraryOrder)
      .map((i) => (i.ref.kind === 'library' ? i.ref.id : null));

    const panelOrder = filterItems(
      index.items,
      index.sections,
      { sectionId: null, level: null, key: null, tag: null, text: '' },
      compare,
    ).map((i) => i.id);
    expect(byLibraryOrder).toEqual(panelOrder);
  });

  it('every row shows status new with no records', () => {
    const index = realIndex();
    const items = buildBrowserItems(index, [], [], DEFAULT_MASTERY_THRESHOLDS, compare);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.progress.status).toBe('new');
      expect(item.progress.best).toBeNull();
      expect(item.progress.attempts).toBe(0);
    }
  });

  it('searchText contains title, composer, arranger and folder names (FR-026)', () => {
    const index = realIndex();
    const items = buildBrowserItems(index, [], [], DEFAULT_MASTERY_THRESHOLDS, compare);
    const row = items.find((i) => i.ref.kind === 'library' && i.ref.id === 'learning/keys/a-minor/song-greensleeves');
    expect(row).toBeDefined();
    if (!row) throw new Error('unreachable');
    expect(row.searchText).toContain('song - greensleeves');
    expect(row.searchText).toContain('traditional (english)');
    expect(row.searchText).toContain('musicanyya practice material');
    expect(row.searchText).toContain('learning');
    expect(row.searchText).toContain('keys');
    expect(row.searchText).toContain('a minor');
  });

  it('with no index, gives no library rows', () => {
    const items = buildBrowserItems(null, [], [], DEFAULT_MASTERY_THRESHOLDS, compare);
    expect(items).toEqual([]);
  });

  it('an item whose supersedes[].hash has a record shows that progress as its own (Edge Cases: library replacement)', () => {
    const index = libraryIndexOf(4);
    const item0 = index.items[0];
    if (!item0) throw new Error('unreachable');
    const oldHash = 'f'.repeat(64);
    item0.meta.supersedes = [{ id: 'old-item-id', hash: oldHash }];
    const oldResult = result({ runId: 'old-run', finishedAt: '2026-01-01T00:00:00.000Z' });
    const records = [record({ scoreKey: oldHash, attempts: 1, results: [oldResult], best: oldResult })];

    const items = buildBrowserItems(index, [], records, DEFAULT_MASTERY_THRESHOLDS, compare);
    const row = items.find((i) => i.ref.kind === 'library' && i.ref.id === item0.id);
    expect(row).toBeDefined();
    if (!row) throw new Error('unreachable');
    expect(row.progress.status).toBe('played');
    expect(row.progress.attempts).toBe(1);
    expect(row.progress.best).toEqual(oldResult);
    // The old hash's result counts as current (the library decided the replacement is the same piece) - never
    // flagged earlierVersion, unlike a My files entry's own earlierHashes (data-model.md §6 vs §5).
    expect(row.progress.history).toEqual([{ ...oldResult, earlierVersion: false }]);
  });

  it('a file entry with earlierHashes flags an older hash result earlierVersion: true (data-model.md §5)', () => {
    const oldHash = 'e'.repeat(64);
    const entry = userFile({ fileName: 'Etude.musicxml', earlierHashes: [oldHash] });
    const oldResult = result({ runId: 'old-run', finishedAt: '2026-01-01T00:00:00.000Z' });
    const records = [record({ scoreKey: oldHash, attempts: 1, results: [oldResult], best: oldResult })];

    const items = buildBrowserItems(null, [entry], records, DEFAULT_MASTERY_THRESHOLDS, compare);
    const row = items[0];
    expect(row).toBeDefined();
    if (!row) throw new Error('unreachable');
    expect(row.progress.attempts).toBe(1);
    expect(row.progress.history).toEqual([{ ...oldResult, earlierVersion: true }]);
  });

  it('FR-012: an item whose file has a new hash starts fresh as New while a leftover record for its old hash raises nothing', () => {
    const index = realIndex();
    const targetId = 'learning/key-changes/c-major-to-a-minor/introduction';
    const otherId = 'learning/keys/c-major/introduction';

    const targetItem = index.items.find((i) => i.id === targetId);
    const otherItem = index.items.find((i) => i.id === otherId);
    if (!targetItem || !otherItem) throw new Error('missing test items');

    const oldHash = targetItem.hash;
    const newHash = 'a'.repeat(64);
    // Simulate that the shelf has been regenerated with a new hash, and no supersedes link exists
    targetItem.hash = newHash;

    const oldResult = result({ runId: 'old-kc-run', finishedAt: '2026-09-01T10:00:00.000Z' });
    const otherResult = result({ runId: 'other-run', finishedAt: '2026-09-01T11:00:00.000Z' });

    const records = [
      record({ scoreKey: oldHash, attempts: 2, results: [oldResult], best: oldResult }),
      record({ scoreKey: otherItem.hash, attempts: 1, results: [otherResult], best: otherResult }),
    ];

    const items = buildBrowserItems(index, [], records, DEFAULT_MASTERY_THRESHOLDS, compare);

    const targetRow = items.find((i) => i.ref.kind === 'library' && i.ref.id === targetId);
    expect(targetRow).toBeDefined();
    if (!targetRow) throw new Error('unreachable');
    expect(targetRow.progress.status).toBe('new');
    expect(targetRow.progress.best).toBeNull();
    expect(targetRow.progress.attempts).toBe(0);
    expect(targetRow.progress.history).toEqual([]);

    const otherRow = items.find((i) => i.ref.kind === 'library' && i.ref.id === otherId);
    expect(otherRow).toBeDefined();
    if (!otherRow) throw new Error('unreachable');
    expect(otherRow.progress.status).toBe('played');
    expect(otherRow.progress.attempts).toBe(1);
    expect(otherRow.progress.best).toEqual(otherResult);
  });
});
