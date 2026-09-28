import { describe, expect, it } from 'vitest';
import { filterOptions } from '../../../src/core/browser/filter-options.js';
import type { BrowserItem } from '../../../src/core/browser/types.js';

const compare = (a: string, b: string) => a.localeCompare(b);

function row(keys: string[], tags: BrowserItem['tags']): BrowserItem {
  return {
    ref: { kind: 'library', id: `item-${keys.join('-')}-${tags.join('-')}` },
    scoreKey: 'k',
    title: 'T',
    subtitle: null,
    folderPath: [],
    sectionId: null,
    level: null,
    keys,
    tags,
    durationSeconds: null,
    measures: null,
    step: null,
    stepOrder: null,
    libraryOrder: 0,
    searchText: 't',
    progress: { status: 'new', best: null, last: null, trend: null, attempts: 0, lastPlayedAt: null, history: [] },
    stored: true,
  };
}

describe('filterOptions (T083 support)', () => {
  it('lists every key and skill that occurs in some row, once, sorted; rows without any add nothing', () => {
    const options = filterOptions(
      [
        row(['G major', 'E minor'], ['scales', 'ties']),
        row(['C major'], ['scales']),
        row([], []), // a My files row
      ],
      compare,
    );
    expect(options.keys).toEqual(['C major', 'E minor', 'G major']);
    expect(options.tags).toEqual(['scales', 'ties']);
  });

  it('is empty for no rows', () => {
    expect(filterOptions([], compare)).toEqual({ keys: [], tags: [] });
  });
});
