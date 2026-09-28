import { describe, expect, it } from 'vitest';
import { folderProgress, MY_FILES_FOLDER_KEY } from '../../../src/core/browser/folders.js';
import { buildBrowserItems } from '../../../src/core/browser/items.js';
import { buildSectionTree } from '../../../src/core/library/tree.js';
import { DEFAULT_MASTERY_THRESHOLDS } from '../../../src/core/progress/types.js';
import { libraryIndexOf, record, userFile } from '../../fakes/progress-builders.js';

const compare = (a: string, b: string) => a.localeCompare(b);

describe('folderProgress (data-model.md §6, FR-014)', () => {
  it('every folder starts at zero played/mastered with no records', () => {
    const index = libraryIndexOf(4); // one key folder, 4 steps
    const items = buildBrowserItems(index, [], [], DEFAULT_MASTERY_THRESHOLDS, compare);
    const tree = buildSectionTree(index.sections, index.items);

    const counts = folderProgress(tree, items);
    expect(counts.get('learning')).toEqual({ played: 0, mastered: 0, total: 4 });
    expect(counts.get('learning/keys')).toEqual({ played: 0, mastered: 0, total: 4 });
    expect(counts.get('learning/keys/key-0')).toEqual({ played: 0, mastered: 0, total: 4 });
  });

  it("a folder's figures equal the sum over its items in its subtree (US2 #6)", () => {
    const index = libraryIndexOf(8); // two key folders of 4 steps each
    const item0 = index.items[0];
    const item1 = index.items[1];
    if (!item0 || !item1) throw new Error('unreachable');
    const records = [
      record({ scoreKey: item0.hash, attempts: 1, results: [], masteredAt: null }),
      record({
        scoreKey: item1.hash,
        attempts: 1,
        results: [],
        masteredAt: '2026-01-01T00:00:00.000Z',
        masteredBy: 'r1',
      }),
    ];
    const items = buildBrowserItems(index, [], records, DEFAULT_MASTERY_THRESHOLDS, compare);
    const tree = buildSectionTree(index.sections, index.items);

    const counts = folderProgress(tree, items);
    // Only the two records exist, one played (attempts>0, not mastered) and one mastered.
    expect(counts.get('learning')).toEqual({ played: 2, mastered: 1, total: 8 });
    expect(counts.get('learning/keys')).toEqual({ played: 2, mastered: 1, total: 8 });
    // Each key folder holds exactly one of the two progressed items.
    const key0 = counts.get('learning/keys/key-0');
    const key1 = counts.get('learning/keys/key-1');
    expect(key0).toBeDefined();
    expect(key1).toBeDefined();
    if (!key0 || !key1) throw new Error('unreachable');
    expect(key0.total).toBe(4);
    expect(key1.total).toBe(4);
    expect(key0.played + key1.played).toBe(2);
    expect(key0.mastered + key1.mastered).toBe(1);
  });

  it('mastered counts as played too ("5 of 8 played, 2 mastered" reads naturally)', () => {
    const index = libraryIndexOf(4);
    const item0 = index.items[0];
    if (!item0) throw new Error('unreachable');
    const records = [
      record({ scoreKey: item0.hash, attempts: 3, masteredAt: '2026-01-01T00:00:00.000Z', masteredBy: 'r1' }),
    ];
    const items = buildBrowserItems(index, [], records, DEFAULT_MASTERY_THRESHOLDS, compare);
    const tree = buildSectionTree(index.sections, index.items);

    const counts = folderProgress(tree, items);
    expect(counts.get('learning')).toEqual({ played: 1, mastered: 1, total: 4 });
  });

  it('one entry for *My files*, separate from every library section', () => {
    const index = libraryIndexOf(4);
    const files = [userFile({ fileName: 'Etude.musicxml' }), userFile({ fileName: 'Sonata.musicxml' })];
    const items = buildBrowserItems(index, files, [], DEFAULT_MASTERY_THRESHOLDS, compare);
    const tree = buildSectionTree(index.sections, index.items);

    const counts = folderProgress(tree, items);
    expect(counts.get(MY_FILES_FOLDER_KEY)).toEqual({ played: 0, mastered: 0, total: 2 });
    expect(counts.get('learning')).toEqual({ played: 0, mastered: 0, total: 4 });
  });

  it('with no items at all, gives an empty map', () => {
    const counts = folderProgress([], []);
    expect(counts.size).toBe(0);
  });
});
