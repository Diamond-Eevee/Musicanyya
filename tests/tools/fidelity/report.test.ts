// renderReport (contract audit-record.md §3, fidelity-tools.md §2): the layout of docs/library-audit.md, on synthetic
// records - rows in shelf order, visual-only rows marked, the Removed section, level counts with the FR-022 gap, the
// Notes (difference notes, departures, the Recents note for a replaced item) and byte-identical output.
import { describe, expect, it } from 'vitest';
import type { LibraryIndex, LibraryItem } from '../../../src/core/library/types';
import type { Difference } from '../../../tools/library/fidelity/compare';
import type { AuditRecord, CheckResult } from '../../../tools/library/fidelity/records';
import { LEVEL_MINIMUMS, renderReport } from '../../../tools/library/fidelity/report';
import type { SourceManifest } from '../../../tools/library/fidelity/sources';

const shelfItem = (
  id: string,
  title: string,
  level: 'beginner' | 'intermediate' | 'advanced',
  extra: Record<string, unknown> = {},
): LibraryItem =>
  ({
    id,
    section: id.slice(0, id.lastIndexOf('/')),
    meta: { title, kind: id.startsWith('learning/') ? 'exercise' : 'piece', level, ...extra },
  }) as unknown as LibraryItem;

// Shelf order is the index order - deliberately not alphabetical.
const index = {
  version: 1,
  generated: '2026-09-24T00:00:00.000Z',
  sections: [],
  items: [
    shelfItem('repertoire/beginner/zeta-song', 'Zeta Song', 'beginner', {
      arrangement: true,
      departures: ['Melody only in bars 1-4; the left hand is our own.'],
    }),
    shelfItem('repertoire/beginner/alpha-hymn', 'Alpha Hymn', 'beginner'),
    shelfItem('repertoire/advanced/big-sonata', 'Big Sonata, first movement', 'advanced'),
    shelfItem('learning/chords/c-major-triads', 'C major - triads', 'beginner'),
  ],
} as unknown as LibraryIndex;

const sources = new Map<string, SourceManifest>([
  [
    'src-1',
    {
      version: 1,
      id: 'src-1',
      work: 'Big Sonata',
      edition: 'Breitkopf 1880',
      publisher: 'Mutopia',
      url: 'https://example.org/piece/1',
      licence: 'public-domain',
      obtained: '2026-09-24',
      approvedByOwner: '2026-09-24',
      files: [],
    },
  ],
]);

const base = { version: 1 as const, checkedBy: 'claude-opus-5-5', date: '2026-09-24' };
const records: AuditRecord[] = [
  // Record order is deliberately not shelf order.
  {
    ...base,
    itemId: 'learning/chords/c-major-triads',
    claim: 'exercise',
    claimText: 'Triads in C major',
    checks: [{ method: 'theory', ruleSet: 'exercise-theory-v1', expectedDifferences: 0 }],
    outcome: 'fixed',
    outcomeNote: 'Roman numeral case corrected.',
  },
  {
    ...base,
    itemId: 'repertoire/advanced/big-sonata',
    claim: 'original',
    claimText: 'Big Sonata, complete first movement',
    checks: [
      {
        method: 'mechanical',
        source: 'src-1',
        sourceFiles: ['notation', 'sound'],
        aspects: ['barCount', 'repeats', 'pitch', 'onset', 'duration'],
        alignment: { itemBars: 'all', sourceBars: 'all' },
        expectedDifferences: 1,
        differenceNotes: ['Bar 12: the source has an editorial natural; the first edition has none.'],
      },
    ],
    outcome: 'replaced',
    outcomeNote: 'Converted from the source; the hand-written copy had 40 wrong notes.',
    previous: { title: 'Big Sonata', level: 'advanced', bars: 60, notes: 900 },
  },
  {
    ...base,
    itemId: 'repertoire/beginner/alpha-hymn',
    claim: 'original',
    claimText: 'Alpha Hymn, as printed',
    checks: [
      {
        method: 'visual',
        source: 'https://example.org/scan (1913, p. 4)',
        bars: '1-8',
        result: 'Match.',
        differences: [],
      },
    ],
    outcome: 'verified',
    outcomeNote: 'Compared with the scan.',
  },
  {
    ...base,
    itemId: 'repertoire/beginner/zeta-song',
    claim: 'arrangement',
    claimText: 'Zeta Song, easy arrangement',
    checks: [
      {
        method: 'mechanical',
        source: 'src-1',
        sourceFiles: ['notation'],
        aspects: ['melody'],
        alignment: { itemBars: '1-4', sourceBars: '1-4' },
        expectedDifferences: 0,
        melodyRhythm: 'allowedByDeparture',
      },
    ],
    outcome: 'verified',
    outcomeNote: 'Melody matches.',
  },
  {
    ...base,
    itemId: 'repertoire/intermediate/gone-piece',
    claim: 'original',
    claimText: 'Gone Piece',
    checks: [
      { method: 'visual', source: 'https://example.org/licence', bars: 'all', result: 'CC BY-SA.', differences: [] },
    ],
    outcome: 'removed',
    outcomeNote: 'Only source is CC BY-SA 2.5.',
    previous: { title: 'Gone Piece', level: 'intermediate', bars: 20, notes: 300 },
  },
];

const allowed = [{ kind: 'melody' }, { kind: 'melody' }] as unknown as Difference[];
const results = new Map<string, CheckResult[]>(
  records.map((r) => [
    r.itemId,
    r.checks.map((check) => ({
      check,
      differences: [],
      allowed: r.itemId === 'repertoire/beginner/zeta-song' ? allowed : [],
      reproduced: true,
      detail: '',
    })),
  ]),
);

const report = renderReport(records, results, index, sources);
const lines = report.split('\n');
/** The lines of one `## heading` section, without the heading. */
const section = (heading: string): string[] => {
  const start = lines.indexOf(`## ${heading}`);
  expect(start, `section ${heading}`).toBeGreaterThanOrEqual(0);
  const end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  return lines.slice(start + 1, end === -1 ? undefined : end);
};
const rows = (heading: string) =>
  section(heading)
    .filter((l) => l.startsWith('|') && !/^\|\s*-/.test(l))
    .slice(1);
const rowOf = (heading: string, id: string) => rows(heading).find((r) => r.includes(`\`${id}\``)) ?? '';

describe('renderReport (contract audit-record.md §3)', () => {
  it('starts with the title and the do-not-edit line', () => {
    expect(lines[0]).toBe('# Library fidelity audit');
    expect(report).toContain('Generated from `content/library/audit/`. Do not edit; run `pnpm library:fidelity`.');
  });

  it('lists repertoire rows in shelf order, one per item, with title and id', () => {
    const rep = rows('Repertoire');
    expect(rep).toHaveLength(3);
    expect(rep[0]).toContain('Zeta Song');
    expect(rep[0]).toContain('`repertoire/beginner/zeta-song`');
    expect(rep[1]).toContain('`repertoire/beginner/alpha-hymn`');
    expect(rep[2]).toContain('`repertoire/advanced/big-sonata`');
    expect(section('Repertoire').find((l) => l.startsWith('| Item'))).toBe(
      '| Item | Claim | Source | Method | Checked | Differences | Outcome | Date |',
    );
  });

  it('prints the source edition with its link, the method with its bars, the aspects and the differences', () => {
    const row = rowOf('Repertoire', 'repertoire/advanced/big-sonata');
    expect(row).toContain('[Breitkopf 1880](https://example.org/piece/1)');
    expect(row).toContain('mechanical (bars all)');
    expect(row).toContain('barCount, repeats, pitch, onset, duration');
    expect(row).toContain('| 1 |');
    expect(row).toContain('| replaced |');
    expect(row).toContain('| 2026-09-24 |');
  });

  it('prints "verified (visual)" and the visual method with its bars for a visual-only record', () => {
    const row = rowOf('Repertoire', 'repertoire/beginner/alpha-hymn');
    expect(row).toContain('| verified (visual) |');
    expect(row).toContain('visual (bars 1-8)');
    expect(row).toContain('https://example.org/scan (1913, p. 4)');
    // A mechanically verified record keeps the plain outcome.
    expect(rowOf('Repertoire', 'repertoire/beginner/zeta-song')).toContain('| verified |');
  });

  it('counts rhythm differences allowed by departures apart from the differences', () => {
    expect(rowOf('Repertoire', 'repertoire/beginner/zeta-song')).toContain('| 0 (2 allowed by departures) |');
  });

  it('lists exercises under Learning with their rule set', () => {
    expect(section('Learning').find((l) => l.startsWith('| Item'))).toBe(
      '| Item | Claim | Rule set | Method | Differences | Outcome | Date |',
    );
    const learn = rows('Learning');
    expect(learn).toHaveLength(1);
    expect(learn[0]).toContain('`learning/chords/c-major-triads`');
    expect(learn[0]).toContain('exercise-theory-v1');
    expect(learn[0]).toContain('| fixed |');
  });

  it('has a Removed section with the reason and date, and no shelf row for a removed item', () => {
    const removed = rows('Removed');
    expect(removed).toEqual([
      '| Gone Piece<br>`repertoire/intermediate/gone-piece` | Only source is CC BY-SA 2.5. | 2026-09-24 |',
    ]);
    expect(rowOf('Repertoire', 'repertoire/intermediate/gone-piece')).toBe('');
  });

  it('counts outcomes in the Summary, totalling shelf + removed', () => {
    const summary = rows('Summary');
    expect(summary).toContain('| verified | 1 |');
    expect(summary).toContain('| verified (visual) | 1 |');
    expect(summary).toContain('| fixed | 1 |');
    expect(summary).toContain('| replaced | 1 |');
    expect(summary).toContain('| relabelled | 0 |');
    expect(summary).toContain('| removed | 1 |');
    expect(summary).toContain('| Total | 5 |');
  });

  it('counts pieces per level against the minimums and reports a shortfall', () => {
    expect(LEVEL_MINIMUMS).toEqual({ beginner: 7, intermediate: 5, advanced: 5 });
    const levels = rows('Level counts after the audit');
    // Exercises are not pieces: only the three repertoire items count.
    expect(levels).toEqual([
      '| Beginner | 2 | 7 | short by 5 - reported to the owner |',
      '| Intermediate | 0 | 5 | short by 5 - reported to the owner |',
      '| Advanced | 1 | 5 | short by 4 - reported to the owner |',
    ]);
  });

  it('prints "meets the minimum" for a level at or above its minimum', () => {
    const many = {
      ...index,
      items: Array.from({ length: 7 }, (_, i) => shelfItem(`repertoire/beginner/p${i}`, `P${i}`, 'beginner')),
    } as unknown as LibraryIndex;
    const recs = many.items.map((item): AuditRecord => ({ ...(records[2] as AuditRecord), itemId: item.id }));
    const res = new Map(recs.map((r) => [r.itemId, [] as CheckResult[]]));
    const text = renderReport(recs, res, many, sources);
    expect(text).toContain('| Beginner | 7 | 7 | meets the minimum |');
  });

  it('writes Notes: difference notes, departures, outcome notes and the Recents note for a replaced item', () => {
    const notes = section('Notes').join('\n');
    expect(notes).toContain('### Big Sonata, first movement (`repertoire/advanced/big-sonata`)');
    expect(notes).toContain('Bar 12: the source has an editorial natural; the first edition has none.');
    expect(notes).toContain('Converted from the source; the hand-written copy had 40 wrong notes.');
    expect(notes).toContain(
      'Recent scores that opened the old version keep that copy; progress saved against it does not carry over.',
    );
    expect(notes).toContain('### Zeta Song (`repertoire/beginner/zeta-song`)');
    expect(notes).toContain('Melody only in bars 1-4; the left hand is our own.');
    expect(notes).toContain('Roman numeral case corrected.');
    // The Recents note belongs to replaced items only.
    expect(notes.match(/Recent scores that opened/g)).toHaveLength(1);
  });

  it('escapes table pipes in free text', () => {
    const piped = records.map((r) =>
      r.itemId === 'repertoire/intermediate/gone-piece' ? { ...r, outcomeNote: 'a | b' } : r,
    );
    expect(renderReport(piped, results, index, sources)).toContain('| a \\| b |');
  });

  it('throws when a shelf item has no record or a record is neither on the shelf nor removed', () => {
    expect(() => renderReport(records.slice(1), results, index, sources)).toThrow(/learning\/chords\/c-major-triads/);
    const stray = [...records, { ...(records[2] as AuditRecord), itemId: 'repertoire/beginner/stray' }];
    expect(() => renderReport(stray, results, index, sources)).toThrow(/repertoire\/beginner\/stray/);
  });

  it('gives byte-identical output on two runs, with no timestamp of its own', () => {
    expect(renderReport(records, results, index, sources)).toBe(report);
    expect(report).not.toContain(index.generated);
    expect(report.endsWith('\n')).toBe(true);
  });
});
