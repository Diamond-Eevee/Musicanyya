import { afterEach, describe, expect, it } from 'vitest';
import type { LibraryItem } from '../../src/core/library/types.js';
import { libraryState } from '../../src/ui/state/libraryState.js';
import { libraryIndexOf } from '../fakes/progress-builders.js';

// Feature 013 T092. What the retired panel kept here - the load status machine, the selected section, the open
// folders, the persisted filter and its `formerIds` successor - is now the browser's, and is tested there:
//   load status (loading/ready/indexError/opening)          -> tests/engine/browser-session.test.ts, tests/ui/score-browser/dialog.test.ts
//   a corrupt or invalid stored filter falls back per field -> tests/core/browser/view-state.test.ts
//   no filter when nothing is stored                        -> tests/core/browser/view-state.test.ts
//   a stored section id follows `formerIds`                 -> tests/core/browser/view-state.test.ts
//   the filter survives a reload                            -> tests/e2e/score-browser.spec.ts (US5 Independent Test), tests/ui/score-browser/filters.test.ts
// What is left is the opened item that `mx-score-source` shows.
describe('libraryState: the opened item', () => {
  afterEach(() => libraryState.reset());

  const item = (): LibraryItem => {
    const first = libraryIndexOf(1).items[0];
    if (!first) throw new Error('fixture');
    return first;
  };

  it('starts with no opened item and tells subscribers when one is set and cleared', () => {
    expect(libraryState.getOpenedItem()).toBeNull();
    const seen: (string | null)[] = [];
    const unsubscribe = libraryState.subscribeOpenedItem((i) => seen.push(i?.id ?? null));

    libraryState.setOpenedItem(item());
    libraryState.setOpenedItem(null);
    unsubscribe();
    libraryState.setOpenedItem(item());

    expect(seen).toEqual([item().id, null]);
  });

  it('reset() forgets the opened item', () => {
    libraryState.setOpenedItem(item());
    libraryState.reset();
    expect(libraryState.getOpenedItem()).toBeNull();
  });
});
