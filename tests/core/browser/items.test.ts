import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildBrowserItems } from '../../../src/core/browser/items.js';
import { filterItems } from '../../../src/core/library/filter.js';
import type { LibraryIndex } from '../../../src/core/library/types.js';
import { DEFAULT_MASTERY_THRESHOLDS } from '../../../src/core/progress/types.js';

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
});
