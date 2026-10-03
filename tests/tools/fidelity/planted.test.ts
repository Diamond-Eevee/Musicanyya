// Planted errors (contract fidelity-tools.md §5, FR-017, SC-004): a comparison method may give a "0 differences"
// result only if it catches each of these mutations, exactly once and in the right bar. Repertoire part: the
// verified Für Elise item against its source, Mutopia 931, and the melody quote of the beginner Für Elise (US2, T053).
// The theory mutations (US3) are added by task T072.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { compare, compareSound, type Difference } from '../../../tools/library/fidelity/compare';
import { claimForItem } from '../../../tools/library/fidelity/exercise-claims';
import { fromMusicXml } from '../../../tools/library/fidelity/from-musicxml';
import { fromMidi, readMidi } from '../../../tools/library/fidelity/midi';
import { type AuditRecord, runRecord } from '../../../tools/library/fidelity/records';
import { loadSources } from '../../../tools/library/fidelity/sources';
import { checkExercise } from '../../../tools/library/fidelity/theory';
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
  // Found by this check, not planted: the item's bar 1 leaves out the source's C5, now a declared departure (T061).
  const unchanged = [{ kind: 'melody', bar: '1', index: 7, item: 'missing', source: 'C5' }];

  it('the unchanged item gives only its declared departure', () => {
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

// The theory mutations (US3, T072): for every exercise on the shelf (the 41 items cover each family: triads major and
// minor, each chord-change drill shape, and the scale-and-chords item), one change at a time to a copy of the item's
// MusicXML gives exactly one TheoryDifference, naming the chord, the bar and the hand (FR-014, SC-005). A theory check
// that misses one of these may not be used for any "0 differences" result.
interface Tone {
  step: string;
  alter: number;
  octave: number;
}
interface ChordNote extends Tone {
  start: number;
  end: number;
}
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURAL = [0, 2, 4, 5, 7, 9, 11];
const midiOf = (t: Tone) => (t.octave + 1) * 12 + (NATURAL[LETTERS.indexOf(t.step)] as number) + t.alter;
const name = (t: Tone, octave: boolean) =>
  `${t.step}${{ '-3': 'bbb', '-2': 'bb', '-1': 'b', '0': '', '1': '#', '2': '##', '3': '###' }[String(t.alter)]}${octave ? t.octave : ''}`;

/** The chords of one staff in file order: runs of pitched <note> elements that begin at a note without <chord/>.
 *  Runs of one note (the scale of the hand-written item) are not chords. */
function chordsOf(xml: string, staff: 1 | 2): ChordNote[][] {
  const groups: ChordNote[][] = [];
  for (const m of xml.matchAll(/<note>([\s\S]*?)<\/note>/g)) {
    const body = m[1] as string;
    const pitch = /<pitch><step>(\w)<\/step>(?:<alter>(-?\d)<\/alter>)?<octave>(\d)<\/octave><\/pitch>/.exec(body);
    if (!pitch || !new RegExp(`<staff>${staff}</staff>`).test(body)) continue;
    const start = m.index as number;
    const note = {
      step: pitch[1] as string,
      alter: Number(pitch[2] ?? 0),
      octave: Number(pitch[3]),
      start,
      end: start + m[0].length,
    };
    if (/^<chord\/>/.test(body)) groups[groups.length - 1]?.push(note);
    else groups.push([note]);
  }
  return groups.filter((g) => g.length >= 2);
}
const barAt = (xml: string, offset: number): string => {
  let bar = '';
  for (const m of xml.matchAll(/<measure number="([^"]+)"/g)) if ((m.index as number) < offset) bar = m[1] as string;
  return bar;
};
/** Where each note element starts in time: its offset in the file mapped to the absolute divisions since the first bar,
 *  following `<backup>` and `<forward>`. Feature 011 needs it because a step item plays chords in either hand, so the index
 *  of a chord among the claim's chords is its place in time, not in the file. */
function onsetsOf(xml: string): Map<number, number> {
  const onsets = new Map<number, number>();
  let barStart = 0;
  let position = 0;
  let longest = 0;
  const pattern =
    /<measure |<note>([\s\S]*?)<\/note>|<backup><duration>(\d+)<\/duration><\/backup>|<forward><duration>(\d+)<\/duration><\/forward>/g;
  for (const m of xml.matchAll(pattern)) {
    if (m[0] === '<measure ') {
      barStart += longest;
      position = 0;
      longest = 0;
    } else if (m[1] !== undefined) {
      const body = m[1];
      const isChord = /^<chord\/>/.test(body);
      const duration = Number(/<duration>(\d+)<\/duration>/.exec(body)?.[1] ?? 0);
      if (!isChord) {
        onsets.set(m.index as number, barStart + position);
        position += duration;
        longest = Math.max(longest, position);
      } else {
        // a chord member sounds with the note before it: same onset
        const previous = [...onsets.entries()].pop();
        if (previous) onsets.set(m.index as number, previous[1]);
      }
    } else if (m[2] !== undefined) {
      position -= Number(m[2]);
    } else if (m[3] !== undefined) {
      position += Number(m[3]);
      longest = Math.max(longest, position);
    }
  }
  return onsets;
}
/** The index of the chord that starts with `group` among all the chords of both hands, in time order. */
function chordEventIndex(xml: string, group: ChordNote[]): number {
  const onsets = onsetsOf(xml);
  const events = new Set<number>();
  for (const staff of [1, 2] as const)
    for (const g of chordsOf(xml, staff)) events.add(onsets.get((g[0] as ChordNote).start) as number);
  const target = onsets.get((group[0] as ChordNote).start) as number;
  return [...events].sort((a, b) => a - b).indexOf(target);
}
/** Rewrites the pitch of one note element. */
function withPitch(xml: string, note: ChordNote, to: Tone): string {
  const text = xml.slice(note.start, note.end);
  const rewritten = text.replace(
    /<pitch>[\s\S]*?<\/pitch>/,
    `<pitch><step>${to.step}</step>${to.alter !== 0 ? `<alter>${to.alter}</alter>` : ''}<octave>${to.octave}</octave></pitch>`,
  );
  return xml.slice(0, note.start) + rewritten + xml.slice(note.end);
}
/** The same sounding pitch under the next letter up (F## -> G, B -> C-flat, E -> F-flat). */
function respelled(t: Tone): Tone {
  const next = (LETTERS.indexOf(t.step) + 1) % 7;
  const octave = t.octave + (next === 0 ? 1 : 0);
  const step = LETTERS[next] as string;
  return { step, alter: midiOf(t) - midiOf({ step, alter: 0, octave }), octave };
}

const exercises = (
  JSON.parse(readFileSync('public/library/index.json', 'utf8')) as {
    items: { id: string; file: string; meta: { kind: string; title: string; trains?: string } }[];
  }
)// Feature 022: the Basics and chord lessons are exercises too, but are checked by their own rule sets (lesson-claims-v1,
// chord-lessons-v1, with planted fixtures in tests/tools/fidelity/lesson-claims.test.ts and chord-lessons.test.ts):
// this sweep covers the generated exercises the theory check reads from their titles.
.items
  .filter((i) => i.meta.kind === 'exercise' && /^learning\/(keys|key-changes)\//.test(i.id));

describe('planted errors: the theory check on every exercise of the shelf', () => {
  for (const item of exercises) {
    const xml = readFileSync(`public/library/${item.file}`, 'utf8');
    const claim = claimForItem({ itemId: item.id, title: item.meta.title, trains: item.meta.trains ?? '' });
    // Feature 014 (T064): a key-change item's right hand plays a melody, no chords - its mutations go into the left hand's
    // chords instead.
    const right = chordsOf(xml, 1);
    const hand = right.length > 0 ? 'right' : 'left';
    const chords = hand === 'right' ? right : chordsOf(xml, 2);
    // A chord's index in the claim is its place in time among the chords of both hands: a step plays its first chords in
    // one hand and its later ones in the other, the drills play both hands at every chord.
    const at = Math.min(2, chords.length - 1);
    const chord = chords[at] as ChordNote[];
    const where = {
      kind: 'theory',
      chordIndex: chordEventIndex(xml, chord),
      bar: barAt(xml, (chord[0] as ChordNote).start),
      hand,
    };

    describe(item.id, () => {
      it('the unchanged item gives no difference, so each result below comes from its one mutation', () => {
        expect(checkExercise(xml, claim)).toEqual([]);
      });

      it('one tone respelled to another letter with the same MIDI number: one spelling difference', () => {
        const tone = chord[1] as ChordNote;
        const to = respelled(tone);
        expect(midiOf(to)).toBe(midiOf(tone));
        expect(checkExercise(withPitch(xml, tone, to), claim)).toEqual([
          { ...where, rule: 'spelling', expected: name(tone, false), found: name(to, true) },
        ]);
      });

      it('one tone moved a semitone: one pitch difference', () => {
        const tone = chord[1] as ChordNote;
        const to = { ...tone, alter: tone.alter > 0 ? tone.alter - 1 : tone.alter + 1 };
        expect(checkExercise(withPitch(xml, tone, to), claim)).toEqual([
          { ...where, rule: 'pitch', expected: name(tone, false), found: name(to, true) },
        ]);
      });

      it('one inversion swapped (the lowest note of one hand raised an octave): one inversion difference', () => {
        const bass = chord[0] as ChordNote;
        if (hand === 'left') {
          // T064: under a melody, a left-hand bass raised an octave can land on a key the melody plays (a second, real
          // difference: overlap), so the left hand's inversion is swapped downwards - its highest note an octave lower
          // becomes the bass.
          const top = chord[chord.length - 1] as ChordNote;
          const lowered = { ...top, octave: top.octave - 1 };
          expect(checkExercise(withPitch(xml, top, lowered), claim)).toEqual([
            { ...where, rule: 'inversion', expected: `${name(bass, false)} in the bass`, found: name(lowered, true) },
          ]);
          return;
        }
        const next = chord[1] as ChordNote;
        expect(checkExercise(withPitch(xml, bass, { ...bass, octave: bass.octave + 1 }), claim)).toEqual([
          { ...where, rule: 'inversion', expected: `${name(bass, false)} in the bass`, found: name(next, true) },
        ]);
      });
    });
  }
});

// Found by the audit's review, not planted: the hand-written scale item of feature 005 had, in section B, right-hand I chords on
// C4-E4-G4 while the left-hand scale struck C4 - one key, two hands. The check names it (rule overlap). The generated
// Beginner step of C major has the same shape (feature 011 replaced the hand-written item), so the mutation is planted there:
// the right-hand I chord of bar 7 moved down an octave lands on the C4 of the left-hand scale.
describe('planted errors: two hands on one key in the C major Beginner step', () => {
  const item = exercises.find((i) => i.id === 'learning/keys/c-major/beginner');
  if (!item) throw new Error('the C major Beginner step is on the shelf');
  const xml = readFileSync(`public/library/${item.file}`, 'utf8');
  const claim = claimForItem({ itemId: item.id, title: item.meta.title, trains: item.meta.trains ?? '' });

  it('the right-hand I chord of bar 7 moved down to C4-E4-G4: one overlap, in bar 7', () => {
    const inBar7 = chordsOf(xml, 1).filter((g) => barAt(xml, (g[0] as ChordNote).start) === '7');
    const chord = inBar7[1] as ChordNote[]; // bar 7 is V then I in the right hand
    let mutated = xml;
    for (const n of chord) mutated = withPitch(mutated, n, { ...n, octave: n.octave - 1 });
    expect(checkExercise(mutated, claim)).toEqual([
      {
        kind: 'theory',
        chordIndex: -1,
        bar: '7',
        hand: 'both',
        rule: 'overlap',
        expected: 'each key played by one hand at a time',
        found: 'C4',
      },
    ]);
  });
});
