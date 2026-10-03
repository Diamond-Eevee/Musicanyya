import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ClaimError } from '../../../tools/library/fidelity/exercise-claims';
import {
  type AuditRecord,
  checkRecord,
  loadRecords,
  outcomeLabel,
  type RunContext,
  runRecord,
  theoryDifferences,
  validateRecord,
} from '../../../tools/library/fidelity/records';
import { loadSources } from '../../../tools/library/fidelity/sources';
import { checkExercise, type ExerciseClaim, type KeyClaim } from '../../../tools/library/fidelity/theory';
import { q } from '../../../tools/library/fidelity/time';
import { buildMelodyFixture, type FixtureBar } from './melody-fixtures';
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

describe('melody checks in records (research R7, T054)', () => {
  const melody = (check: Record<string, unknown> = {}) => record({}, { aspects: ['melody'], ...check });

  it.each([
    [
      'a melody check that also lists note aspects',
      { aspects: ['melody', 'pitch'] },
      /melody check may add only spelling/,
    ],
    ['melodyRhythm without the melody aspect', { melodyRhythm: 'compared' }, /melodyRhythm needs the melody aspect/],
    ['an unknown melodyRhythm', { aspects: ['melody'], melodyRhythm: 'free' }, /melodyRhythm "free"/],
  ])('rejects %s', (_what, patch, pattern) => {
    expect(() => validateRecord(JSON.parse(JSON.stringify(record({}, patch))), 'x.json')).toThrow(pattern);
  });

  it('accepts a melody check with spelling and a declared rhythm allowance', () => {
    const r = melody({ aspects: ['melody', 'spelling'], melodyRhythm: 'allowedByDeparture' });
    expect(validateRecord(JSON.parse(JSON.stringify(r)), 'x.json')).toEqual(r);
  });

  it('runs compareMelody, then the sound step, and names the melody in the detail', () => {
    const [result] = runRecord(melody(), ctx);
    expect(result).toMatchObject({ differences: [], allowed: [], reproduced: true });
    expect(result?.detail).toBe('item vs notation (melody): 0 differences; notation vs sound: 0 differences');
    write('copy.musicxml', ITEM_XML.replace('<step>E</step>', '<step>F</step>'));
    const [planted] = runRecord(melody(), { ...ctx, itemFile: join(root, 'copy.musicxml') });
    expect(planted?.differences).toEqual([{ kind: 'melody', bar: '1', index: 2, item: 'F4', source: 'E4' }]);
  });

  it('counts rhythm differences, or lists them as allowed when the record says so', () => {
    // Every note an eighth instead of a quarter.
    write('copy.musicxml', ITEM_XML.replace('<divisions>1</divisions>', '<divisions>2</divisions>'));
    const copy = { ...ctx, itemFile: join(root, 'copy.musicxml') };
    const [counted] = runRecord(melody(), copy);
    expect(counted?.differences.map((d) => d.kind)).toEqual(Array(4).fill('melodyRhythm'));
    expect(counted?.allowed).toEqual([]);
    const [allowed] = runRecord(melody({ melodyRhythm: 'allowedByDeparture' }), copy);
    expect(allowed?.differences).toEqual([]);
    expect(allowed?.allowed).toEqual(counted?.differences);
    expect(allowed?.detail).toBe(
      'item vs notation (melody): 0 differences, 4 rhythm differences allowed by departures; notation vs sound: 0 differences',
    );
  });

  it('rule 2.4: rhythm allowed by departures needs an arrangement sidecar with departures', () => {
    const r = melody({ melodyRhythm: 'allowedByDeparture' });
    expect(problems(r)).toContain(
      'rhythm is allowed by departures, but the sidecar is not an arrangement with departures',
    );
    sidecar({ title: 'Scale (arrangement)', arrangement: true, departures: ['bar 1: eighths for quarters'] });
    expect(problems({ ...r, claim: 'arrangement' })).toEqual([]);
  });
});

describe('feature 011: rule sets, supersedes and the Introduction level (contract audit-record 1.2.0)', () => {
  const theoryCheck = (ruleSet: string) => ({ method: 'theory', ruleSet, expectedDifferences: 0 });
  const withChecks = (checks: unknown[]) => JSON.parse(JSON.stringify({ ...record(), claim: 'exercise', checks }));

  it.each(['exercise-theory-v1', 'exercise-theory-v2', 'exercise-theory-v3', 'song-chords-v1'])(
    'accepts the theory rule set %s',
    (ruleSet) => {
      expect(() => validateRecord(withChecks([theoryCheck(ruleSet)]), 'x.json')).not.toThrow();
    },
  );

  it('rejects an unknown theory rule set', () => {
    expect(() => validateRecord(withChecks([theoryCheck('exercise-theory-v4')]), 'x.json')).toThrow(/ruleSet/);
  });

  it('accepts a supersedes list of item ids, and rejects an empty or malformed one', () => {
    const base = JSON.parse(JSON.stringify(record()));
    expect(validateRecord({ ...base, supersedes: ['learning/chords/triads-c-major'] }, 'x.json').supersedes).toEqual([
      'learning/chords/triads-c-major',
    ]);
    expect(() => validateRecord({ ...base, supersedes: [] }, 'x.json')).toThrow(/supersedes/);
    expect(() => validateRecord({ ...base, supersedes: [3] }, 'x.json')).toThrow(/supersedes/);
    expect(() => validateRecord({ ...base, supersedes: ['Not An Id'] }, 'x.json')).toThrow(/supersedes/);
  });

  it('accepts previous.level introduction', () => {
    const base = JSON.parse(JSON.stringify(record()));
    const previous = { title: 'Old', level: 'introduction', bars: 8, notes: 20 };
    expect(() => validateRecord({ ...base, previous }, 'x.json')).not.toThrow();
  });

  it("rule 2.7: a record's supersedes equal the sidecar's supersedes ids", () => {
    const hash = 'a'.repeat(64);
    sidecar({
      supersedes: [
        { id: 'learning/chords/old-a', hash },
        { id: 'learning/chords/old-b', hash },
      ],
    });
    const base = record();
    expect(problems({ ...base, supersedes: ['learning/chords/old-a', 'learning/chords/old-b'] })).toEqual([]);
    expect(problems({ ...base, supersedes: ['learning/chords/old-b', 'learning/chords/old-a'] })).toEqual([]);
    expect(problems({ ...base, supersedes: ['learning/chords/old-a'] })).toContainEqual(
      expect.stringMatching(/supersedes/),
    );
    expect(problems(base)).toContainEqual(expect.stringMatching(/supersedes/));
  });

  it('rule 2.7: a record that supersedes something needs the sidecar to say so', () => {
    sidecar({});
    expect(problems({ ...record(), supersedes: ['learning/chords/old-a'] })).toContainEqual(
      expect.stringMatching(/supersedes/),
    );
  });
});

describe('exercise-theory-v3: the melody hand (feature 014, contract audit-record 1.3 §1)', () => {
  const C: KeyClaim = { tonicLetter: 'C', tonicAlter: 0, mode: 'major' };
  const lhChord = (notes: [string, number][]) => ({
    notes: notes.map(([step, octave]) => ({ step: step as 'C', octave })),
    value: 'whole' as const,
  });
  const I = lhChord([
    ['C', 3],
    ['E', 3],
    ['G', 3],
  ]);
  const V6 = lhChord([
    ['B', 2],
    ['D', 3],
    ['G', 3],
  ]);
  /** An introduction item in C: C D | E | D (over V) | C, or ending on `last`, with the second chord `second`. */
  const xmlOf = (last = 'C', second = I): string => {
    const bars: FixtureBar[] = [
      {
        key: { fifths: 0, mode: 'major' },
        left: [I],
        right: [
          { step: 'C', octave: 4, value: 'half', fingering: 1 },
          { step: 'D', octave: 4, value: 'half' },
        ],
      },
      { left: [second], right: [{ step: 'E', octave: 4, value: 'whole' }] },
      { left: [V6], right: [{ step: 'D', octave: 4, value: 'whole' }] },
      { left: [I], right: [{ step: last as 'C', octave: 4, value: 'whole' }], barline: 'light-heavy' },
    ];
    return buildMelodyFixture(bars);
  };
  const leftChords: ExerciseClaim['chords'] = [
    { roman: 'I', quality: 'major', inversion: 0, hands: ['left'] },
    { roman: 'I', quality: 'major', inversion: 0, hands: ['left'] },
    { roman: 'V', quality: 'major', inversion: 1, hands: ['left'] },
    { roman: 'I', quality: 'major', inversion: 0, hands: ['left'] },
  ];
  const melodyClaim: ExerciseClaim = {
    itemId: 'learning/key-changes/fixture/introduction',
    key: C,
    chords: leftChords,
    sections: [
      {
        firstBar: 1,
        lastBar: 4,
        key: C,
        right: { kind: 'melody', level: 'introduction' },
        left: {
          kind: 'chords',
          chords: [
            { roman: 'I', quality: 'major', inversion: 0, voicing: 'triad' },
            { roman: 'V', quality: 'major', inversion: 1, voicing: 'triad' },
          ],
        },
      },
    ],
  };
  const chordsOnlyClaim: ExerciseClaim = { itemId: 'fixture/chords-only', key: C, chords: leftChords };

  it('runs checkMelodyRules on the melody hand: a clean melody gives no difference', () => {
    expect(theoryDifferences(xmlOf(), melodyClaim, 'exercise-theory-v3')).toEqual([]);
  });

  it('counts the findings of the melody check as differences (a melody that ends on E)', () => {
    expect(theoryDifferences(xmlOf('E'), melodyClaim, 'exercise-theory-v3')).toEqual([
      { kind: 'melodyRule', bar: '4', beat: 1, rule: 'ending', message: expect.stringMatching(/E4/) },
    ]);
  });

  it('counts findings of both checks: a wrong left-hand chord and the melody finding', () => {
    const wrong = lhChord([
      ['C', 3],
      ['F', 3],
      ['A', 3],
    ]);
    const kinds = theoryDifferences(xmlOf('E', wrong), melodyClaim, 'exercise-theory-v3').map((d) => d.kind);
    expect(kinds).toContain('theory');
    expect(kinds).toContain('melodyRule');
  });

  it('a v1 or v2 rule set re-runs a claim without a melody unchanged', () => {
    const xml = xmlOf('E');
    for (const ruleSet of ['exercise-theory-v1', 'exercise-theory-v2'] as const)
      expect(theoryDifferences(xml, chordsOnlyClaim, ruleSet)).toEqual(checkExercise(xml, chordsOnlyClaim));
  });

  it('refuses a melody claim under a rule set before v3', () => {
    expect(() => theoryDifferences(xmlOf(), melodyClaim, 'exercise-theory-v2')).toThrow(ClaimError);
    expect(() => theoryDifferences(xmlOf(), melodyClaim, 'exercise-theory-v2')).toThrow(/exercise-theory-v3/);
  });
});

// Feature 022 (contract audit-record 1.5.0): lesson-claims-v1 carries the lesson's claims and its teaching order; it
// reads the other Basics records (those earlier in the order) from the run context.
describe('022: lesson-claims-v1 records (audit-record 1.5.0)', () => {
  const claims = { introduces: ['staff', 'treble-clef', 'middle-c', 'quarter', 'metre-4-4'], singlePitch: true };
  const lessonCheck = (extra: Record<string, unknown> = {}) => ({
    method: 'theory',
    ruleSet: 'lesson-claims-v1',
    expectedDifferences: 0,
    claims,
    teachingOrder: 10,
    ...extra,
  });
  const lessonRecord = (itemId: string, check: Record<string, unknown>) =>
    JSON.parse(JSON.stringify({ ...record(), itemId, claim: 'exercise', checks: [check] })) as AuditRecord;

  it('accepts a lesson-claims-v1 check with claims and teachingOrder', () => {
    const r = validateRecord(lessonRecord('basics/one', lessonCheck()), 'basics/one.json');
    expect(r.checks[0]).toEqual(lessonCheck());
  });

  it('rejects a lesson-claims-v1 check without claims or teachingOrder, and claims on another rule set', () => {
    const { claims: _c, ...noClaims } = lessonCheck();
    expect(() => validateRecord(lessonRecord('basics/one', noClaims), 'x.json')).toThrow(/claims/);
    const { teachingOrder: _t, ...noOrder } = lessonCheck();
    expect(() => validateRecord(lessonRecord('basics/one', noOrder), 'x.json')).toThrow(/teachingOrder/);
    expect(() =>
      validateRecord(lessonRecord('basics/one', lessonCheck({ ruleSet: 'exercise-theory-v2' })), 'x.json'),
    ).toThrow(/claims/);
    expect(() =>
      validateRecord(
        lessonRecord('basics/one', lessonCheck({ claims: { introduces: ['quarter'], extra: 1 } })),
        'x.json',
      ),
    ).toThrow(/extra/);
  });

  it('re-runs the check against the item, with the earlier lessons of the run context', () => {
    // one bar of four middle Cs with the explanation printed above it (authored for this test, CC0)
    const xml = `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes><direction placement="above"><direction-type><words font-style="italic">Four beats.</words></direction-type><staff>1</staff></direction>${'<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><type>quarter</type><staff>1</staff></note>'.repeat(4)}<backup><duration>4</duration></backup><note><rest measure="yes"/><duration>4</duration><voice>5</voice><type>whole</type><staff>2</staff></note></measure></part></score-partwise>`;
    write('library/basics/one.musicxml', xml);
    write('library/basics/one.json', JSON.stringify(SIDECAR));
    write('library/basics/two.musicxml', xml);
    write('library/basics/two.json', JSON.stringify(SIDECAR));
    const first = lessonRecord('basics/one', lessonCheck());
    const second = lessonRecord(
      'basics/two',
      lessonCheck({ claims: { introduces: [], practice: true, singlePitch: true }, teachingOrder: 20 }),
    );
    expect(runRecord(first, ctx)[0]).toMatchObject({ reproduced: true, differences: [] });
    // the practice lesson uses what the first one introduced: only the run context's records can tell
    expect(runRecord(second, { ...ctx, records: [first, second] })[0]).toMatchObject({ reproduced: true });
    const alone = runRecord(second, ctx)[0];
    expect(alone?.reproduced).toBe(false);
    expect(alone?.differences.map((d) => (d as { code?: string }).code)).toContain('not-introduced');
  });
});
