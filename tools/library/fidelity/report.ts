// The audit report (contract audit-record.md §3): docs/library-audit.md, rendered from the audit records, their re-run
// results, the library index (shelf order, titles, departures) and the source manifests (edition and link).
// Deterministic: no timestamp other than the records' own dates, so a test can compare it with a fresh render.
import type { Level, LibraryIndex, LibraryItem } from '../../../src/core/library/types';
import { type AuditRecord, type Check, type CheckResult, outcomeLabel } from './records';
import type { SourceManifest } from './sources';

/** FR-022 / feature 005 FR-008: the minimum piece count per level. */
export const LEVEL_MINIMUMS: Readonly<Record<Level, number>> = { beginner: 7, intermediate: 5, advanced: 5 };

const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced'];
const OUTCOME_ROWS = ['verified', 'verified (visual)', 'fixed', 'replaced', 'relabelled', 'removed'];
/** Spec FR-020: what a replaced item means for the musician's Recents and progress. */
const RECENTS_NOTE =
  'Recent scores that opened the old version keep that copy; progress saved against it does not carry over.';

export function renderReport(
  records: AuditRecord[],
  results: Map<string, CheckResult[]>,
  index: LibraryIndex,
  sources: Map<string, SourceManifest>,
): string {
  const byId = new Map(records.map((r) => [r.itemId, r]));
  const shelf = new Set(index.items.map((i) => i.id));
  const missing = index.items.filter((i) => !byId.has(i.id)).map((i) => i.id);
  if (missing.length > 0) throw new Error(`shelf items without an audit record: ${missing.join(', ')}`);
  const stray = records.filter((r) => r.outcome !== 'removed' && !shelf.has(r.itemId)).map((r) => r.itemId);
  if (stray.length > 0) throw new Error(`records neither on the shelf nor removed: ${stray.join(', ')}`);

  const shelved = index.items.map((item) => ({ item, record: byId.get(item.id) as AuditRecord }));
  const removed = records.filter((r) => r.outcome === 'removed' && !shelf.has(r.itemId));
  const out: string[] = [
    '# Library fidelity audit',
    '',
    'Generated from `content/library/audit/`. Do not edit; run `pnpm library:fidelity`.',
    '',
  ];

  // Summary
  const labels = [...shelved.map(({ record }) => outcomeLabel(record)), ...removed.map(outcomeLabel)];
  out.push('## Summary', '', '| Outcome | Items |', '|---|---|');
  for (const o of OUTCOME_ROWS) out.push(`| ${o} | ${labels.filter((l) => l === o).length} |`);
  out.push(`| Total | ${labels.length} |`, '');

  // Level counts (pieces only; exercises are not counted against the minimums)
  out.push('## Level counts after the audit', '', '| Level | Pieces | Minimum | Status |', '|---|---|---|---|');
  for (const level of LEVELS) {
    const pieces = index.items.filter((i) => i.meta.kind === 'piece' && i.meta.level === level).length;
    const minimum = LEVEL_MINIMUMS[level];
    const status = pieces >= minimum ? 'meets the minimum' : `short by ${minimum - pieces} - reported to the owner`;
    out.push(`| ${level[0]?.toUpperCase()}${level.slice(1)} | ${pieces} | ${minimum} | ${status} |`);
  }
  out.push('');

  // Repertoire
  out.push(
    '## Repertoire',
    '',
    '| Item | Claim | Source | Method | Checked | Differences | Outcome | Date |',
    '|---|---|---|---|---|---|---|---|',
  );
  for (const { item, record } of shelved.filter(({ item }) => !isLearning(item.id))) {
    const checks = record.checks;
    out.push(
      row([
        itemCell(item.meta.title, item.id),
        record.claim,
        lines(checks.map((c) => sourceCell(c, sources))),
        lines(checks.map(methodCell)),
        lines(checks.map(checkedCell)),
        differencesCell(record, results.get(record.itemId) ?? []),
        outcomeLabel(record),
        record.date,
      ]),
    );
  }
  out.push('');

  // Learning
  out.push(
    '## Learning',
    '',
    '| Item | Claim | Rule set | Method | Differences | Outcome | Date |',
    '|---|---|---|---|---|---|---|',
  );
  for (const { item, record } of shelved.filter(({ item }) => isLearning(item.id))) {
    const checks = record.checks;
    out.push(
      row([
        itemCell(item.meta.title, item.id),
        record.claim,
        lines(checks.map((c) => (c.method === 'theory' ? c.ruleSet : sourceCell(c, sources)))),
        lines(checks.map(methodCell)),
        differencesCell(record, results.get(record.itemId) ?? []),
        outcomeLabel(record),
        record.date,
      ]),
    );
  }
  out.push('');

  // Removed
  out.push('## Removed', '', '| Item | Reason | Date |', '|---|---|---|');
  for (const r of removed)
    out.push(row([itemCell(r.previous?.title ?? r.itemId, r.itemId), cell(r.outcomeNote), r.date]));
  out.push('');

  // Notes
  out.push('## Notes', '');
  for (const { item, record } of shelved) {
    const body = notes(record, item, results.get(record.itemId) ?? []);
    if (body.length > 0) out.push(`### ${item.meta.title} (\`${item.id}\`)`, '', ...body, '');
  }
  for (const r of removed) {
    const body = notes(r, undefined, []);
    if (body.length > 0) out.push(`### ${r.previous?.title ?? r.itemId} (\`${r.itemId}\`, removed)`, '', ...body, '');
  }
  return `${out.join('\n').trimEnd()}\n`;
}

// ---- cells ---------------------------------------------------------------------------------------------------------

const isLearning = (id: string) => id.startsWith('learning/');
/** Free text in a table cell: no pipe splits the row, no newline ends it. */
const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');
const row = (cells: string[]) => `| ${cells.join(' | ')} |`;
const lines = (cells: string[]) => [...new Set(cells)].join('<br>');
const itemCell = (title: string, id: string) => `${cell(title)}<br>\`${id}\``;

function sourceCell(check: Check, sources: Map<string, SourceManifest>): string {
  if (check.method === 'theory') return 'none (theory check)';
  if (check.method === 'visual') return cell(check.source);
  const manifest = sources.get(check.source);
  return manifest ? `[${cell(manifest.edition)}](${manifest.url})` : cell(check.source);
}

function methodCell(check: Check): string {
  if (check.method === 'theory') return 'theory';
  if (check.method === 'visual') return `visual (bars ${cell(check.bars)})`;
  return `mechanical (bars ${check.alignment.itemBars})`;
}

function checkedCell(check: Check): string {
  if (check.method === 'theory') return check.ruleSet;
  if (check.method === 'visual') return 'visual comparison';
  return check.aspects.join(', ');
}

function differencesCell(record: AuditRecord, results: CheckResult[]): string {
  const counted = record.checks.reduce(
    (sum, c) => sum + (c.method === 'visual' ? c.differences.length : c.expectedDifferences),
    0,
  );
  const allowed = results.reduce((sum, r) => sum + r.allowed.length, 0);
  return allowed > 0 ? `${counted} (${allowed} allowed by departures)` : String(counted);
}

// ---- notes ---------------------------------------------------------------------------------------------------------

/** The full text behind a row: outcome note (unless a plain verified), difference notes, visual results, departures,
 *  allowed rhythm differences and, for a replaced item, the Recents note. Empty when there is nothing to add. */
function notes(record: AuditRecord, item: LibraryItem | undefined, results: CheckResult[]): string[] {
  const body: string[] = [];
  const differenceNotes = record.checks.flatMap((c) => (c.method === 'mechanical' ? (c.differenceNotes ?? []) : []));
  const visual = record.checks.filter((c) => c.method === 'visual');
  const departures = item?.meta.departures ?? [];
  const allowed = results.reduce((sum, r) => sum + r.allowed.length, 0);
  const plain = record.outcome === 'verified' && differenceNotes.length === 0 && departures.length === 0;
  if (!plain || visual.length > 0) body.push(`- Outcome (${outcomeLabel(record)}): ${cell(record.outcomeNote)}`);
  for (const n of differenceNotes) body.push(`- Difference: ${cell(n)}`);
  for (const v of visual) {
    body.push(`- Visual check, bars ${cell(v.bars)}, against ${cell(v.source)}: ${cell(v.result)}`);
    for (const d of v.differences) body.push(`  - ${cell(d)}`);
  }
  for (const d of departures) body.push(`- Departure: ${cell(d)}`);
  if (allowed > 0)
    body.push(
      `- ${allowed} rhythm differences are allowed by the departures (not counted; \`pnpm library:fidelity --item ${record.itemId}\` lists them).`,
    );
  if (record.outcome === 'replaced') body.push(`- ${RECENTS_NOTE}`);
  return body;
}
