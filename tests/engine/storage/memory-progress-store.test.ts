import { describe, expect, it } from 'vitest';
import { MemoryProgressStore } from '../../../src/engine/storage/memory-progress-store.js';
import { describeProgressStoreContract } from './progress-store.contract.js';

describe('MemoryProgressStore (contracts/progress-store.md §3)', () => {
  describeProgressStoreContract('MemoryProgressStore', () => new MemoryProgressStore());

  it('is always available', async () => {
    const store = new MemoryProgressStore();
    expect(await store.availability()).toBe('available');
  });

  it('structurally clones on write and read, so a caller cannot mutate stored state', async () => {
    const store = new MemoryProgressStore();
    const as = { kind: 'library' as const, id: 'x' };
    await store.apply(
      'a'.repeat(64),
      { type: 'opened', at: '2026-01-01T00:00:00.000Z', as },
      {
        notesCorrectMinPercent: 90,
        notesOnTimeMinPercent: 80,
        tempoPercentMin: 100,
        minStrictness: 'beginner',
        maxExtraPercent: 10,
      },
    );
    as.id = 'mutated'; // mutating the caller's own object after the call must not reach the store

    const got = await store.getProgress('a'.repeat(64));
    expect(got.ok && got.value?.openedAs).toEqual({ kind: 'library', id: 'x' });

    if (got.ok && got.value) got.value.attempts = 999; // mutating the returned record must not reach the store
    const again = await store.getProgress('a'.repeat(64));
    expect(again.ok && again.value?.attempts).toBe(0);
  });
});
