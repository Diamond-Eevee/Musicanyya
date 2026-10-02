import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import { compileSchedule, EVENT_KIND } from '../../../src/core/schedule/compile.js';
import { buildTimeline } from '../../../src/core/timeline/timeline.js';
import { decodeXml } from '../../../src/engine/files/decode.js';

// Feature 019, contracts/orchestra-score.md sections 1, 2 and 7: how a file says "this part sounds but is not printed",
// and what the parser makes of it. The fixtures are in tests/fixtures/musicxml/orchestra/ (see its README).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, '../../fixtures/musicxml/orchestra');

function parse(xml: string) {
  return buildScore(readXml(xml).doc);
}
function load(name: string) {
  return parse(decodeXml(fs.readFileSync(path.join(dir, `${name}.musicxml`))));
}

const codes = (report: { entries: { code: string }[] }, code: string) => report.entries.filter((e) => e.code === code);

describe('Orchestra parts (a part whose every staff is hidden from its first measure)', () => {
  it.each([
    ['piano-and-oboe', 1],
    ['piano-and-two-staff-orchestra', 1],
    ['orchestra-first', 0],
  ])(
    '%s: the hidden part is an Orchestra part, its notes are not printed, the piano is untouched',
    (name, orchestraIndex) => {
      const { score, report } = load(name);
      expect(score.parts).toHaveLength(2);
      score.parts.forEach((part, index) => {
        const isOrchestra = index === orchestraIndex;
        expect(part.orchestra, `${name} part ${index}`).toBe(isOrchestra);
        expect(part.notes.length).toBeGreaterThan(0);
        for (const note of part.notes) expect(note.printed, `${name} part ${index} ${note.id}`).toBe(!isOrchestra);
      });
      expect(codes(report, 'hiddenStaffIgnored')).toEqual([]);
      expect(codes(report, 'orchestraInstrumentMissing')).toEqual([]);
    },
  );

  it('a two-staff Orchestra part keeps the staff of each of its notes', () => {
    const { score } = load('piano-and-two-staff-orchestra');
    const harp = score.parts[1];
    expect(harp?.staves).toBe(2);
    expect(new Set(harp?.notes.map((n) => n.staff))).toEqual(new Set([1, 2]));
  });

  it('a <staff-details> without a number means staff 1: it hides a one-staff part, and only staff 1 of a two-staff part', () => {
    const { score } = load('piano-and-oboe');
    expect(score.parts[1]?.orchestra).toBe(true); // the fixture's staff-details has no `number` and the oboe has one staff

    const unnumbered = readFixtureText('piano-and-two-staff-orchestra').replace(
      /<staff-details number="1" print-object="no" print-spacing="no"\/><staff-details number="2" print-object="no" print-spacing="no"\/>/,
      '<staff-details print-object="no" print-spacing="no"/>',
    );
    const { score: partly, report } = parse(unnumbered);
    expect(partly.parts[1]?.orchestra).toBe(false); // staff 2 is still shown
    expect(codes(report, 'hiddenStaffIgnored')).toHaveLength(1);
  });

  it('every printed Note ID equals the twin without the Orchestra part', () => {
    for (const name of ['piano-and-oboe', 'piano-and-two-staff-orchestra', 'orchestra-same-program']) {
      const { score } = load(name);
      const { score: twin } = load(`${name}-twin`);
      const printed = score.parts.flatMap((p) => p.notes).filter((n) => n.printed);
      expect(printed.map((n) => n.id).sort(), name).toEqual(
        twin.parts
          .flatMap((p) => p.notes)
          .map((n) => n.id)
          .sort(),
      );
      expect(twin.parts, name).toHaveLength(1);
    }
  });

  it('with the Orchestra part first the piano has part index 1, so its Note IDs equal the twin only with the index mapped', () => {
    const { score } = load('orchestra-first');
    const { score: twin } = load('orchestra-first-twin');
    const piano = score.parts[1]?.notes ?? [];
    expect(piano.length).toBeGreaterThan(0);
    expect(piano.every((n) => n.id.startsWith('n-p1-'))).toBe(true);
    const mapped = piano.map((n) => n.id.replace(/^n-p1-/, 'n-p0-')).sort();
    expect(mapped).toEqual((twin.parts[0]?.notes ?? []).map((n) => n.id).sort());
  });

  it('the measures of the file come out the same with the Orchestra part first (measure info is taken from the first part)', () => {
    const { score } = load('orchestra-first');
    const { score: twin } = load('orchestra-first-twin');
    expect(score.measures.map((m) => [m.startTick, m.lengthTicks])).toEqual(
      twin.measures.map((m) => [m.startTick, m.lengthTicks]),
    );
    expect(score.tempoMarks.map((t) => [t.qpmNum, t.qpmDen])).toEqual(twin.tempoMarks.map((t) => [t.qpmNum, t.qpmDen]));
  });
});

describe('hidden staves that are not an Orchestra part (graceful degrade, Constitution III)', () => {
  it.each([
    ['partly-hidden', 'only one of its two staves is hidden'],
    ['hidden-later', 'the staff is hidden from bar 2, not from the first measure'],
    ['shown-again', 'the staff is hidden and shown again later'],
  ])('%s (%s): the part is printed and one hiddenStaffIgnored warning names it', (name) => {
    const { score, report } = load(name);
    expect(score.parts.map((p) => p.orchestra)).toEqual([false, false]);
    for (const note of score.parts.flatMap((p) => p.notes)) expect(note.printed).toBe(true);
    const warnings = codes(report, 'hiddenStaffIgnored');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.severity).toBe('warning');
    expect(warnings[0]?.element).toBe(score.parts[1]?.name);
  });

  it('a Score whose parts are all hidden prints every part, with one warning per part', () => {
    const { score, report } = load('all-hidden');
    expect(score.parts.map((p) => p.orchestra)).toEqual([false, false]);
    for (const note of score.parts.flatMap((p) => p.notes)) expect(note.printed).toBe(true);
    const warnings = codes(report, 'hiddenStaffIgnored');
    expect(warnings.map((w) => w.element).sort()).toEqual(score.parts.map((p) => p.name).sort());
  });

  // Found by the real-score e2e (stanford-sailing-at-dawn): MuseScore writes `<staff-details print-object="no"/>` (no
  // print-spacing) for the measures where a printed staff is empty - that is not an Orchestra part and must not be cut out
  it('print-object="no" without print-spacing="no" (hide empty staves, a cutaway) is an ordinary printed part, with no warning', () => {
    const xml = readFixtureText('piano-and-oboe').replace(
      '<staff-details print-object="no" print-spacing="no"/>',
      '<staff-details print-object="no"/>',
    );
    expect(xml).not.toContain('print-spacing');
    const { score, report } = parse(xml);
    expect(score.parts.map((p) => p.orchestra)).toEqual([false, false]);
    expect(score.parts.flatMap((p) => p.notes).every((n) => n.printed)).toBe(true);
    expect(codes(report, 'hiddenStaffIgnored')).toEqual([]);
  });

  it('a Score with no hidden staff reports nothing', () => {
    const { score, report } = load('piano-and-oboe-twin');
    expect(score.parts.every((p) => !p.orchestra)).toBe(true);
    expect(codes(report, 'hiddenStaffIgnored')).toEqual([]);
  });
});

describe('an Orchestra instrument without a usable <midi-program>', () => {
  it('is reported once, never falls back to piano, and nothing of it sounds', () => {
    const { score, report } = load('orchestra-no-program');
    expect(score.parts[1]?.orchestra).toBe(true);
    const missing = codes(report, 'orchestraInstrumentMissing');
    expect(missing).toHaveLength(1);
    expect(missing[0]?.severity).toBe('warning');
    expect(missing[0]?.element).toBe(score.parts[1]?.name);
    expect(codes(report, 'instrumentFallback')).toEqual([]); // the Orchestra's own warning replaces the generic one

    // the compiled schedule holds the piano's notes and not one note of the Orchestra part
    const schedule = compileSchedule(buildTimeline(score).timeline);
    const twinSchedule = compileSchedule(buildTimeline(load('orchestra-no-program-twin').score).timeline);
    const noteOnChannels = (s: typeof schedule) => {
      const found = new Set<number>();
      for (let i = 0; i < s.eventKind.length; i++) {
        if (s.eventKind[i] === EVENT_KIND.noteOn) found.add(s.eventChannel[i] as number);
      }
      return [...found];
    };
    expect(noteOnChannels(schedule)).toEqual(noteOnChannels(twinSchedule));
    const noteOns = (s: typeof schedule) => [...s.eventKind].filter((k) => k === EVENT_KIND.noteOn).length;
    expect(noteOns(schedule)).toBe(noteOns(twinSchedule));
  });

  it('an Orchestra part with a program raises neither warning', () => {
    const { report } = load('piano-and-oboe');
    expect(codes(report, 'orchestraInstrumentMissing')).toEqual([]);
    expect(codes(report, 'instrumentFallback')).toEqual([]);
  });
});

function readFixtureText(name: string): string {
  return decodeXml(fs.readFileSync(path.join(dir, `${name}.musicxml`)));
}
