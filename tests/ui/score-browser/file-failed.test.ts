import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { LibraryIndex } from '../../../src/core/library/types.js';
import { createBrowserStateStore } from '../../../src/ui/state/browserState.js';

/**
 * 017 T016 (from 013 T112; 013 contracts/score-browser.md section 3): a file that fails to open while the browser is
 * open shows its message in the browser - also while the browser is still loading its library index, which is when a
 * drop right after start-up lands. The message survives the index arriving.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const index: LibraryIndex = JSON.parse(fs.readFileSync(path.join(root, 'public/library/index.json'), 'utf8'));
const failure = { code: 'malformedXml' as const, fileName: 'broken.musicxml' };

describe('fileFailed: a failed file open reaches the open browser', () => {
  it('while loading: the message shows, stays loading, and survives the index arriving', () => {
    const state = createBrowserStateStore();
    state.open();
    expect(state.get().phase).toBe('loading');
    state.fileFailed(failure);
    expect(state.get().phase).toBe('loading');
    expect(state.get().message).toEqual(failure);
    state.indexLoaded(index, [], []);
    expect(state.get().phase).toBe('ready');
    expect(state.get().message).toEqual(failure);
  });

  it('while ready (e.g. a file too large, rejected before any opening starts): the message shows', () => {
    const state = createBrowserStateStore();
    state.open();
    state.indexLoaded(index, [], []);
    state.fileFailed(failure);
    expect(state.get().phase).toBe('ready');
    expect(state.get().message).toEqual(failure);
  });

  it('while opening: the same as openFailed - back to ready with the message', () => {
    const state = createBrowserStateStore();
    state.open();
    state.indexLoaded(index, [], []);
    state.startOpeningItem({ kind: 'file', fileKey: 'broken.musicxml' } as never);
    state.fileFailed(failure);
    expect(state.get().phase).toBe('ready');
    expect(state.get().message).toEqual(failure);
  });

  it('while closed: nothing (the load-error view shows it instead)', () => {
    const state = createBrowserStateStore();
    state.fileFailed(failure);
    expect(state.get().phase).toBe('closed');
    expect(state.get().message).toBeNull();
  });
});
