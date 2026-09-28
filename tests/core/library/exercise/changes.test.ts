import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generateChangeFamily, generateFamily } from '../../../../src/core/library/exercise/generate.js';
import type { ExerciseDefinition, MelodyPart } from '../../../../src/core/library/exercise/types.js';
import { buildScore } from '../../../../src/core/musicxml/build.js';
import { readXml } from '../../../../src/core/musicxml/read.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Feature 011 retired eight of these definitions from content/library/exercises (the generated steps replace them); they stay
// as fixtures of the 1.0.0 `chords` form so the generator keeps its tests (tests/fixtures/exercises/README.md). The five that
// keep their music (I-V-vi-IV, turnaround, diatonic ladder, the two same-tonic drills) are still shelf content.
const directories = [
  path.join(__dirname, '../../../fixtures/exercises'),
  path.join(__dirname, '../../../../content/library/exercises'),
];

const changeFiles = directories.flatMap((dir) =>
  fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('changes-'))
    .map((f) => path.join(dir, f)),
);

function load(file: string): ExerciseDefinition {
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as ExerciseDefinition;
}

describe('chord-change drills (data-model.md §5.2)', () => {
  it('at least 12 drills are defined across all changes-*.json files (FR-004/SC-004)', () => {
    let total = 0;
    for (const file of changeFiles) total += load(file).keys?.length ?? 0;
    expect(changeFiles.length).toBeGreaterThan(0);
    expect(total).toBeGreaterThanOrEqual(12);
  });

  for (const file of changeFiles) {
    it(`${path.basename(file)}: generates loadable MusicXML with no unexpected notices and full fingering coverage`, () => {
      const def = load(file);
      const items = generateChangeFamily(def, '2026-09-22');
      expect(items.length).toBe(def.keys?.length ?? 0);
      for (const item of items) {
        const { doc } = readXml(item.xml);
        const { score, report } = buildScore(doc);
        const unexpected = report.entries.filter((e) => e.code !== 'defaultTempo');
        expect(unexpected, `${item.fileStem}: ${JSON.stringify(unexpected)}`).toEqual([]);
        const notes = score.parts[0]?.notes ?? [];
        expect(notes.length).toBeGreaterThan(0);
        expect(notes.every((n) => n.fingerings.length === 1)).toBe(true);
        expect(score.navigation.repeats.length).toBeGreaterThanOrEqual(1);
      }
    });
  }
});

// ---- feature 014 T035: the drills' top-level `melody` (contract exercise-definition 1.3 §2, data-model (014) §3) ----

/** One written event of a measure, in the order the file writes it: onset in divisions from the bar start. */
interface WrittenEvent {
  bar: number;
  staff: number;
  onset: number;
  duration: number;
  rest: boolean;
  chord: boolean;
  /** The whole `<note>` element, for an exact comparison of the left hand. */
  xml: string;
}

/** Walks every measure's notes, backups and forwards (the generator writes the right hand, a backup, then the left
 *  hand) and gives each note its onset; a `<chord/>` member shares the onset of the note before it. */
function writtenEvents(xml: string): WrittenEvent[] {
  const out: WrittenEvent[] = [];
  const measures = [...xml.matchAll(/<measure number="(\d+)"[^>]*>([\s\S]*?)<\/measure>/g)];
  for (const [, number, body] of measures) {
    let position = 0;
    let lastOnset = 0;
    for (const [element] of (body ?? '').matchAll(
      /<note\b[\s\S]*?<\/note>|<backup>[\s\S]*?<\/backup>|<forward>[\s\S]*?<\/forward>/g,
    )) {
      const duration = Number(/<duration>(\d+)<\/duration>/.exec(element)?.[1] ?? 0);
      if (element.startsWith('<backup>')) {
        position -= duration;
        continue;
      }
      if (element.startsWith('<forward>')) {
        position += duration;
        continue;
      }
      const chord = /<chord\s*\/>/.test(element);
      const onset = chord ? lastOnset : position;
      if (!chord) {
        lastOnset = position;
        position += duration;
      }
      out.push({
        bar: Number(number),
        staff: Number(/<staff>(\d+)<\/staff>/.exec(element)?.[1] ?? 1),
        onset,
        duration,
        rest: /<rest\b/.test(element),
        chord,
        xml: element,
      });
    }
  }
  return out;
}

const I_V_VI_IV = path.join(__dirname, '../../../../content/library/exercises/changes-i-v-vi-iv.json');
const withoutMelody = (): ExerciseDefinition => {
  const { melody: _ignored, ...rest } = load(I_V_VI_IV);
  return rest;
};

/** A plain test melody over I V vi IV in C major (a chord tone on each chord start): section A three beats and the
 *  quarter rest per bar, section B one whole note per bar, the tonic to close. */
const phrase = (notes: MelodyPart['major']): MelodyPart => ({ major: notes });
const TEST_MELODY: NonNullable<ExerciseDefinition['melody']> = {
  sectionA: phrase([
    {
      position: 1,
      notes: [
        { step: 3, value: 'half' },
        { step: 3, value: 'quarter' },
        { rest: true, value: 'quarter' },
        { step: 2, value: 'dotted-half' },
        { rest: true, value: 'quarter' },
        { step: 3, value: 'dotted-half' },
        { rest: true, value: 'quarter' },
        { step: 1, value: 'dotted-half' },
        { rest: true, value: 'quarter' },
      ],
    },
  ]),
  sectionB: phrase([
    {
      position: 1,
      notes: [
        { step: 5, value: 'whole' },
        { step: 2, value: 'whole' },
        { step: 3, value: 'whole' },
        { step: 4, value: 'whole' },
      ],
    },
  ]),
  final: phrase([{ position: 1, notes: [{ step: 1, value: 'whole' }] }]),
};
const withMelody = (melody = TEST_MELODY): ExerciseDefinition => ({ ...withoutMelody(), melody });

function onlyItem(definition: ExerciseDefinition): string {
  const [item] = generateChangeFamily(definition, '2026-09-28');
  if (!item) throw new Error('the drill generated no item');
  return item.xml;
}

describe('a drill with a top-level melody (contract exercise-definition 1.3 §2, T035)', () => {
  it('(a) the left hand is generated exactly as without the melody: chords, inversions, voicing, ties, rests, repeat', () => {
    const left = (xml: string) =>
      writtenEvents(xml)
        .filter((e) => e.staff === 2)
        .map(({ bar, onset, xml: element }) => ({ bar, onset, element }));
    const plain = onlyItem(withoutMelody());
    const melodic = onlyItem(withMelody());
    expect(left(melodic)).toEqual(left(plain));
    const repeats = (xml: string) => xml.match(/<repeat direction="backward"\s*\/>/g)?.length ?? 0;
    expect(repeats(melodic)).toBe(1);
    expect(repeats(melodic)).toBe(repeats(plain));
  });

  it('(b) in section A the right hand rests with the left hand: a quarter rest at the same onset in every bar', () => {
    const events = writtenEvents(onlyItem(withMelody()));
    const cycle = withoutMelody().steps?.length ?? 0;
    expect(cycle).toBe(4);
    for (let bar = 1; bar <= cycle; bar++) {
      const rests = (staff: number) =>
        events.filter((e) => e.bar === bar && e.staff === staff && e.rest).map((e) => [e.onset, e.duration]);
      expect(rests(2), `bar ${bar}: the left hand's quarter rest`).toEqual([[12, 4]]);
      expect(rests(1), `bar ${bar}`).toEqual(rests(2));
    }
    // ...and before it the right hand plays the melody's own notes (bar 1: a half and a quarter), one at a time.
    const bar1 = events.filter((e) => e.bar === 1 && e.staff === 1 && !e.rest).map((e) => [e.onset, e.duration]);
    expect(bar1).toEqual([
      [0, 8],
      [8, 4],
    ]);
  });

  it('(c) the right hand plays single notes: no <chord/> on staff 1', () => {
    const right = writtenEvents(onlyItem(withMelody())).filter((e) => e.staff === 1);
    expect(right.filter((e) => !e.rest).length).toBeGreaterThan(0);
    expect(right.filter((e) => e.chord)).toEqual([]);
  });

  it('(d) a top-level melody on a family that is not a chord-change drill throws', () => {
    const triads: ExerciseDefinition = { ...withMelody(), family: 'triads-c-major' };
    expect(() => generateFamily(triads, '2026-09-28')).toThrow(/melody/);
    const pattern = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../../../content/library/exercises/step-introduction.json'), 'utf-8'),
    ) as ExerciseDefinition;
    expect(() => generateFamily({ ...pattern, melody: TEST_MELODY }, '2026-09-28')).toThrow(/melody/);
  });

  it('(e) a part that does not fill section A, B or the final bar throws, naming the section', () => {
    const shortA = structuredClone(TEST_MELODY);
    shortA.sectionA.major?.[0]?.notes.pop();
    expect(() => onlyItem(withMelody(shortA))).toThrow(/sectionA/);
    const longB = structuredClone(TEST_MELODY);
    longB.sectionB.major?.[0]?.notes.push({ step: 1, value: 'whole' });
    expect(() => onlyItem(withMelody(longB))).toThrow(/sectionB/);
    const shortFinal = structuredClone(TEST_MELODY);
    const finalNote = shortFinal.final.major?.[0]?.notes[0];
    if (finalNote) finalNote.value = 'half';
    expect(() => onlyItem(withMelody(shortFinal))).toThrow(/final/);
    // Section A must also rest with the left hand: a bar that plays through its quarter rest does not fit the drill.
    const noRest = structuredClone(TEST_MELODY);
    const firstBar = noRest.sectionA.major?.[0]?.notes;
    if (firstBar) firstBar.splice(0, 3, { step: 3, value: 'whole' });
    expect(() => onlyItem(withMelody(noRest))).toThrow(/sectionA.*rest/);
  });
});
