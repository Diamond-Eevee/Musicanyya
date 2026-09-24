// The shelf's fidelity audit (feature 007, contract audit-record.md §2). First part (T026): every committed source
// validates and still has its recorded hashes, and every audit record re-runs from those files to exactly its
// recorded result and keeps the rules - including the sidecar's reviewedBy/reviewedOn. Second part (T078): coverage
// (rule 2.1), the outcome/claim rules against the library index, the reviewer rule from the shelf's side (SC-006),
// and the freshness of docs/library-audit.md.
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { LibraryIndex } from '../../src/core/library/types.js';
import {
  type AuditRecord,
  type CheckResult,
  checkRecord,
  loadRecords,
  type RunContext,
  runRecord,
} from '../../tools/library/fidelity/records.js';
import { renderReport } from '../../tools/library/fidelity/report.js';
import { loadSources } from '../../tools/library/fidelity/sources.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcesRoot = path.join(root, 'content/library/sources');
const ctx: RunContext = {
  sources: loadSources(sourcesRoot),
  sourcesRoot,
  libraryRoot: path.join(root, 'public/library'),
};
const records = loadRecords(path.join(root, 'content/library/audit'));
const index = JSON.parse(readFileSync(path.join(root, 'public/library/index.json'), 'utf8')) as LibraryIndex;
const reportPath = path.join(root, 'docs/library-audit.md');

/** Re-run results, shared by the per-record tests and the report freshness test (each record runs once). */
const results = new Map<string, CheckResult[]>();
const resultsOf = (record: AuditRecord): CheckResult[] => {
  let r = results.get(record.itemId);
  if (!r) {
    r = runRecord(record, ctx);
    results.set(record.itemId, r);
  }
  return r;
};

describe('library fidelity audit (contracts audit-record.md, source-manifest.md)', () => {
  it('every source under content/library/sources validates and its files match their SHA-256', () => {
    // loadSources throws on the first invalid manifest or changed file; reaching here means all passed.
    expect(ctx.sources.size).toBeGreaterThan(0);
    for (const manifest of ctx.sources.values()) expect(manifest.approvedByOwner).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('every record validates (schema, and stored under its own item id)', () => {
    expect(records.length).toBeGreaterThan(0);
  });

  it.each(records.map((r) => [r.itemId, r] as const))(
    '%s re-runs to its recorded result and keeps rules 2.2-2.6 (incl. the sidecar reviewer)',
    (_id, record) => {
      const run = resultsOf(record);
      expect(checkRecord(record, run, ctx)).toEqual([]);
      expect(run.map((r) => r.reproduced)).toEqual(run.map(() => true));
    },
    120_000,
  );

  it('coverage (rule 2.1, FR-001, SC-001): record ids = shelf ids + removed ids, nothing missing, nothing extra', () => {
    const recordIds = records.map((r) => r.itemId).sort();
    const removedIds = records.filter((r) => r.outcome === 'removed').map((r) => r.itemId);
    const expected = [...index.items.map((i) => i.id), ...removedIds].sort();
    expect(new Set(recordIds).size).toBe(recordIds.length);
    expect(recordIds).toEqual(expected);
    // A removed item is really gone from the shelf.
    const shelf = new Set(index.items.map((i) => i.id));
    expect(removedIds.filter((id) => shelf.has(id))).toEqual([]);
  });

  it('outcome/claim consistency (rules 2.3, 2.4): each claim matches the shelf item it describes', () => {
    const byId = new Map(records.map((r) => [r.itemId, r]));
    const wrong: string[] = [];
    for (const item of index.items) {
      const record = byId.get(item.id);
      if (!record) continue; // reported by the coverage test
      if (record.outcome === 'removed') wrong.push(`${item.id}: outcome removed, but still on the shelf`);
      if ((record.claim === 'exercise') !== (item.meta.kind === 'exercise'))
        wrong.push(`${item.id}: claim ${record.claim}, but the item is a ${item.meta.kind}`);
      if (record.claim === 'arrangement' && item.meta.arrangement !== true)
        wrong.push(`${item.id}: claim arrangement, but the index says arrangement is not true`);
      if ((record.claim === 'original' || record.claim === 'excerpt') && item.meta.arrangement === true)
        wrong.push(`${item.id}: claim ${record.claim}, but the index says arrangement: true`);
      if (record.outcome === 'relabelled' && !record.previous)
        wrong.push(`${item.id}: relabelled without the previous claims`);
    }
    expect(wrong).toEqual([]);
  });

  it('reviewer (SC-006): no shelf item names a review without an audit record by the same reviewer and date', () => {
    const byId = new Map(records.map((r) => [r.itemId, r]));
    const unbacked = index.items
      .filter((i) => byId.get(i.id)?.checkedBy !== i.meta.reviewedBy || byId.get(i.id)?.date !== i.meta.reviewedOn)
      .map((i) => `${i.id}: reviewedBy ${i.meta.reviewedBy} on ${i.meta.reviewedOn}`);
    expect(unbacked).toEqual([]);
  });

  it('docs/library-audit.md equals a fresh render (run `pnpm library:fidelity` after changing a record)', () => {
    expect(existsSync(reportPath), 'docs/library-audit.md exists').toBe(true);
    for (const record of records) resultsOf(record);
    const fresh = renderReport(records, results, index, ctx.sources);
    expect(readFileSync(reportPath, 'utf8').replace(/\r\n/g, '\n')).toBe(fresh);
  }, 600_000);
});
