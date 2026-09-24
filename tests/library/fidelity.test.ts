// The shelf's fidelity audit (feature 007, contract audit-record.md §2). First part (T026): every committed source
// validates and still has its recorded hashes, and every audit record re-runs from those files to exactly its
// recorded result and keeps the rules - including the sidecar's reviewedBy/reviewedOn. The coverage, outcome/claim
// and report-freshness rules are added by task T078.
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkRecord, loadRecords, type RunContext, runRecord } from '../../tools/library/fidelity/records.js';
import { loadSources } from '../../tools/library/fidelity/sources.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcesRoot = path.join(root, 'content/library/sources');
const ctx: RunContext = {
  sources: loadSources(sourcesRoot),
  sourcesRoot,
  libraryRoot: path.join(root, 'public/library'),
};
const records = loadRecords(path.join(root, 'content/library/audit'));

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
      const results = runRecord(record, ctx);
      expect(checkRecord(record, results, ctx)).toEqual([]);
      expect(results.map((r) => r.reproduced)).toEqual(results.map(() => true));
    },
    120_000,
  );
});
