// Planted errors (contract fidelity-tools.md §5, FR-017, SC-004): a comparison method may give a "0 differences"
// result only if it catches each of these mutations, exactly once and in the right bar. Repertoire part: the
// verified Für Elise item against its source, Mutopia 931, and the melody quote of the beginner Für Elise (US2, T053).
// The theory mutations (US3) are added by task T072.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { compare, compareSound, type Difference } from '../../../tools/library/fidelity/compare';
import { fromMusicXml } from '../../../tools/library/fidelity/from-musicxml';
import { fromMidi, readMidi } from '../../../tools/library/fidelity/midi';
import { type AuditRecord, runRecord } from '../../../tools/library/fidelity/records';
import { loadSources } from '../../../tools/library/fidelity/sources';
import { q, show, sub } from '../../../tools/library/fidelity/time';
import { fromLilyPond, readLilyPond } from '../../../tools/library/lilypond/read';

const ITEM_ID = 'repertoire/advanced/fur-elise-complete';
const ITEM = readFileSync(`public/library/${ITEM_ID}.musicxml`, 'utf8');
const SOURCE = 'content/library/sources/mutopia-931-beethoven-woo59/fur_Elise_WoO59';
const ALL = { itemBars: 'all', sourceBars: 'all' };
const RECORD: AuditRecord = {
  version: 1,
  itemId: ITEM_ID,
  claim: 'original',
  claimText: 'Für Elise, WoO 59 - complete piece',
  checks: [
    {
      method: 'mechanical',
      source: 'mutopia-931-beethoven-woo59',
      sourceFiles: ['notation', 'sound'],
      aspects: [
        'barCount',
        'barLengths',
        'repeats',
        'playedOrder',
        'pitch',
        'onset',
        'duration',
        'spelling',
        'graceNotes',
      ],
      alignment: ALL,
      expectedDifferences: 0,
    },
  ],
  outcome: 'verified',
  outcomeNote: 'planted-error test record',
  checkedBy: 'test',
  date: '2026-09-24',
};

const scratch = mkdtempSync(join(tmpdir(), 'planted-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
const sources = loadSources('content/library/sources');
let copies = 0;

/** Both steps of the chain (data-model.md §4.1a) for a mutated copy of the item. */
function differences(xml: string): Difference[] {
  const file = join(scratch, `copy-${++copies}.musicxml`);
  writeFileSync(file, xml);
  const [result] = runRecord(RECORD, {
    sources,
    sourcesRoot: 'content/library/sources',
    libraryRoot: 'public/library',
    itemFile: file,
  });
  if (!result) throw new Error('no result');
  return result.differences;
}

/** Applies `change` to the body of the measure numbered `n`. */
function inMeasure(xml: string, n: string, change: (body: string) => string): string {
  const re = new RegExp(`(<measure number="${n}"[^>]*>)([\\s\\S]*?)(</measure>)`);
  const m = re.exec(xml);
  if (!m) throw new Error(`no measure ${n}`);
  const changed = change(m[2] as string);
  if (changed === m[2]) throw new Error(`the mutation did not change measure ${n}`);
  return xml.replace(re, `$1${changed}$3`);
}

/** Applies `change` to the i-th <note> of a measure body. */
function note(body: string, i: number, change: (note: string) => string): string {
  let k = -1;
  return body.replace(/<note\b[\s\S]*?<\/note>/g, (n) => (++k === i ? change(n) : n));
}

const original = fromMusicXml(ITEM);
const barIndex = (number: string) => original.bars.findIndex((b) => b.number === number);

describe('planted errors: the Für Elise item against Mutopia 931 (both steps)', () => {
  it('the unchanged item gives no differences, so each result below comes from its one mutation', () => {
    expect(differences(ITEM)).toEqual([]);
  });

  it('one pitch raised a semitone (bar 12, E4 -> F4): one pitch difference', () => {
    const xml = inMeasure(ITEM, '12', (b) =>
      note(b, 1, (n) => n.replace('<step>E</step>', '<step>E</step><alter>1</alter>')),
    );
    expect(differences(xml)).toEqual([{ kind: 'pitch', bar: '12', at: q(3, 4), item: 65, source: 64 }]);
  });

  it('one duration halved, a rest filling the gap (bar 12, the dotted eighth C5): one duration difference', () => {
    const xml = inMeasure(ITEM, '12', (b) =>
      note(b, 0, (n) =>
        n
          .replace('<duration>18</duration>', '<duration>9</duration>')
          .concat('<note><rest/><duration>9</duration><voice>1</voice><staff>1</staff></note>'),
      ),
    );
    expect(differences(xml)).toEqual([
      { kind: 'duration', bar: '12', at: q(0), midi: 72, item: q(3, 8), source: q(3, 4) },
    ]);
  });

  it('one bar deleted (bar 30): the bar count, the played order, and the notes of that bar only', () => {
    const xml = ITEM.replace(/<measure number="30"[^>]*>[\s\S]*?<\/measure>/, '');
    const found = differences(xml);
    const position = (original.playedOrder ?? []).indexOf(barIndex('30'));
    expect(found.slice(0, 2)).toEqual([
      { kind: 'barCount', item: 105, source: 106 },
      { kind: 'playedOrder', position, item: '31', source: '30' },
    ]);
    const rest = found.slice(2);
    expect(rest).toHaveLength(original.notes.filter((n) => n.bar === barIndex('30')).length);
    expect(rest.every((d) => d.kind === 'missing' && d.bar === '30')).toBe(true);
  });

  it('one repeat barline removed (the end repeat of the first ending, bar 8): a repeat and a played-order difference', () => {
    const xml = inMeasure(ITEM, '8', (b) => b.replace('<repeat direction="backward"/>', ''));
    const played = original.playedOrder ?? [];
    // The source goes back to the pickup after bar 8; the item without the end repeat goes straight on.
    const position = played.indexOf(barIndex('8')) + 1;
    const found = differences(xml);
    expect(found).toHaveLength(2);
    expect(found[0]).toMatchObject({ kind: 'playedOrder', position, source: '0' });
    expect(found[0]).not.toMatchObject({ item: '0' });
    expect(found[1]).toEqual({ kind: 'repeat', bar: '8', item: 'no repeat end', source: 'repeat end' });
  });

  it('a forward repeat that the convention already implies (bar 10, after the first section ends): only the repeat difference', () => {
    // A backward repeat without a forward repeat returns to the bar after the previous section's end, which is bar
    // 10 here, so the piece plays the same; the written score still differs, and that is reported.
    const xml = inMeasure(ITEM, '10', (b) => b.replace('<repeat direction="forward"/>', ''));
    expect(differences(xml)).toEqual([{ kind: 'repeat', bar: '10', item: 'no repeat start', source: 'repeat start' }]);
  });

  it('one note respelled enharmonically (bar 1, D#5 -> Eb5): one spelling difference', () => {
    const xml = inMeasure(ITEM, '1', (b) =>
      note(b, 1, (n) => n.replace('<step>D</step><alter>1</alter>', '<step>E</step><alter>-1</alter>')),
    );
    expect(differences(xml)).toEqual([{ kind: 'spelling', bar: '1', at: q(1, 4), item: 'Eb5', source: 'D#5' }]);
  });

  it('one grace note removed (the appoggiatura B-flat of bar 28): one grace difference', () => {
    const grace = original.graceNotes.find((g) => g.bar === barIndex('28'));
    if (!grace) throw new Error('bar 28 has a grace note');
    const beat = show(sub(grace.before, (original.bars[barIndex('28')] as { start: ReturnType<typeof q> }).start));
    const xml = inMeasure(ITEM, '28', (b) => b.replace(/<note><grace\/>[\s\S]*?<\/note>/, ''));
    expect(differences(xml)).toEqual([
      { kind: 'grace', bar: '28', detail: `missing grace note Bb4 before beat ${beat}` },
    ]);
  });

  it('one pitch changed in the .ly copy (bar 2, a4 -> b4): the MIDI step reports it, and so does the item step', () => {
    const text = readFileSync(`${SOURCE}.ly`, 'utf8');
    const mutated = text.replace("a'8 r16 c' e' a' b'8", "b'8 r16 c' e' a' b'8");
    expect(mutated).not.toBe(text);
    const notation = fromLilyPond(readLilyPond(mutated));
    const sound = fromMidi(readMidi(new Uint8Array(readFileSync(`${SOURCE}.mid`))), [1, 2]);
    expect(compareSound(notation, sound, { order: 'written', articulate: false }).differences).toEqual([
      { kind: 'pitch', bar: '2', at: q(0), item: 71, source: 69 },
    ]);
    expect(compare(original, notation, ['pitch', 'onset', 'duration'], ALL)).toEqual([
      { kind: 'pitch', bar: '2', at: q(0), item: 69, source: 71 },
    ]);
  });
});

// The melody mutation (US2, T053): the beginner Für Elise quotes the pickup and bar 1 of Mutopia 931 (research R7).
// Its 3/4 renotation doubles every value, so rhythm is allowed; pitch and order are counted.
const MELODY_ID = 'repertoire/beginner/fur-elise-theme-16-bar';
const MELODY_ITEM = readFileSync(`public/library/${MELODY_ID}.musicxml`, 'utf8');
const MELODY_RECORD: AuditRecord = {
  ...RECORD,
  itemId: MELODY_ID,
  claim: 'arrangement',
  claimText: 'Für Elise, beginner arrangement - quotes the opening',
  checks: [
    {
      method: 'mechanical',
      source: 'mutopia-931-beethoven-woo59',
      sourceFiles: ['notation'],
      aspects: ['melody', 'spelling'],
      alignment: { itemBars: '0-1', sourceBars: '0-1' },
      melodyRhythm: 'allowedByDeparture',
      expectedDifferences: 0,
    },
  ],
};

function melodyDifferences(xml: string): Difference[] {
  const file = join(scratch, `melody-${++copies}.musicxml`);
  writeFileSync(file, xml);
  const [result] = runRecord(MELODY_RECORD, {
    sources,
    sourcesRoot: 'content/library/sources',
    libraryRoot: 'public/library',
    itemFile: file,
  });
  if (!result) throw new Error('no result');
  return result.differences;
}

describe('planted errors: the melody quote of the beginner Für Elise against Mutopia 931', () => {
  // Found by this check, not planted: the item's bar 1 leaves out the source's last note, C5 (T061 settles it).
  const unchanged = [{ kind: 'melody', bar: '1', index: 7, item: 'missing', source: 'C5' }];

  it('the unchanged item gives only the difference T061 settles', () => {
    expect(melodyDifferences(MELODY_ITEM)).toEqual(unchanged);
  });

  it('one melody note changed (bar 1, B4 -> C5): exactly one more melody difference, naming the bar', () => {
    const xml = inMeasure(MELODY_ITEM, '1', (b) =>
      note(b, 3, (n) => n.replace('<step>B</step><octave>4</octave>', '<step>C</step><octave>5</octave>')),
    );
    expect(melodyDifferences(xml)).toEqual([
      { kind: 'melody', bar: '1', index: 5, item: 'C5', source: 'B4' },
      ...unchanged,
    ]);
  });
});
