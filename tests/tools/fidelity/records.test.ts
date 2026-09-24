import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type AuditRecord,
  checkRecord,
  loadRecords,
  outcomeLabel,
  type RunContext,
  runRecord,
  validateRecord,
} from '../../../tools/library/fidelity/records';
import { loadSources } from '../../../tools/library/fidelity/sources';
import { q } from '../../../tools/library/fidelity/time';
import { ITEM_XML, LY, record, SIDECAR, SOURCE, writeFile, writeTree } from './tiny-library';

let root: string;
let ctx: RunContext;
const write = (path: string, data: string | Uint8Array) => writeFile(root, path, data);
const sidecar = (patch: Record<string, unknown>) =>
  write('library/repertoire/test/scale.json', JSON.stringify({ ...SIDECAR, ...patch }));
const problems = (r: AuditRecord) => checkRecord(r, runRecord(r, ctx), ctx);

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'records-'));
  writeTree(root, 'sources', 'library');
  ctx = {
    sources: loadSources(join(root, 'sources')),
    sourcesRoot: join(root, 'sources'),
    libraryRoot: join(root, 'library'),
  };
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('validateRecord (contract audit-record.md §1)', () => {
  it('accepts a valid record', () => {
    expect(validateRecord(JSON.parse(JSON.stringify(record())), 'x.json')).toEqual(record());
  });

  it.each([
    ['a missing field', { outcomeNote: undefined }, /outcomeNote/],
    ['an unknown field', { extra: 1 }, /unknown field "extra"/],
    ['an unknown outcome', { outcome: 'approved' }, /outcome "approved"/],
    ['an unknown claim', { claim: 'transcription' }, /claim "transcription"/],
    ['an item id with capitals', { itemId: 'Repertoire/x' }, /itemId/],
    ['no checks', { checks: [] }, /at least one check/],
    ['a bad date', { date: '24.09.2026' }, /date/],
  ])('rejects %s', (_what, patch, pattern) => {
    expect(() => validateRecord(JSON.parse(JSON.stringify({ ...record(), ...patch })), 'x.json')).toThrow(pattern);
  });

  it.each([
    ['an unknown aspect', { aspects: ['tempo'] }, /aspect "tempo"/],
    ['an alignment that is not a range', { alignment: { itemBars: '1..8', sourceBars: 'all' } }, /itemBars/],
    ['an unknown alignment field', { alignment: { itemBars: 'all', sourceBars: 'all', offset: 2 } }, /offset/],
    ['a bad transpose', { alignment: { itemBars: 'all', sourceBars: 'all', transpose: 'up a tone' } }, /transpose/],
    ['a negative count', { expectedDifferences: -1 }, /expectedDifferences/],
    ['an unknown source file role', { sourceFiles: ['scan'] }, /sourceFiles/],
  ])('rejects a mechanical check with %s', (_what, patch, pattern) => {
    expect(() => validateRecord(JSON.parse(JSON.stringify(record({}, patch))), 'x.json')).toThrow(pattern);
  });

  it('rejects a theory check that expects differences', () => {
    const r = record({
      checks: [{ method: 'theory', ruleSet: 'exercise-theory-v1', expectedDifferences: 1 }] as never,
    });
    expect(() => validateRecord(JSON.parse(JSON.stringify(r)), 'x.json')).toThrow(/theory.*expectedDifferences.*0/);
  });
});

describe('loadRecords', () => {
  it('loads records whose path is their item id, in item-id order', () => {
    write('audit/repertoire/test/scale.json', JSON.stringify(record()));
    write('audit/README.md', '# Audit\n');
    expect(loadRecords(join(root, 'audit')).map((r) => r.itemId)).toEqual(['repertoire/test/scale']);
  });

  it('rejects a record stored under another item id', () => {
    write('audit/repertoire/test/other.json', JSON.stringify(record()));
    expect(() => loadRecords(join(root, 'audit'))).toThrow(/other\.json.*repertoire\/test\/scale/);
  });
});

describe('runRecord + checkRecord (contract audit-record.md §2)', () => {
  it('re-runs the two-step chain from the committed files and reproduces 0 differences', () => {
    const results = runRecord(record(), ctx);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ differences: [], reproduced: true });
    expect(results[0]?.detail).toBe('item vs notation: 0 differences; notation vs sound: 0 differences');
    expect(checkRecord(record(), results, ctx)).toEqual([]);
  });

  it('rule 2.2: the re-run count must equal expectedDifferences', () => {
    expect(problems(record({}, { expectedDifferences: 1, differenceNotes: ['x'] }))).toEqual([
      'check 1 (mechanical, test-1): re-run gives 0 differences, the record expects 1',
      // ... and a verified item must rest on a check that expects 0 (rule 2.3)
      'outcome verified needs a mechanical or theory check with 0 expected differences',
    ]);
    // A planted wrong note in a copy of the item is found and named.
    write('copy.musicxml', ITEM_XML.replace('<step>E</step>', '<step>F</step>'));
    const results = runRecord(record(), { ...ctx, itemFile: join(root, 'copy.musicxml') });
    expect(results[0]?.differences).toEqual([{ kind: 'pitch', bar: '1', at: q(2), item: 65, source: 64 }]);
    expect(results[0]?.reproduced).toBe(false);
  });

  it('rule 2.2: a non-zero count needs exactly one differenceNotes entry per difference', () => {
    write('library/repertoire/test/scale.musicxml', ITEM_XML.replace('<step>E</step>', '<step>F</step>'));
    const r = (notes: string[]) =>
      record(
        { outcome: 'relabelled', previous: { title: 'Old', level: 'beginner', bars: 1, notes: 4 } },
        { expectedDifferences: 1, differenceNotes: notes },
      );
    expect(problems(r(['bar 1: F4 for E4, a declared departure']))).toEqual([]);
    expect(problems(r([]))).toEqual(['check 1 (mechanical, test-1): 1 differences but 0 differenceNotes']);
    expect(problems(r(['a', 'b']))).toEqual(['check 1 (mechanical, test-1): 1 differences but 2 differenceNotes']);
  });

  it('rule 2.3: a visual-only record is reported as visual, never as mechanical', () => {
    const visual = record({
      checks: [
        { method: 'visual', source: 'https://example.org/scan.pdf', bars: '1', result: 'matches', differences: [] },
      ],
    });
    expect(outcomeLabel(visual)).toBe('verified (visual)');
    expect(outcomeLabel(record())).toBe('verified');
    expect(problems(visual)).toEqual([]);
    expect(problems({ ...visual, outcome: 'replaced' })).toEqual([
      'outcome replaced needs a mechanical or theory check with 0 expected differences',
    ]);
  });

  it('rule 2.3: relabelled requires the sidecar to differ from previous in title, subtitle or departures', () => {
    const r = record({ outcome: 'relabelled', previous: { title: 'Scale', level: 'beginner', bars: 1, notes: 4 } });
    expect(problems(r)).toEqual(['outcome relabelled, but the title, subtitle and departures are unchanged']);
    expect(problems({ ...r, previous: { title: 'C major scale', level: 'beginner', bars: 1, notes: 4 } })).toEqual([]);
    sidecar({ departures: ['Bar 1 is our own.'] });
    expect(problems(r)).toEqual([]);
  });

  it('rule 2.3: removed requires a Rejected items row naming the item', () => {
    rmSync(join(root, 'library/repertoire/test/scale.musicxml'));
    rmSync(join(root, 'library/repertoire/test/scale.json'));
    const r = record({
      outcome: 'removed',
      checks: [
        {
          method: 'visual',
          source: 'https://example.org/licence',
          bars: 'all',
          result: 'CC BY-SA only',
          differences: [],
        },
      ],
    });
    expect(problems(r)).toEqual([
      'outcome removed, but public/library/README.md has no Rejected items row for repertoire/test/scale',
    ]);
    write(
      'library/README.md',
      '## Rejected items\n\n| Item | Reason |\n|---|---|\n| repertoire/test/scale | CC BY-SA only |\n',
    );
    expect(problems(r)).toEqual([]);
  });

  it('rule 2.4: an original needs arrangement false and barCount, repeats, pitch, onset and duration', () => {
    sidecar({ arrangement: true, departures: ['x'] });
    expect(problems(record())).toEqual(['claim original, but the sidecar says arrangement: true']);
    sidecar({});
    expect(problems(record({}, { aspects: ['pitch', 'onset', 'duration'] }))).toEqual([
      'claim original needs a mechanical check with barCount, repeats, pitch, onset and duration (missing: barCount, repeats)',
    ]);
  });

  it('rule 2.4: an arrangement needs arrangement true and departures', () => {
    expect(problems(record({ claim: 'arrangement' }))).toEqual([
      'claim arrangement, but the sidecar says arrangement: false',
      'claim arrangement, but the sidecar has no departures',
    ]);
  });

  it("rule 2.5: the sidecar's reviewedBy and reviewedOn equal the record", () => {
    sidecar({ reviewedBy: 'gemini-3.1-pro', reviewedOn: '2026-09-23' });
    expect(problems(record())).toEqual([
      'sidecar reviewedBy "gemini-3.1-pro" differs from the record\'s checkedBy "claude-opus-5.5"',
      'sidecar reviewedOn "2026-09-23" differs from the record\'s date "2026-09-24"',
    ]);
  });

  it('rule 2.6: an unknown source fails', () => {
    expect(() => runRecord(record({}, { source: 'nope' }), ctx)).toThrow(/source "nope"/);
  });

  it('reads the \\score the manifest names in a file with one \\score per movement (source-manifest 1.1.0)', () => {
    const book = `\\book {\n  \\score { { g'1 | } \\layout { } }\n  \\score { ${LY} \\layout { } }\n}\n`;
    const withScore = (score: number) => {
      const files = SOURCE.files.map((f) =>
        f.role === 'notation' ? { ...f, sha256: createHash('sha256').update(book).digest('hex'), score } : f,
      );
      write('sources/test-1/scale.ly', book);
      write('sources/test-1/source.json', JSON.stringify({ ...SOURCE, files }));
      return { ...ctx, sources: loadSources(join(root, 'sources')) };
    };
    expect(runRecord(record(), withScore(2))[0]?.differences).toEqual([]);
    expect(runRecord(record(), withScore(1))[0]?.differences.length).toBeGreaterThan(0);
  });
});
