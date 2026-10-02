/**
 * Feature 019 (contracts/orchestration-definition.md, research R-16): the dev tool that writes an item's Orchestra parts from a
 * reviewed definition, and the checker (rules O1-O5) that keeps them honest. Everything here runs on a small own-work piano
 * piece built in this file: two staves, four bars of 4/4 (divisions 2, so a quarter note is 2 and a bar 8), with a chord, grace
 * and trilled notes, eighth notes and a tie across a barline.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildScore } from '../../src/core/musicxml/build.js';
import { readXml } from '../../src/core/musicxml/read.js';
import type { Part, Score } from '../../src/core/score/model.js';
import { checkOrchestra } from '../../tools/library/fidelity/orchestra';
import { main } from '../../tools/library/orchestra/cli';
import {
  DefinitionError,
  type OrchestrationDefinition,
  parseDefinition,
} from '../../tools/library/orchestra/definition';
import { GenerateError, generateOrchestra, withoutOrchestra } from '../../tools/library/orchestra/generate';

// ---- the piano piece -------------------------------------------------------------------------------------------------

interface N {
  step?: string;
  octave?: number;
  dur?: number;
  type?: string;
  staff?: number;
  chord?: boolean;
  grace?: boolean;
  tie?: 'start' | 'stop';
  trill?: boolean;
  rest?: boolean;
}
const n = (step: string, octave: number, dur: number, type: string, o: Partial<N> = {}): N => ({
  step,
  octave,
  dur,
  type,
  ...o,
});
const r = (dur: number, type: string, staff = 1): N => ({ rest: true, dur, type, staff });

function noteXml(note: N): string {
  const staff = note.staff ?? 1;
  const parts = ['<note>'];
  if (note.grace) parts.push('<grace slash="yes"/>');
  if (note.chord) parts.push('<chord/>');
  if (note.rest) parts.push('<rest/>');
  else parts.push(`<pitch><step>${note.step}</step><octave>${note.octave}</octave></pitch>`);
  if (!note.grace) parts.push(`<duration>${note.dur}</duration>`);
  if (note.tie) parts.push(`<tie type="${note.tie}"/>`);
  parts.push(`<voice>${staff === 1 ? 1 : 5}</voice><type>${note.type}</type><staff>${staff}</staff>`);
  const notations = [];
  if (note.tie) notations.push(`<tied type="${note.tie}"/>`);
  if (note.trill) notations.push('<ornaments><trill-mark/></ornaments>');
  if (notations.length > 0) parts.push(`<notations>${notations.join('')}</notations>`);
  parts.push('</note>');
  return parts.join('');
}

const lh = (n1: N, ...rest: N[]) => [n1, ...rest].map((x) => ({ ...x, staff: 2 }));
const BARS: { rh: N[]; lh: N[] }[] = [
  {
    rh: [
      n('C', 5, 2, 'quarter'),
      n('E', 5, 2, 'quarter', { chord: true }),
      n('G', 5, 2, 'quarter', { chord: true }),
      n('D', 5, 2, 'quarter'),
      n('E', 5, 4, 'half'),
    ],
    lh: lh(n('C', 3, 8, 'whole'), n('G', 3, 8, 'whole', { chord: true })),
  },
  {
    rh: [
      n('F', 5, 1, 'eighth'),
      n('G', 5, 1, 'eighth'),
      n('A', 5, 2, 'quarter'),
      n('C', 6, 0, 'eighth', { grace: true }),
      n('B', 5, 2, 'quarter'),
      n('D', 5, 2, 'quarter', { trill: true }),
    ],
    lh: lh(n('G', 2, 8, 'whole')),
  },
  { rh: [n('C', 5, 4, 'half'), n('E', 5, 4, 'half', { tie: 'start' })], lh: lh(n('C', 3, 8, 'whole')) },
  { rh: [n('E', 5, 4, 'half', { tie: 'stop' }), r(4, 'half')], lh: lh(n('C', 3, 8, 'whole')) },
];

function pianoXml(withParts = ''): string {
  const bars = BARS.map((bar, i) => {
    const attrs =
      i === 0
        ? '<attributes><divisions>2</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes><direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>100</per-minute></metronome></direction-type><sound tempo="100"/></direction>'
        : '';
    return `<measure number="${i + 1}">${attrs}${bar.rh.map(noteXml).join('')}<backup><duration>8</duration></backup>${bar.lh.map(noteXml).join('')}</measure>`;
  }).join('\n    ');
  return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>Orchestra test piece</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name><score-instrument id="P1-I1"><instrument-name>Piano</instrument-name></score-instrument><midi-instrument id="P1-I1"><midi-channel>1</midi-channel><midi-program>1</midi-program></midi-instrument></score-part>
  </part-list>
  <part id="P1">
    ${bars}
  </part>${withParts}
</score-partwise>
`;
}

// ---- definitions ------------------------------------------------------------------------------------------------------

const FLUTE = { id: 'orch-flute', name: 'Flute', program: 74, dynamics: 50, range: { low: 60, high: 96 } };
const STRINGS = { id: 'orch-strings', name: 'Strings', program: 49, dynamics: 40, range: { low: 28, high: 91 } };

function definition(passages: unknown[], instruments: unknown[] = [FLUTE, STRINGS]): OrchestrationDefinition {
  return parseDefinition({
    version: 1,
    itemId: 'test/piece',
    reviewedBy: 'tester',
    reviewedOn: '2026-10-01',
    instruments,
    passages,
  });
}
const flutePassage = (over: Record<string, unknown> = {}) => ({
  instrument: 'orch-flute',
  bars: { from: 1, to: 2 },
  doubles: { staff: 1, pick: 'top' },
  octaves: [0],
  fitRange: true,
  ...over,
});
const stringsPassage = (over: Record<string, unknown> = {}) => ({
  instrument: 'orch-strings',
  bars: { from: 1, to: 4 },
  doubles: { staff: 2, pick: 'all' },
  octaves: [0, -1],
  fitRange: true,
  ...over,
});
const BASE = definition([flutePassage(), stringsPassage()]);

// ---- reading the result -----------------------------------------------------------------------------------------------

function parse(xml: string): { score: Score; notices: string[] } {
  const { score, report } = buildScore(readXml(xml).doc);
  return { score, notices: report.entries.map((e) => e.code) };
}
const part = (score: Score, xmlId: string): Part => {
  const found = score.parts.find((p) => p.xmlId === xmlId);
  if (!found) throw new Error(`no part ${xmlId}`);
  return found;
};
const keys = (p: Part) => p.notes.map((x) => x.soundingKey);
const generate = (def: OrchestrationDefinition, xml = pianoXml()) => generateOrchestra(xml, def).xml;

describe('orchestration definition (contract orchestration-definition.md section 1, data-model 6.2)', () => {
  const ok = [flutePassage(), stringsPassage()];
  const fails = (json: unknown, pattern: RegExp) => {
    expect(() => parseDefinition(json)).toThrow(DefinitionError);
    expect(() => parseDefinition(json)).toThrow(pattern);
  };
  const withPassages = (passages: unknown[], instruments: unknown[] = [FLUTE, STRINGS]) => ({
    version: 1,
    itemId: 'test/piece',
    reviewedBy: 'tester',
    reviewedOn: '2026-10-01',
    instruments,
    passages,
  });

  it('accepts a valid definition', () => {
    expect(parseDefinition(withPassages(ok)).instruments.map((i) => i.id)).toEqual(['orch-flute', 'orch-strings']);
  });

  it('an unknown instrument in a passage is an error', () => {
    fails(withPassages([flutePassage({ instrument: 'orch-tuba' })]), /unknown instrument "orch-tuba"/);
  });

  it('overlapping passages of one instrument are an error; the same bars on two instruments are fine', () => {
    fails(
      withPassages([flutePassage({ bars: { from: 1, to: 3 } }), flutePassage({ bars: { from: 3, to: 4 } })]),
      /overlap/,
    );
    expect(() =>
      parseDefinition(withPassages([flutePassage(), stringsPassage({ bars: { from: 1, to: 2 } })])),
    ).not.toThrow();
  });

  it('octaves that are empty, too many or outside -2..2 are an error', () => {
    fails(withPassages([flutePassage({ octaves: [] })]), /octaves/);
    fails(withPassages([flutePassage({ octaves: [3] })]), /octaves/);
    fails(withPassages([flutePassage({ octaves: [-3] })]), /octaves/);
    fails(withPassages([flutePassage({ octaves: [0, 1, -1, 2] })]), /octaves/);
    fails(withPassages([flutePassage({ octaves: [0.5] })]), /octaves/);
  });

  it('bars that are not a positive range are an error', () => {
    fails(withPassages([flutePassage({ bars: { from: 0, to: 2 } })]), /bars/);
    fails(withPassages([flutePassage({ bars: { from: 3, to: 2 } })]), /bars/);
  });

  it('the usual shape errors: version, instruments 1..8, program, dynamics, range, pick, staff', () => {
    fails({ ...withPassages(ok), version: 2 }, /version/);
    fails(withPassages(ok, []), /instruments/);
    fails(
      withPassages(
        ok,
        Array.from({ length: 9 }, (_, i) => ({ ...FLUTE, id: `i${i}` })),
      ),
      /instruments/,
    );
    fails(withPassages(ok, [{ ...FLUTE, program: 129 }, STRINGS]), /program/);
    fails(withPassages(ok, [{ ...FLUTE, dynamics: 142 }, STRINGS]), /dynamics/);
    fails(withPassages(ok, [{ ...FLUTE, range: { low: 90, high: 60 } }, STRINGS]), /range/);
    fails(withPassages([flutePassage({ doubles: { staff: 3, pick: 'top' } })]), /staff/);
    fails(withPassages([flutePassage({ doubles: { staff: 1, pick: 'middle' } })]), /pick/);
    fails(withPassages([flutePassage({ fitRange: 'yes' })]), /fitRange/);
  });
});

describe('generateOrchestra: what is written (research R-16)', () => {
  it('appends one Orchestra part per instrument after the printed part, in definition order, with its GM program', () => {
    const { score } = parse(generate(BASE));
    expect(score.parts.map((p) => [p.xmlId, p.orchestra])).toEqual([
      ['P1', false],
      ['orch-flute', true],
      ['orch-strings', true],
    ]);
    expect(part(score, 'orch-flute').name).toBe('Flute');
    expect(part(score, 'orch-flute').instruments[0]?.program).toBe(73); // GM 74, 0-based in the model
    expect(part(score, 'orch-strings').instruments[0]?.program).toBe(48);
  });

  it('every staff of an Orchestra part is written print-object="no" print-spacing="no"', () => {
    const xml = generate(BASE);
    expect(xml.match(/<staff-details print-object="no" print-spacing="no"\/>/g)).toHaveLength(2); // one-staff parts
    const { score } = parse(xml);
    expect(part(score, 'orch-flute').staves).toBe(1);
  });

  it('pick top, bottom and all: one note of a chord per onset, or all of them', () => {
    const top = parse(
      generate(definition([flutePassage({ bars: { from: 1, to: 1 }, doubles: { staff: 1, pick: 'top' } })], [FLUTE])),
    );
    expect(keys(part(top.score, 'orch-flute'))).toEqual([79, 74, 76]); // G5, D5, E5
    const bottom = parse(
      generate(
        definition([flutePassage({ bars: { from: 1, to: 1 }, doubles: { staff: 1, pick: 'bottom' } })], [FLUTE]),
      ),
    );
    expect(keys(part(bottom.score, 'orch-flute'))).toEqual([72, 74, 76]); // C5, D5, E5
    const all = parse(
      generate(definition([flutePassage({ bars: { from: 1, to: 1 }, doubles: { staff: 1, pick: 'all' } })], [FLUTE])),
    );
    expect(keys(part(all.score, 'orch-flute')).sort((a, b) => a - b)).toEqual([72, 74, 76, 76, 79]);
  });

  it('minQuarters leaves out notes shorter than it', () => {
    const { score } = parse(
      generate(
        definition(
          [flutePassage({ bars: { from: 1, to: 2 }, doubles: { staff: 1, pick: 'all' }, minQuarters: 1.5 })],
          [FLUTE],
        ),
      ),
    );
    expect(keys(part(score, 'orch-flute'))).toEqual([76]); // only the E5 half note: nothing else is 1.5 quarters long
  });

  it('writes one doubled note per entry of octaves', () => {
    const { score } = parse(
      generate(definition([flutePassage({ bars: { from: 1, to: 1 }, octaves: [0, 1, -1] })], [FLUTE])),
    );
    expect(keys(part(score, 'orch-flute')).sort((a, b) => a - b)).toEqual([62, 64, 67, 74, 76, 79, 86, 88, 91]);
  });

  it('fitRange true moves a shifted note by whole octaves into the instrument range', () => {
    const narrow = { ...FLUTE, range: { low: 70, high: 80 } };
    const down = parse(generate(definition([flutePassage({ bars: { from: 1, to: 1 }, octaves: [1] })], [narrow])));
    expect(keys(part(down.score, 'orch-flute'))).toEqual([79, 74, 76]); // 91, 86, 88 moved down to 79, 74, 76
    const up = parse(generate(definition([flutePassage({ bars: { from: 1, to: 1 }, octaves: [-1] })], [narrow])));
    expect(keys(part(up.score, 'orch-flute'))).toEqual([79, 74, 76]); // 67, 62, 64 moved up
  });

  it('fitRange false makes a note outside the range an error that names it, and nothing is written', () => {
    const narrow = { ...FLUTE, range: { low: 70, high: 80 } };
    const def = definition([flutePassage({ bars: { from: 1, to: 1 }, octaves: [1], fitRange: false })], [narrow]);
    expect(() => generateOrchestra(pianoXml(), def)).toThrow(GenerateError);
    expect(() => generateOrchestra(pianoXml(), def)).toThrow(/bar 1/);
  });

  it('never doubles a grace note or a trilled note', () => {
    const { score } = parse(
      generate(definition([flutePassage({ bars: { from: 2, to: 2 }, doubles: { staff: 1, pick: 'all' } })], [FLUTE])),
    );
    expect(keys(part(score, 'orch-flute'))).toEqual([77, 79, 81, 83]); // not the grace C6 (84) or the trilled D5 (74)
    expect(part(score, 'orch-flute').notes.every((x) => x.grace === null && x.ornament === null)).toBe(true);
  });

  it('keeps every doubled note the length the piano writes it, and a tie across the barline stays a tie, never longer', () => {
    const { score } = parse(
      generate(definition([flutePassage({ bars: { from: 3, to: 4 }, doubles: { staff: 1, pick: 'top' } })], [FLUTE])),
    );
    const flute = part(score, 'orch-flute');
    const piano = part(score, 'P1').notes.filter((x) => x.staff === 1 && x.measureIndex >= 2 && !x.chord);
    const pitched = piano.filter((x) => x.writtenKey > 0);
    expect(flute.notes.map((x) => x.durationTicks)).toEqual(pitched.map((x) => x.durationTicks));
    expect(flute.notes.map((x) => [x.tie.start, x.tie.stop])).toEqual(pitched.map((x) => [x.tie.start, x.tie.stop]));
    expect(flute.notes.map((x) => x.measureIndex)).toEqual([2, 2, 3]);
  });

  it('measures minQuarters on a whole tie chain and doubles all of it, tie included (019 T105)', () => {
    // Bars 3-4: E5 half tied to E5 half = 4 quarters. Found in Morning Mood: a dotted quarter tied to a shorter note
    // was doubled without its continuation, leaving a tie start the app reports as broken.
    const { score } = parse(
      generate(
        definition(
          [flutePassage({ bars: { from: 3, to: 4 }, doubles: { staff: 1, pick: 'all' }, minQuarters: 3 })],
          [FLUTE],
        ),
      ),
    );
    const flute = part(score, 'orch-flute');
    expect(keys(flute)).toEqual([76, 76]); // not the C5 half note (2 quarters)
    expect(flute.notes.map((x) => [x.tie.start, x.tie.stop])).toEqual([
      [true, false],
      [false, true],
    ]);
  });

  it('cuts a tie at the passage edge, so no doubled note ties to a note the passage does not double (019 T105)', () => {
    const end = part(
      parse(
        generate(definition([flutePassage({ bars: { from: 3, to: 3 }, doubles: { staff: 1, pick: 'top' } })], [FLUTE])),
      ).score,
      'orch-flute',
    );
    expect(end.notes.map((x) => [x.soundingKey, x.tie.start, x.tie.stop])).toEqual([
      [72, false, false],
      [76, false, false],
    ]);
    const start = part(
      parse(
        generate(definition([flutePassage({ bars: { from: 4, to: 4 }, doubles: { staff: 1, pick: 'top' } })], [FLUTE])),
      ).score,
      'orch-flute',
    );
    expect(start.notes.map((x) => [x.soundingKey, x.tie.start, x.tie.stop])).toEqual([[76, false, false]]);
  });

  it('completes every bar of every Orchestra part with rests, so no bar is short or long', () => {
    const { score, notices } = parse(generate(BASE));
    for (const id of ['orch-flute', 'orch-strings']) {
      expect(score.parts.find((p) => p.xmlId === id)?.notes.length, id).toBeGreaterThan(0);
    }
    expect(score.measures).toHaveLength(4);
    expect(score.measures.every((m) => m.lengthTicks === m.nominalTicks)).toBe(true);
    expect(notices).not.toContain('measureLengthMismatch');
    // bars 3 and 4 are outside the flute passage: still written, as whole-bar rests
    const xml = generate(BASE);
    const fluteXml = xml.slice(xml.indexOf('<part id="orch-flute">'), xml.indexOf('<part id="orch-strings">'));
    expect(fluteXml.match(/<measure number=/g)).toHaveLength(4);
    expect(fluteXml).toContain('<rest measure="yes"/>');
  });

  it("writes <sound dynamics> at the start of each passage: its own, else the instrument's", () => {
    const def = definition([
      flutePassage({ bars: { from: 1, to: 2 } }),
      flutePassage({ bars: { from: 4, to: 4 }, dynamics: 70 }),
      stringsPassage(),
    ]);
    const { score } = parse(generate(def));
    const marks = (id: string) => part(score, id).soundDynamics.map((m) => [m.measureIndex, m.percent]);
    expect(marks('orch-flute')).toEqual([
      [0, 50],
      [3, 70],
    ]);
    expect(marks('orch-strings')).toEqual([[0, 40]]);
  });

  it('is idempotent: generating from its own output gives the same text, and an old Orchestra is replaced, not added to', () => {
    const once = generate(BASE);
    expect(generate(BASE, once)).toBe(once);
    const other = generate(definition([flutePassage({ bars: { from: 1, to: 1 } })], [FLUTE]), once);
    expect(parse(other).score.parts.map((p) => p.xmlId)).toEqual(['P1', 'orch-flute']);
  });

  it('leaves the printed part exactly as it was: cutting the Orchestra parts out gives back the source', () => {
    const source = pianoXml();
    const out = generate(BASE, source);
    expect(out).not.toBe(source);
    expect(withoutOrchestra(out)).toBe(source);
    expect(out.endsWith('</score-partwise>\n')).toBe(true);
    const printed = (text: string) => text.slice(text.indexOf('<part id="P1">'), text.indexOf('</part>') + 7);
    expect(printed(out)).toBe(printed(source));
  });

  it('bars outside the piece are an error that names them', () => {
    const def = definition([flutePassage({ bars: { from: 3, to: 9 } })], [FLUTE]);
    expect(() => generateOrchestra(pianoXml(), def)).toThrow(GenerateError);
    expect(() => generateOrchestra(pianoXml(), def)).toThrow(/outside the piece/);
  });
});

describe('checkOrchestra: rules O1-O5 (contract orchestration-definition.md section 3)', () => {
  const generated = generate(BASE);
  const rules = (xml: string, def = BASE) => checkOrchestra(xml, def).map((f) => f.rule);

  it('finds nothing in what the generator wrote', () => {
    expect(checkOrchestra(generated, BASE)).toEqual([]);
  });

  it('O1 structure: an Orchestra part with a bar missing', () => {
    const cut = generated.replace(
      /<measure number="4">(?:(?!<\/part>)[\s\S])*?<\/measure>\s*<\/part>\s*<part id="orch-strings">/,
      '</part>\n  <part id="orch-strings">',
    );
    expect(cut).not.toBe(generated);
    expect(rules(cut)).toContain('O1');
  });

  it('O2 doubling: an Orchestra note whose pitch class the piano does not sound there', () => {
    const wrong = generated.replace(
      /(<part id="orch-flute">[\s\S]*?<pitch><step>)G(<\/step><octave>5<\/octave>)/,
      '$1F$2',
    ); // the flute's first G5 becomes F5, over a C-E-G chord: F is not in it
    expect(wrong).not.toBe(generated);
    const findings = checkOrchestra(wrong, BASE).filter((f) => f.rule === 'O2');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]?.detail).toMatch(/bar 1/);
  });

  it('O3 range: a note outside its instrument range under a stricter definition', () => {
    const strict = definition(
      [flutePassage(), stringsPassage()],
      [{ ...FLUTE, range: { low: 60, high: 78 } }, STRINGS],
    );
    expect(rules(generated, strict)).toContain('O3'); // the flute's A5 and B5 are above 78
    expect(rules(generated, BASE)).not.toContain('O3');
  });

  it('O4 regeneration: a committed file that differs from a fresh generation', () => {
    const edited = generated.replace('<sound dynamics="50"/>', '<sound dynamics="51"/>');
    expect(edited).not.toBe(generated);
    expect(rules(edited)).toContain('O4');
    expect(rules(generated)).not.toContain('O4');
  });

  it('O5 hidden: an Orchestra part the app does not detect as one', () => {
    const shown = generated.replace(
      /(<part id="orch-strings">[\s\S]*?)<staff-details print-object="no" print-spacing="no"\/>/,
      '$1',
    );
    expect(shown).not.toBe(generated);
    expect(rules(shown)).toContain('O5');
  });
});

describe('pnpm library:orchestra <item-id> [--check] (contract section 2)', () => {
  let root: string;
  const itemFile = () => join(root, 'public/library/test/piece.musicxml');
  const lines: string[] = [];
  const io = () => ({ root, out: (line: string) => lines.push(line) });

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'orchestra-'));
    mkdirSync(join(root, 'public/library/test'), { recursive: true });
    mkdirSync(join(root, 'content/library/orchestra'), { recursive: true });
    writeFileSync(itemFile(), pianoXml());
    writeFileSync(join(root, 'content/library/orchestra/piece.json'), JSON.stringify(BASE));
    lines.length = 0;
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('writes the Orchestra parts into the item and says so; a second run changes nothing', () => {
    expect(main(['test/piece'], io())).toBe(0);
    const written = readFileSync(itemFile(), 'utf8');
    expect(written).toBe(generate(BASE));
    expect(main(['test/piece'], io())).toBe(0);
    expect(readFileSync(itemFile(), 'utf8')).toBe(written);
  });

  it('--check exits 0 on the committed file and writes nothing', () => {
    main(['test/piece'], io());
    const committed = readFileSync(itemFile(), 'utf8');
    expect(main(['test/piece', '--check'], io())).toBe(0);
    expect(readFileSync(itemFile(), 'utf8')).toBe(committed);
  });

  it('--check exits 1 on a differing file, names it, and writes nothing', () => {
    main(['test/piece'], io());
    const differing = readFileSync(itemFile(), 'utf8').replace('<sound dynamics="50"/>', '<sound dynamics="55"/>');
    writeFileSync(itemFile(), differing);
    lines.length = 0;
    expect(main(['test/piece', '--check'], io())).toBe(1);
    expect(lines.join('\n')).toContain('test/piece');
    expect(readFileSync(itemFile(), 'utf8')).toBe(differing);
  });

  it('--check exits 1 on an item that has no Orchestra yet', () => {
    expect(main(['test/piece', '--check'], io())).toBe(1);
    expect(readFileSync(itemFile(), 'utf8')).toBe(pianoXml());
  });

  it('an error in the definition or the generation exits 1 and writes nothing', () => {
    const bad = definition(
      [flutePassage({ octaves: [1], fitRange: false })],
      [{ ...FLUTE, range: { low: 70, high: 80 } }],
    );
    writeFileSync(join(root, 'content/library/orchestra/piece.json'), JSON.stringify(bad));
    expect(main(['test/piece'], io())).toBe(1);
    expect(readFileSync(itemFile(), 'utf8')).toBe(pianoXml());
    writeFileSync(join(root, 'content/library/orchestra/piece.json'), '{"version":1}');
    expect(main(['test/piece'], io())).toBe(1);
  });

  it('an item or a definition that does not exist exits 1; no or too many arguments exit 2', () => {
    expect(main(['test/missing'], io())).toBe(1);
    expect(main([], io())).toBe(2);
    expect(main(['a', 'b'], io())).toBe(2);
    expect(main(['test/piece', '--bogus'], io())).toBe(2);
  });
});
