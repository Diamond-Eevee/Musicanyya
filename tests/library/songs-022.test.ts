// Feature 022 US3 (spec FR-030 - FR-035, FR-045, data-model §6): ten new tunes from owner-approved public-domain sources
// (research R13, OD-2), each as a full Intermediate song and a simplified Beginner song beside it.
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { filterItems } from '../../src/core/library/filter.js';
import type { LibraryIndex, LibraryItem } from '../../src/core/library/types.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const libraryRoot = path.join(root, 'public/library');
const index = JSON.parse(readFileSync(path.join(libraryRoot, 'index.json'), 'utf8')) as LibraryIndex;

/** The ten approved tunes of research R13, by the slug of their song id. */
const SONG_SLUGS_022 = [
  'the-first-noel',
  'passion-chorale',
  'it-came-upon-the-midnight-clear',
  'in-the-bleak-midwinter',
  'praise-to-the-lord',
  'nuz-my-dzis-krzescijani',
  'leoni',
  'immortal-invisible',
  'tryggare-kan-ingen-vara',
  'hark-the-herald-angels-sing',
] as const;

const songs = index.items.filter((i) => i.meta.step === 'song');
const find = (slug: string) => songs.find((i) => i.id.endsWith(`/song-${slug}`));
const sidecar = (item: LibraryItem) =>
  JSON.parse(readFileSync(path.join(libraryRoot, `${item.id}.json`), 'utf8')) as {
    simplifies?: string;
    composer?: string;
    provenance: { basedOn?: string; licence: string };
    departures?: string[];
  };
const RANK = ['introduction', 'beginner', 'intermediate', 'advanced'];

describe.each(SONG_SLUGS_022)('song-%s', (slug) => {
  const full = () => find(slug);
  const simplified = () => find(`${slug}-simplified`);

  it('has a full Intermediate song and a simplified Beginner song in the same key folder', () => {
    const f = full();
    const s = simplified();
    expect(f, `song-${slug}`).toBeDefined();
    expect(s, `song-${slug}-simplified`).toBeDefined();
    if (!f || !s) return;
    expect(f.meta.level).toBe('intermediate');
    expect(s.meta.level).toBe('beginner');
    expect(RANK.indexOf(f.meta.level)).toBeGreaterThan(RANK.indexOf(s.meta.level));
    expect(s.section).toBe(f.section);
    expect(s.meta.title).toBe(`${f.meta.title} (simplified)`);
    expect(sidecar(s).simplifies).toBe(f.id);
  });

  it('lists the simplified song directly before the full one', () => {
    const f = full();
    const s = simplified();
    if (!f || !s) throw new Error(`song-${slug} pair missing`);
    expect(s.meta.stepOrder).toBe((f.meta.stepOrder ?? 0) - 10);
  });

  it('names its composer, source and licence, and says what the simplified version changes (FR-032, FR-035)', () => {
    for (const item of [full(), simplified()]) {
      if (!item) throw new Error(`song-${slug} pair missing`);
      const meta = sidecar(item);
      expect(meta.composer ?? 'Traditional', item.id).not.toBe('');
      expect(meta.provenance.basedOn, item.id).toMatch(/mutopia/);
      expect(meta.provenance.licence).toBe('CC0-1.0');
    }
    const s = simplified();
    expect((s && sidecar(s).departures?.some((d) => /simplif|instead|held|fewer|one chord/i.test(d))) ?? false).toBe(
      true,
    );
  });

  it('is found by its level, its key and the tag chords (FR-003), and has no Orchestra (FR-045)', () => {
    for (const item of [full(), simplified()]) {
      if (!item) throw new Error(`song-${slug} pair missing`);
      const filtered = filterItems(index.items, index.sections, {
        sectionId: null,
        level: item.meta.level,
        key: item.facts.keys[0] ?? null,
        tag: 'chords',
        text: '',
      });
      expect(filtered.map((i) => i.id)).toContain(item.id);
      expect(item.facts.parts).toBe(1);
      expect(item.facts.orchestra).toBeUndefined();
    }
  });
});

describe('the new songs together (FR-030)', () => {
  const items = SONG_SLUGS_022.map((slug) => find(slug)).filter((i): i is LibraryItem => i !== undefined);

  it('cover at least three keys, two minor keys, and two songs in 3/4 or 6/8', () => {
    expect(items).toHaveLength(10);
    const keys = new Set(items.map((i) => i.facts.keys[0]));
    expect(keys.size).toBeGreaterThanOrEqual(3);
    expect(items.filter((i) => i.facts.keys[0]?.endsWith('minor')).length).toBeGreaterThanOrEqual(2);
    expect(items.filter((i) => i.facts.metres.some((m) => m === '3/4' || m === '6/8')).length).toBeGreaterThanOrEqual(
      2,
    );
  });
});
