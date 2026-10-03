import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkLevel } from '../../src/core/library/levels.js';
import type { LibraryIndex } from '../../src/core/library/types.js';

// Feature 022 SC-006 and FR-006: the level check changed (owner decision OD-1: no level bans notation), but no existing
// item changes level. `base-levels.json` holds every item id and level of the index at commit 38867c7 (task T002); each
// must still be in the index with the same level and pass the level check of today's code - an item that now measures
// below its level keeps it with a `raisedBecause` naming why.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const index = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../public/library/index.json'), 'utf-8'),
) as LibraryIndex;
const baseLevels = JSON.parse(fs.readFileSync(path.join(__dirname, 'base-levels.json'), 'utf-8')) as Record<
  string,
  string
>;
const byId = new Map(index.items.map((item) => [item.id, item]));

describe('022: every existing item keeps its level (SC-006, FR-006)', () => {
  it('the base list is the 186 items of commit 38867c7', () => {
    expect(Object.keys(baseLevels)).toHaveLength(186);
  });

  it.each(Object.entries(baseLevels))('%s is still %s and passes the level check', (id, level) => {
    const item = byId.get(id);
    expect(item, `${id} is missing from the index`).toBeDefined();
    if (!item) return;
    expect(item.meta.level).toBe(level);
    expect(item.levelCheck?.pass).toBe(true);
    // Today's check on the item's facts, with the options build-index.ts passes
    const check = checkLevel(item.facts, item.meta.level, {
      ...(item.meta.raisedBecause !== undefined ? { raisedBecause: item.meta.raisedBecause } : {}),
      expectedNotices: item.meta.expected?.notices ?? [],
      kind: item.meta.kind,
      ...(item.meta.arrangement !== undefined ? { arrangement: item.meta.arrangement } : {}),
    });
    expect(check, `${id}: failed [${check.failed.join(', ')}]`).toEqual({ level, pass: true, failed: [] });
  });
});
