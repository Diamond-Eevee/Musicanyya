import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generateKeyChangeFamily } from '../../../src/core/library/exercise/generate.js';
import type { ExerciseDefinition } from '../../../src/core/library/exercise/types.js';
import { deriveFacts } from '../../../src/core/library/facts.js';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import { buildTimeline } from '../../../src/core/timeline/timeline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, '../../fixtures/musicxml');

function load(name: string) {
  const xml = fs.readFileSync(path.join(fixturesDir, name), 'utf-8');
  const { doc } = readXml(xml);
  const { score, report } = buildScore(doc);
  const { timeline, notices } = buildTimeline(score);
  return deriveFacts({ doc, score, timeline, report, timelineNotices: notices });
}

describe('deriveFacts', () => {
  it('scale-c-major-q100: a single-staff scale with an explicit tempo', () => {
    const facts = load('scale-c-major-q100.musicxml');
    expect(facts.measures).toBe(1);
    expect(facts.notes).toBe(4);
    expect(facts.keys).toEqual(['C major']);
    expect(facts.metres).toEqual(['4/4']);
    expect(facts.tempoBpm).toBe(100);
    expect(facts.tempoDefaulted).toBe(false);
    expect(facts.lowestMidi).toBe(60);
    expect(facts.highestMidi).toBe(65);
    expect(facts.maxSpanSemitones).toBe(0);
    expect(facts.staves).toBe(1);
    expect(facts.voicesPerStaff).toBe(1);
    expect(facts.handIndependenceFraction).toBe(0);
    expect(facts.shortestDivision).toBe(4);
    expect(facts.notesPerBeat).toBeCloseTo(1);
    expect(facts.accidentals).toBe(0);
    expect(facts.hasTies).toBe(false);
    expect(facts.hasTuplets).toBe(false);
    expect(facts.hasGraceNotes).toBe(false);
    expect(facts.hasRepeats).toBe(false);
    expect(facts.fingeringCoverage).toBe(0);
    expect(facts.durationSeconds).toBeCloseTo(2.4);
    expect(facts.notices).toEqual([]);
  });

  it('grand-staff-two-voices-per-staff: hand span, voices per staff, and hand independence', () => {
    const facts = load('grand-staff-two-voices-per-staff.musicxml');
    expect(facts.staves).toBe(2);
    expect(facts.voicesPerStaff).toBe(2);
    expect(facts.lowestMidi).toBe(43);
    expect(facts.highestMidi).toBe(72);
    expect(facts.maxSpanSemitones).toBe(8); // staff 1: C5-E4
    // Both staves sound at the same single onset, so this one measure is not independent.
    expect(facts.handIndependenceFraction).toBe(0);
    expect(facts.shortestDivision).toBe(1); // whole notes
    expect(facts.tempoDefaulted).toBe(true);
    expect(facts.notices).toEqual(['defaultTempo']);
  });

  it('tuplet-triplet-eighths: notation flags and shortest division', () => {
    const facts = load('tuplet-triplet-eighths.musicxml');
    expect(facts.hasTuplets).toBe(true);
    expect(facts.notes).toBe(3);
    expect(facts.shortestDivision).toBe(8);
    expect(facts.notesPerBeat).toBeCloseTo(2);
  });

  it('tie-chain-three: ties are detected and a tied chain is still three written notes', () => {
    const facts = load('tie-chain-three.musicxml');
    expect(facts.hasTies).toBe(true);
    expect(facts.notes).toBe(3);
    expect(facts.metres).toEqual(['3/4']);
    expect(facts.maxSpanSemitones).toBe(0);
  });

  it('meter-change: metres lists each distinct time signature in order', () => {
    const facts = load('meter-change.musicxml');
    expect(facts.metres).toEqual(['4/4', '3/4']);
    expect(facts.measures).toBe(2);
    expect(facts.notes).toBe(7);
  });

  it('a grace note (duration 0) never makes shortestDivision look like a whole note', () => {
    // A grace note's durationTicks is 0 (build.ts: its timing steals from a neighbour rather than
    // occupying the timeline); the shortest *notated* value here is the real quarter note that follows.
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
  <measure number="1">
    <attributes><divisions>1</divisions></attributes>
    <note><grace/><pitch><step>B</step><octave>3</octave></pitch></note>
    <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
  </measure>
  </part>
</score-partwise>`;
    const { doc } = readXml(xml);
    const { score, report } = buildScore(doc);
    const { timeline, notices } = buildTimeline(score);
    const facts = deriveFacts({ doc, score, timeline, report, timelineNotices: notices });
    expect(facts.hasGraceNotes).toBe(true);
    expect(facts.shortestDivision).toBe(4); // quarter, not the grace note's 0-duration artifact
  });

  it('a melody over one held chord is not "hand independent" - one hand is not rhythmically active (data-model.md §4 correction C)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
  <measure number="1">
    <attributes><divisions>1</divisions><staves>2</staves></attributes>
    <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><type>quarter</type><staff>1</staff></note>
    <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><type>quarter</type><staff>1</staff></note>
    <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><type>quarter</type><staff>1</staff></note>
    <note><pitch><step>A</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><type>quarter</type><staff>1</staff></note>
    <backup><duration>4</duration></backup>
    <note><pitch><step>C</step><octave>3</octave></pitch><duration>4</duration><voice>5</voice><type>whole</type><staff>2</staff></note>
  </measure>
  </part>
</score-partwise>`;
    const { doc } = readXml(xml);
    const { score, report } = buildScore(doc);
    const { timeline, notices } = buildTimeline(score);
    const facts = deriveFacts({ doc, score, timeline, report, timelineNotices: notices });
    expect(facts.handIndependenceFraction).toBe(0);
  });

  it('a run of consecutive half notes is not a "run" - only a shortest value faster than a quarter counts (correction C)', () => {
    const facts = load('grand-staff-two-voices-per-staff.musicxml'); // whole notes throughout
    expect(facts.longestRunAtShortestValue).toBe(0);
  });

  it('a three-note chord is one attack, not three (correction C: density counts attacks)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
  <measure number="1">
    <attributes><divisions>1</divisions></attributes>
    <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    <note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    <note><chord/><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
  </measure>
  </part>
</score-partwise>`;
    const { doc } = readXml(xml);
    const { score, report } = buildScore(doc);
    const { timeline, notices } = buildTimeline(score);
    const facts = deriveFacts({ doc, score, timeline, report, timelineNotices: notices });
    expect(facts.notes).toBe(3);
    expect(facts.attackCount).toBe(1);
  });
});

// Feature 011 (specs/011-learning-by-key/data-model.md §4): hand independence under the B1 rule, the new
// `chordChangesPerBar` fact, and the accidental count the minor-scale exemption (D-2 B5) needs.

interface XmlNote {
  step: string;
  octave: number;
  /** Duration in divisions (divisions = 1 per quarter note unless the fixture says otherwise). */
  duration: number;
  type: string;
  staff: 1 | 2;
  chord?: boolean;
  alter?: number;
  accidental?: string;
  dot?: boolean;
}

function noteXml(n: XmlNote): string {
  const alter = n.alter !== undefined ? `<alter>${n.alter}</alter>` : '';
  const accidental = n.accidental ? `<accidental>${n.accidental}</accidental>` : '';
  return `<note>${n.chord ? '<chord/>' : ''}<pitch><step>${n.step}</step>${alter}<octave>${n.octave}</octave></pitch><duration>${n.duration}</duration><voice>${n.staff === 1 ? 1 : 5}</voice><type>${n.type}</type>${n.dot ? '<dot/>' : ''}${accidental}<staff>${n.staff}</staff></note>`;
}

/** One measure of grand-staff music: staff 1 first, `<backup>` over it, then staff 2. `divisions` is per quarter. */
function measureXml(
  number: number,
  upper: readonly XmlNote[],
  lower: readonly XmlNote[],
  options: { divisions?: number; key?: string; measureDivisions: number },
): string {
  const attributes =
    number === 1
      ? `<attributes><divisions>${options.divisions ?? 1}</divisions>${options.key ?? ''}<staves>2</staves></attributes>`
      : options.key
        ? `<attributes>${options.key}</attributes>`
        : '';
  const upperXml = upper.map(noteXml).join('');
  const lowerXml = lower.map(noteXml).join('');
  const backup = lower.length > 0 ? `<backup><duration>${options.measureDivisions}</duration></backup>` : '';
  return `<measure number="${number}">${attributes}${upperXml}${backup}${lowerXml}</measure>`;
}

function factsFromMeasures(measures: string): ReturnType<typeof deriveFacts> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">${measures}</part>
</score-partwise>`;
  const { doc } = readXml(xml);
  const { score, report } = buildScore(doc);
  const { timeline, notices } = buildTimeline(score);
  return deriveFacts({ doc, score, timeline, report, timelineNotices: notices });
}

const quarters = (step: string, octave: number, staff: 1 | 2): XmlNote[] =>
  [0, 1, 2, 3].map(() => ({ step, octave, duration: 1, type: 'quarter', staff }));

describe('deriveFacts: hand independence, the B1 rule (data-model.md §4)', () => {
  const wholeChord = (staff: 1 | 2): XmlNote[] => [
    { step: 'C', octave: 3, duration: 4, type: 'whole', staff },
    { step: 'E', octave: 3, duration: 4, type: 'whole', staff, chord: true },
    { step: 'G', octave: 3, duration: 4, type: 'whole', staff, chord: true },
  ];

  it("RH quarters over an LH whole-note chord is dependent (the slower hand's onsets are a subset)", () => {
    const facts = factsFromMeasures(measureXml(1, quarters('E', 4, 1), wholeChord(2), { measureDivisions: 4 }));
    expect(facts.handIndependenceFraction).toBe(0);
  });

  it('RH quarters over LH halves on beats 1 and 3 is dependent', () => {
    const halves: XmlNote[] = [
      { step: 'C', octave: 3, duration: 2, type: 'half', staff: 2 },
      { step: 'G', octave: 3, duration: 2, type: 'half', staff: 2 },
    ];
    const facts = factsFromMeasures(measureXml(1, quarters('E', 4, 1), halves, { measureDivisions: 4 }));
    expect(facts.handIndependenceFraction).toBe(0);
  });

  it('RH quarters over an LH dotted rhythm with an onset on beat 2.5 is independent', () => {
    // divisions = 2 per quarter: RH onsets 0, 2, 4, 6; LH dotted quarter, quarter, dotted quarter: onsets 0, 3, 5.
    const rh: XmlNote[] = [0, 1, 2, 3].map(() => ({ step: 'E', octave: 4, duration: 2, type: 'quarter', staff: 1 }));
    const lh: XmlNote[] = [
      { step: 'C', octave: 3, duration: 3, type: 'quarter', staff: 2, dot: true },
      { step: 'D', octave: 3, duration: 2, type: 'quarter', staff: 2 },
      { step: 'E', octave: 3, duration: 3, type: 'quarter', staff: 2, dot: true },
    ];
    const facts = factsFromMeasures(measureXml(1, rh, lh, { divisions: 2, measureDivisions: 8 }));
    expect(facts.handIndependenceFraction).toBe(1);
  });

  it('identical onsets in both hands is dependent', () => {
    const facts = factsFromMeasures(measureXml(1, quarters('E', 4, 1), quarters('C', 3, 2), { measureDivisions: 4 }));
    expect(facts.handIndependenceFraction).toBe(0);
  });

  it('counts the fraction of written measures that are independent', () => {
    const rh: XmlNote[] = [0, 1, 2, 3].map(() => ({ step: 'E', octave: 4, duration: 2, type: 'quarter', staff: 1 }));
    const lh: XmlNote[] = [
      { step: 'C', octave: 3, duration: 3, type: 'quarter', staff: 2, dot: true },
      { step: 'D', octave: 3, duration: 2, type: 'quarter', staff: 2 },
      { step: 'E', octave: 3, duration: 3, type: 'quarter', staff: 2, dot: true },
    ];
    const independent = measureXml(1, rh, lh, { divisions: 2, measureDivisions: 8 });
    const dependent = measureXml(2, rh, [{ step: 'C', octave: 3, duration: 8, type: 'whole', staff: 2 }], {
      measureDivisions: 8,
    });
    expect(factsFromMeasures(independent + dependent).handIndependenceFraction).toBe(0.5);
  });
});

describe('deriveFacts: chordChangesPerBar (data-model.md §4)', () => {
  const chord = (steps: readonly [string, number][], staff: 1 | 2, duration = 4, type = 'whole'): XmlNote[] =>
    steps.map(([step, octave], i) => ({ step, octave, duration, type, staff, chord: i > 0 }));
  const C_MAJOR: [string, number][] = [
    ['C', 3],
    ['E', 3],
    ['G', 3],
  ];
  const F_MAJOR: [string, number][] = [
    ['F', 3],
    ['A', 3],
    ['C', 4],
  ];
  const G_MAJOR: [string, number][] = [
    ['G', 3],
    ['B', 3],
    ['D', 4],
  ];
  const melody = (): XmlNote[] => [{ step: 'C', octave: 5, duration: 4, type: 'whole', staff: 1 }];

  it('counts chord attacks that differ from the previous chord attack, the first included', () => {
    const measures = [C_MAJOR, F_MAJOR, G_MAJOR, C_MAJOR]
      .map((c, i) => measureXml(i + 1, melody(), chord(c, 2), { measureDivisions: 4 }))
      .join('');
    expect(factsFromMeasures(measures).chordChangesPerBar).toBe(1);
  });

  it('a repeated identical chord does not count', () => {
    const measures = [C_MAJOR, C_MAJOR, G_MAJOR]
      .map((c, i) => measureXml(i + 1, melody(), chord(c, 2), { measureDivisions: 4 }))
      .join('');
    // C (counts), C again (does not), G (counts): 2 changes over 3 bars
    expect(factsFromMeasures(measures).chordChangesPerBar).toBeCloseTo(2 / 3);
  });

  it('a broken chord counts no chord attacks', () => {
    const broken: XmlNote[] = [
      { step: 'C', octave: 3, duration: 1, type: 'quarter', staff: 2 },
      { step: 'E', octave: 3, duration: 1, type: 'quarter', staff: 2 },
      { step: 'G', octave: 3, duration: 1, type: 'quarter', staff: 2 },
      { step: 'E', octave: 3, duration: 1, type: 'quarter', staff: 2 },
    ];
    const facts = factsFromMeasures(measureXml(1, melody(), broken, { measureDivisions: 4 }));
    expect(facts.chordChangesPerBar).toBe(0);
  });

  it('two staves sum', () => {
    const measures = [C_MAJOR, F_MAJOR]
      .map((c, i) => measureXml(i + 1, chord(c, 1), chord(c, 2), { measureDivisions: 4 }))
      .join('');
    // 2 bars, each staff changes chord twice (C, then F): 4 changes over 2 bars
    expect(factsFromMeasures(measures).chordChangesPerBar).toBe(2);
  });

  it('chords inside one bar count each change', () => {
    const halves = [C_MAJOR, G_MAJOR].flatMap((c) => chord(c, 2, 2, 'half'));
    const facts = factsFromMeasures(measureXml(1, melody(), halves, { measureDivisions: 4 }));
    expect(facts.chordChangesPerBar).toBe(2);
  });

  it('is 0 for a single-note score', () => {
    expect(load('scale-c-major-q100.musicxml').chordChangesPerBar).toBe(0);
  });
});

describe('deriveFacts: minorScaleAccidentalCount (D-2 B5)', () => {
  const key = (fifths: number, mode: string) => `<key><fifths>${fifths}</fifths><mode>${mode}</mode></key>`;

  it('counts the raised 7th and 6th of the minor key, and nothing else', () => {
    // A minor (no signature): G sharp (raised 7th) and F sharp (raised 6th) written; a B flat is not a scale degree accidental.
    const upper: XmlNote[] = [
      { step: 'G', alter: 1, octave: 4, duration: 1, type: 'quarter', staff: 1, accidental: 'sharp' },
      { step: 'F', alter: 1, octave: 4, duration: 1, type: 'quarter', staff: 1, accidental: 'sharp' },
      { step: 'B', alter: -1, octave: 4, duration: 1, type: 'quarter', staff: 1, accidental: 'flat' },
      { step: 'A', octave: 4, duration: 1, type: 'quarter', staff: 1 },
    ];
    const facts = factsFromMeasures(measureXml(1, upper, [], { measureDivisions: 4, key: key(0, 'minor') }));
    expect(facts.accidentalMarkCount).toBe(3);
    expect(facts.minorScaleAccidentalCount).toBe(2);
    expect(facts.keys).toEqual(['A minor']);
  });

  it('follows the key signature: in F sharp minor the raised 7th is E sharp and the raised 6th D sharp', () => {
    const upper: XmlNote[] = [
      { step: 'E', alter: 1, octave: 4, duration: 2, type: 'half', staff: 1, accidental: 'sharp' },
      { step: 'D', alter: 1, octave: 4, duration: 1, type: 'quarter', staff: 1, accidental: 'sharp' },
      { step: 'B', alter: 1, octave: 4, duration: 1, type: 'quarter', staff: 1, accidental: 'sharp' },
    ];
    const facts = factsFromMeasures(measureXml(1, upper, [], { measureDivisions: 4, key: key(3, 'minor') }));
    expect(facts.keys).toEqual(['F♯ minor']);
    expect(facts.accidentalMarkCount).toBe(3);
    expect(facts.minorScaleAccidentalCount).toBe(2); // B sharp is the 4th degree
  });

  it('is 0 when the score has no accidentals', () => {
    expect(load('scale-c-major-q100.musicxml').minorScaleAccidentalCount).toBe(0);
  });
});

// Feature 011 T044 (research R7): a relative key change keeps the key signature, so the file has one `<key>` and the item
// reports one key name (it is not a key change to criterion 10); a parallel change writes a second `<key>` and reports two.
describe('deriveFacts: key changes of the generated key-change items', () => {
  const generated = (relation: 'relative' | 'parallel') =>
    generateKeyChangeFamily(
      JSON.parse(
        fs.readFileSync(
          path.resolve(__dirname, `../../../content/library/exercises/key-change-${relation}-introduction.json`),
          'utf-8',
        ),
      ) as ExerciseDefinition,
      '2026-09-26',
    );
  const keysOf = (xml: string): string[] => {
    const { doc } = readXml(xml);
    const { score, report } = buildScore(doc);
    const { timeline, notices } = buildTimeline(score);
    return deriveFacts({ doc, score, timeline, report, timelineNotices: notices }).keys;
  };

  it('C major to A minor (relative, one signature): one key name', () => {
    const item = generated('relative').find((i) => i.section.endsWith('/c-major-to-a-minor'));
    expect(keysOf(item?.xml ?? '')).toEqual(['C major']);
  });

  it('C major to C minor (parallel, a second signature): two key names', () => {
    const item = generated('parallel').find((i) => i.section.endsWith('/c-major-to-c-minor'));
    expect(keysOf(item?.xml ?? '')).toEqual(['C major', 'C minor']);
  });

  it('every relative pair reports one key name and every parallel pair two', () => {
    for (const item of generated('relative')) expect(keysOf(item.xml), item.section).toHaveLength(1);
    for (const item of generated('parallel')) expect(keysOf(item.xml), item.section).toHaveLength(2);
  });
});

// Feature 019 (library-index 1.3.0, data-model section 6.1): facts come from the printed parts only, and an item with an
// Orchestra says so. A fixture and its twin (the same file with the Orchestra part cut out) differ in nothing else.
describe('deriveFacts with an Orchestra part (feature 019)', () => {
  const CASES: [string, string[]][] = [
    ['piano-and-oboe', ['Oboe']],
    ['piano-and-two-staff-orchestra', ['Harp']],
    ['orchestra-first', ['Oboe']],
    ['orchestra-same-program', ['Piano (orchestra)']],
  ];

  it.each(CASES)(
    "%s: every fact equals the twin's except `orchestra`, which names the instruments",
    (name, instruments) => {
      const { orchestra, ...rest } = load(`orchestra/${name}.musicxml`);
      expect(orchestra).toEqual(instruments);
      expect(rest).toEqual(load(`orchestra/${name}-twin.musicxml`));
    },
  );

  it("counts printed parts only: one part, the piano's range and note count, whatever the Orchestra plays", () => {
    const facts = load('orchestra/piano-and-two-staff-orchestra.musicxml');
    expect(facts.parts).toBe(1);
    expect(facts.notes).toBe(load('orchestra/piano-and-two-staff-orchestra-twin.musicxml').notes);
    // the harp plays down to G1 (31) and the piano's lowest is F2 (41): the Orchestra does not widen the range
    expect(facts.lowestMidi).toBe(41);
    const oboe = load('orchestra/piano-and-oboe.musicxml');
    expect(oboe.highestMidi).toBe(79); // G5 in the right hand, not the oboe's B5
    expect(oboe.notes).toBe(load('orchestra/piano-and-oboe-twin.musicxml').notes);
  });

  it('an item without an Orchestra has no `orchestra` fact at all', () => {
    expect('orchestra' in load('orchestra/piano-and-oboe-twin.musicxml')).toBe(false);
    expect('orchestra' in load('scale-c-major-q100.musicxml')).toBe(false);
  });

  it('hidden staves that are not an Orchestra are counted like any other part, and name no Orchestra', () => {
    const facts = load('orchestra/partly-hidden.musicxml');
    expect(facts.parts).toBe(2);
    expect('orchestra' in facts).toBe(false);
  });
});

// Feature 019 (library-index 1.3.0, research R-17): a chord whose notes all carry <arpeggiate> is rolled - its span is not a
// hand span - and is reported as `maxArpeggiatedSpanSemitones`; a chord with only some notes marked counts as not rolled.
describe('deriveFacts: rolled chords (feature 019)', () => {
  const fixture = fs.readFileSync(path.join(fixturesDir, 'arpeggiate-chord.musicxml'), 'utf-8');
  function factsOf(xml: string) {
    const { doc } = readXml(xml);
    const { score, report } = buildScore(doc);
    const { timeline, notices } = buildTimeline(score);
    return deriveFacts({ doc, score, timeline, report, timelineNotices: notices });
  }

  it('a rolled C-E-G (7 semitones) is left out of maxSpanSemitones and reported on its own; the unmarked F-A (4) stays', () => {
    const facts = factsOf(fixture);
    expect(facts.maxSpanSemitones).toBe(4);
    expect(facts.maxArpeggiatedSpanSemitones).toBe(7);
  });

  it('a rolled tenth (16 semitones) is a rolled span, not a hand span', () => {
    const tenth = fixture.replace('<step>G</step><octave>4</octave>', '<step>E</step><octave>5</octave>');
    const facts = factsOf(tenth);
    expect(facts.maxSpanSemitones).toBe(4);
    expect(facts.maxArpeggiatedSpanSemitones).toBe(16);
  });

  it('a chord with only some notes arpeggiated counts as not rolled', () => {
    const partial = fixture.replace(
      '<note><chord/><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><type>half</type>\n      <notations><arpeggiate/></notations>',
      '<note><chord/><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><type>half</type>\n      <notations/>',
    );
    expect(partial).not.toBe(fixture);
    const facts = factsOf(partial);
    expect(facts.maxSpanSemitones).toBe(7);
    expect('maxArpeggiatedSpanSemitones' in facts).toBe(false);
  });

  it('a Score with no rolled chord has no maxArpeggiatedSpanSemitones, and its maxSpanSemitones is as before', () => {
    const facts = load('chord-basic.musicxml');
    expect('maxArpeggiatedSpanSemitones' in facts).toBe(false);
    expect(facts.maxSpanSemitones).toBe(7);
  });
});
