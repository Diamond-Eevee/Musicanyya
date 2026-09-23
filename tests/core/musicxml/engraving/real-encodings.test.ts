/**
 * T052: encodings that professionally engraved MusicXML (MuseScore / OpenScore exports) uses and that engraving
 * completion must read as correct - found by running completion over tests/fixtures/musicxml/real (pre-merge
 * review, 2026-09-23). Each case is the smallest score that reproduces one real bar.
 */
import { describe, expect, it } from 'vitest';
import { planEngraving } from '../../../../src/core/musicxml/engraving/plan.js';
import { readXml } from '../../../../src/core/musicxml/read.js';

/** A one-part score; `measures` are the inner XML of each `<measure>`, divisions 2 (eighth = 1). */
function score(measures: string[]): string {
  const body = measures.map((m, i) => `<measure number="${i + 1}">${m}</measure>`).join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0">' +
    '<part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>' +
    `<part id="P1">${body}</part></score-partwise>`
  );
}

const ATTRS = (fifths: number) =>
  `<attributes><divisions>2</divisions><key><fifths>${fifths}</fifths></key>` +
  '<time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>';

function note(step: string, octave: number, opts: { alter?: number; type?: string; extra?: string } = {}): string {
  const type = opts.type ?? 'quarter';
  const duration = { eighth: 1, quarter: 2, half: 4, whole: 8 }[type] ?? 2;
  const alter = opts.alter !== undefined ? `<alter>${opts.alter}</alter>` : '';
  return (
    `<note><pitch><step>${step}</step>${alter}<octave>${octave}</octave></pitch>` +
    `<duration>${duration}</duration><voice>1</voice><type>${type}</type>${opts.extra ?? ''}</note>`
  );
}

const plan = (xml: string) => planEngraving(readXml(xml).doc, 'opened');

describe('T052 beams: a beam may cross a barline (R-2 B12)', () => {
  const eighths = (from: number, beams: (string | null)[]) =>
    beams
      .map((b, i) =>
        note(['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'][(from + i) % 8] ?? 'C', 4, {
          type: 'eighth',
          extra: b ? `<beam number="1">${b}</beam>` : '',
        }),
      )
      .join('');

  it('begin on the last eighth of a bar, end on the first of the next (Grosse Fuge m145-146) is valid', () => {
    const xml = score([
      ATTRS(0) + eighths(0, [null, 'begin', 'end', 'begin', 'end', 'begin', 'end', 'begin']),
      eighths(0, ['end', 'begin', 'end', 'begin', 'end', 'begin', 'end', null]),
    ]);
    const result = plan(xml);
    expect(result.invalidBeams).toEqual([]);
    expect(result.inserts).toEqual([]);
  });

  it('a begin that is never closed is still invalid, reported where the run began', () => {
    const xml = score([
      ATTRS(0) + eighths(0, ['begin', 'continue']) + note('E', 4, { type: 'half' }),
      note('C', 4, { type: 'whole' }),
    ]);
    expect(plan(xml).invalidBeams).toEqual([{ part: 0, measureLabel: '1', voice: '1' }]);
  });

  it('an unbeamed note inside an open run is invalid', () => {
    const xml = score([ATTRS(0) + eighths(0, ['begin', null, 'end', null]) + note('C', 5, { type: 'half' })]);
    expect(plan(xml).invalidBeams).toEqual([{ part: 0, measureLabel: '1', voice: '1' }]);
  });

  it('a continue or end with nothing open is invalid', () => {
    const xml = score([ATTRS(0) + eighths(0, ['end', null, null, null]) + note('C', 5, { type: 'half' })]);
    expect(plan(xml).invalidBeams).toEqual([{ part: 0, measureLabel: '1', voice: '1' }]);
  });
});

describe('T052 accidentals: a printed sign on a tied-over note sets the bar state (R-3 A4)', () => {
  it('Mozart K.387 m129: E-flat tied in with its flat printed, a later E-flat in the bar needs nothing', () => {
    const xml = score([
      ATTRS(1) + note('E', 4, { alter: -1, type: 'whole', extra: '<accidental>flat</accidental><tie type="start"/>' }),
      note('E', 4, { alter: -1, extra: '<accidental>flat</accidental><tie type="stop"/>' }) +
        note('D', 4) +
        note('E', 4, { alter: -1 }) +
        note('D', 4),
    ]);
    const result = plan(xml);
    expect(result.accidentalsAdded).toEqual({ required: 0, courtesy: 0 });
  });

  it('a tied-over note printing no sign still leaves the bar state alone (R-3 A3): the later note needs one', () => {
    const xml = score([
      ATTRS(0) + note('F', 4, { alter: 1, type: 'whole', extra: '<accidental>sharp</accidental><tie type="start"/>' }),
      note('F', 4, { alter: 1, extra: '<tie type="stop"/>' }) +
        note('G', 4) +
        note('F', 4, { alter: 1 }) +
        note('G', 4),
    ]);
    expect(plan(xml).accidentalsAdded.required).toBe(1);
  });
});

describe('T052 accidentals: under an octave shift the bar state follows the printed line (R-3 A1, A6)', () => {
  const shift = (type: string) =>
    `<direction><direction-type><octave-shift type="${type}" size="8" number="1"/></direction-type></direction>`;

  it('Bridge m6: E-flat6 printed with a flat under 8va, then E-flat5 on the same line after the 8va', () => {
    const xml = score([
      ATTRS(0) +
        shift('down') +
        note('E', 6, { alter: -1, extra: '<accidental>flat</accidental>' }) +
        note('C', 6) +
        shift('stop') +
        note('E', 5, { alter: -1 }) +
        note('C', 5),
    ]);
    expect(plan(xml).accidentalsAdded.required).toBe(0);
  });

  it('without the octave shift the same notes are on different lines and E-flat5 needs its flat', () => {
    const xml = score([
      ATTRS(0) +
        note('E', 6, { alter: -1, extra: '<accidental>flat</accidental>' }) +
        note('C', 6) +
        note('E', 5, { alter: -1 }) +
        note('C', 5),
    ]);
    expect(plan(xml).accidentalsAdded.required).toBe(1);
  });

  it('the shift stays in force across a barline until its stop', () => {
    const xml = score([
      ATTRS(0) + shift('down') + note('C', 6, { type: 'whole' }),
      note('E', 6, { alter: -1, extra: '<accidental>flat</accidental>' }) +
        note('C', 6) +
        shift('stop') +
        note('E', 5, { alter: -1 }) +
        note('C', 5),
    ]);
    expect(plan(xml).accidentalsAdded.required).toBe(0);
  });
});

describe('T052 key: a <key> after <print> or a left barline is the key of the whole bar (R-3 A2)', () => {
  it('Mozart K.387 m94: <print>, <barline location="left">, then <attributes><key> -2: B-flat needs no sign', () => {
    const xml = score([
      ATTRS(1) + note('G', 4, { type: 'whole' }),
      '<print new-page="yes"/><barline location="left"><bar-style>heavy-light</bar-style></barline>' +
        '<attributes><key><fifths>-2</fifths></key></attributes>' +
        note('G', 4) +
        note('B', 4, { alter: -1 }) +
        note('A', 4) +
        note('B', 4, { alter: -1 }),
    ]);
    expect(plan(xml).accidentalsAdded).toEqual({ required: 0, courtesy: 0 });
  });

  it('bar 1 with <print> before its first <attributes>: the key applies (Faure, Wolf, Stanford)', () => {
    const xml = score([
      '<print/>' + ATTRS(2) + note('F', 4, { alter: 1 }) + note('C', 5, { alter: 1 }) + note('D', 5, { type: 'half' }),
    ]);
    expect(plan(xml).accidentalsAdded.required).toBe(0);
  });

  it('a key change after notes (onset > 0) is still a mid-bar change', () => {
    const xml = score([
      ATTRS(0) +
        note('B', 4, { type: 'half' }) +
        '<attributes><key><fifths>-1</fifths></key></attributes>' +
        note('B', 4, { alter: -1, type: 'half' }),
    ]);
    expect(plan(xml).accidentalsAdded.required).toBe(0);
  });
});

describe('T052 refinements from the music-domain-expert review', () => {
  it('a tie written only as <tied type="stop"> is a tie continuation (R-3 A3)', () => {
    const xml = score([
      ATTRS(0) +
        note('F', 4, {
          alter: 1,
          type: 'whole',
          extra: '<accidental>sharp</accidental><notations><tied type="start"/></notations>',
        }),
      note('F', 4, { alter: 1, extra: '<notations><tied type="stop"/></notations>' }) +
        note('G', 4, { type: 'half' }) +
        note('G', 4),
    ]);
    expect(plan(xml).accidentalsAdded.required).toBe(0);
  });

  it('a hidden playback note (print-object="no") gets no sign and sets no state', () => {
    const hidden = note('F', 4, { alter: 1 }).replace('<note>', '<note print-object="no">');
    const xml = score([ATTRS(0) + hidden + note('F', 4, { alter: 1 }) + note('G', 4, { type: 'half' })]);
    const result = plan(xml);
    expect(result.accidentalsAdded.required).toBe(1);
    expect(result.findings.filter((f) => f.kind === 'missingAccidental')).toHaveLength(1);
  });

  it('under a non-traditional key (<key-step>/<key-alter>) no required sign is added', () => {
    const attrs = ATTRS(0).replace(
      '<key><fifths>0</fifths></key>',
      '<key><key-step>F</key-step><key-alter>1</key-alter><key-step>B</key-step><key-alter>-1</key-alter></key>',
    );
    const xml = score([
      attrs + note('F', 4, { alter: 1 }) + note('B', 4, { alter: -1 }) + note('C', 5, { type: 'half' }),
    ]);
    expect(plan(xml).accidentalsAdded.required).toBe(0);
  });

  it('beams written on a chord member instead of the head count as encoded and valid', () => {
    const chordEighth = (step: string, b: string) =>
      note(step, 4, { type: 'eighth' }) +
      note('G', 4, { type: 'eighth', extra: `<beam number="1">${b}</beam>` }).replace('<note>', '<note><chord/>');
    const xml = score([
      ATTRS(0) + chordEighth('C', 'begin') + chordEighth('D', 'end') + note('E', 4, { type: 'half' }) + note('F', 4),
    ]);
    const result = plan(xml);
    expect(result.invalidBeams).toEqual([]);
    expect(result.beamGroupsAdded).toBe(0);
  });

  it('a secondary beam still open when the primary beam ends is invalid', () => {
    const sixteenth = (step: string, beams: string) =>
      `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice>` +
      `<type>16th</type>${beams}</note>`;
    const xml = score([
      '<attributes><divisions>4</divisions><key><fifths>0</fifths></key>' +
        '<time><beats>1</beats><beat-type>4</beat-type></time></attributes>' +
        sixteenth('C', '<beam number="1">begin</beam><beam number="2">begin</beam>') +
        sixteenth('D', '<beam number="1">continue</beam><beam number="2">continue</beam>') +
        sixteenth('E', '<beam number="1">continue</beam><beam number="2">continue</beam>') +
        sixteenth('F', '<beam number="1">end</beam>'),
    ]);
    expect(plan(xml).invalidBeams).toEqual([{ part: 0, measureLabel: '1', voice: '1' }]);
  });
});

describe('T052 beams: a sung line without beams keeps its flags (R-2 B13)', () => {
  const sung = (step: string, syllable: string) =>
    note(step, 4, {
      type: 'eighth',
      extra: `<lyric number="1"><syllabic>single</syllabic><text>${syllable}</text></lyric>`,
    });

  it('Stanford Soprano / Chopin song: eighths with lyrics and no <beam> anywhere get no beams added', () => {
    const xml = score([
      ATTRS(0) +
        sung('C', 'Sail') +
        sung('D', 'ing') +
        sung('E', 'at') +
        sung('F', 'dawn') +
        note('G', 4, { type: 'half' }),
    ]);
    const result = plan(xml);
    expect(result.beamGroupsAdded).toBe(0);
    expect(result.inserts).toEqual([]);
  });

  it('the same eighths without lyrics are still beamed', () => {
    const xml = score([
      ATTRS(0) +
        note('C', 4, { type: 'eighth' }) +
        note('D', 4, { type: 'eighth' }) +
        note('E', 4, { type: 'eighth' }) +
        note('F', 4, { type: 'eighth' }) +
        note('G', 4, { type: 'half' }),
    ]);
    expect(plan(xml).beamGroupsAdded).toBe(1);
  });
});
