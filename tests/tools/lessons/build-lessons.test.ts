// Feature 022 T023 (contract lesson-definition 1.0.0 §4, data-model §3): pnpm library:lessons writes one MusicXML file and
// one sidecar per lesson (per transposition), refuses an invalid definition before writing anything, and writes the same
// bytes every time. Fixtures: tests/fixtures/lessons/ (authored for these tests, CC0 - see its README).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { XmlElement } from '@rgrove/parse-xml';
import { afterEach, describe, expect, it } from 'vitest';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import { buildTimeline } from '../../../src/core/timeline/timeline.js';
import { buildLessons, runLessonsCommand } from '../../../tools/library/build-lessons';
import { LessonDefinitionError } from '../../../tools/library/lessons/definition';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(__dirname, '../../fixtures/lessons');
const GENERATED_ON = '2026-10-03';

// biome-ignore lint/suspicious/noExplicitAny: the tests mutate plain JSON fixtures field by field
type Doc = Record<string, any>;

const fixture = (name: string): Doc => JSON.parse(fs.readFileSync(path.join(fixtures, name), 'utf8'));

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

/** A temporary content folder holding `definitions` and an empty library folder beside it. */
function setUp(definitions: Record<string, Doc>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'musicanyya-lessons-'));
  roots.push(root);
  const contentDir = path.join(root, 'content');
  const libraryRoot = path.join(root, 'library');
  fs.mkdirSync(contentDir);
  fs.mkdirSync(libraryRoot);
  for (const [file, json] of Object.entries(definitions)) {
    fs.writeFileSync(path.join(contentDir, file), JSON.stringify(json, null, 2));
  }
  return { contentDir, libraryRoot };
}

function absoluteFilesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? absoluteFilesUnder(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

function filesUnder(dir: string): string[] {
  return absoluteFilesUnder(dir)
    .map((f) => path.relative(dir, f).split(path.sep).join('/'))
    .sort();
}

function load(xml: string) {
  const { doc } = readXml(xml);
  const { score, report } = buildScore(doc);
  const { notices } = buildTimeline(score);
  return { doc, score, report, notices };
}

const children = (el: XmlElement, name: string): XmlElement[] =>
  el.children.filter((c): c is XmlElement => (c as XmlElement).name === name);
const child = (el: XmlElement, name: string): XmlElement | undefined => children(el, name)[0];
const text = (el: XmlElement | undefined): string => (el ? el.text : '');

/** The <words> of every direction in `measure`, with the direction's placement and staff. */
function wordsIn(measure: XmlElement) {
  return children(measure, 'direction').flatMap((d) =>
    children(d, 'direction-type').flatMap((t) =>
      children(t, 'words').map((w) => ({
        words: w.text,
        italic: w.attributes['font-style'] === 'italic',
        placement: d.attributes.placement,
        staff: text(child(d, 'staff')),
      })),
    ),
  );
}

function measuresOf(xml: string): XmlElement[] {
  const root = readXml(xml).doc.root as XmlElement;
  const part = child(root, 'part') as XmlElement;
  return children(part, 'measure');
}

describe('buildLessons: the Basics fixture', () => {
  it('writes the item and its sidecar, and the file loads with no notices', async () => {
    const { contentDir, libraryRoot } = setUp({ 'basics-fixture.json': fixture('basics-fixture.json') });
    const written = await buildLessons(contentDir, libraryRoot, GENERATED_ON);
    expect(written).toEqual(['basics/fixture-lesson.musicxml']);
    expect(filesUnder(libraryRoot)).toEqual(['basics/fixture-lesson.json', 'basics/fixture-lesson.musicxml']);
    const xml = fs.readFileSync(path.join(libraryRoot, 'basics/fixture-lesson.musicxml'), 'utf8');
    const { report, notices } = load(xml);
    expect(report.entries).toEqual([]);
    expect(notices).toEqual([]);
  });

  it('prints the explanation in italics above staff 1 in the first bar', async () => {
    const { contentDir, libraryRoot } = setUp({ 'basics-fixture.json': fixture('basics-fixture.json') });
    await buildLessons(contentDir, libraryRoot, GENERATED_ON);
    const xml = fs.readFileSync(path.join(libraryRoot, 'basics/fixture-lesson.musicxml'), 'utf8');
    const [first] = measuresOf(xml);
    expect(first && wordsIn(first)).toContainEqual({
      words: 'Hold a tied note; play it once.',
      italic: true,
      placement: 'above',
      staff: '1',
    });
  });

  it('writes the pickup and the last bar implicit, numbers the pickup 0, and writes the repeat barlines', async () => {
    const { contentDir, libraryRoot } = setUp({ 'basics-fixture.json': fixture('basics-fixture.json') });
    await buildLessons(contentDir, libraryRoot, GENERATED_ON);
    const xml = fs.readFileSync(path.join(libraryRoot, 'basics/fixture-lesson.musicxml'), 'utf8');
    const measures = measuresOf(xml);
    expect(measures.map((m) => [m.attributes.number, m.attributes.implicit ?? 'no'])).toEqual([
      ['0', 'yes'],
      ['1', 'no'],
      ['2', 'no'],
      ['3', 'no'],
      ['4', 'yes'],
    ]);
    const { score } = load(xml);
    expect(score.navigation.repeats.map((r) => [r.measureIndex, r.direction])).toEqual([
      [1, 'forward'],
      [3, 'backward'],
    ]);
    expect(score.measures[0]?.lengthTicks).toBe(score.ppq);
  });

  it('writes ties, the slur and the staccato as the parser reads them, and fingers every note', async () => {
    const { contentDir, libraryRoot } = setUp({ 'basics-fixture.json': fixture('basics-fixture.json') });
    await buildLessons(contentDir, libraryRoot, GENERATED_ON);
    const xml = fs.readFileSync(path.join(libraryRoot, 'basics/fixture-lesson.musicxml'), 'utf8');
    const notes = load(xml).score.parts[0]?.notes.filter((n) => n.staff === 1) ?? [];
    expect(notes.map((n) => [n.step, n.tie.start, n.tie.stop, n.staccato])).toEqual([
      ['G', false, false, false],
      ['C', true, false, false],
      ['C', false, true, false],
      ['D', false, false, false],
      ['E', false, false, false],
      ['F', false, false, true],
      ['G', true, false, false],
      ['G', false, true, false],
      ['E', false, false, false],
      ['C', false, false, false],
      ['G', false, false, false],
      ['E', false, false, false],
      ['C', false, false, false],
    ]);
    expect(notes.map((n) => n.fingerings[0]?.finger)).toEqual([5, 1, 1, 2, 3, 4, 5, 5, 3, 1, 5, 3, 1]);
    expect(xml).toContain('<slur type="start" number="1"/>');
    expect(xml).toContain('<slur type="stop" number="1"/>');
  });

  it('writes the sidecar of data-model §3', async () => {
    const { contentDir, libraryRoot } = setUp({ 'basics-fixture.json': fixture('basics-fixture.json') });
    await buildLessons(contentDir, libraryRoot, GENERATED_ON);
    const sidecar = JSON.parse(fs.readFileSync(path.join(libraryRoot, 'basics/fixture-lesson.json'), 'utf8'));
    expect(sidecar).toEqual({
      version: 1,
      title: 'Fixture lesson',
      kind: 'exercise',
      level: 'introduction',
      tags: ['ties'],
      trains: 'A test lesson: a pickup, ties, a slur, a staccato note and repeat signs.',
      hands: 'right',
      provenance: {
        origin: 'authored',
        licence: 'CC0-1.0',
        author: 'claude-opus-5.5',
        created: GENERATED_ON,
        note: 'Generated by tools/library/build-lessons.ts from content/library/lessons/basics-fixture.json (contract lesson-definition 1.0.0); never hand-edit',
      },
      reviewedBy: 'claude-opus-5.5',
      reviewedOn: '2026-10-03',
      stepOrder: 10,
    });
  });
});

describe('buildLessons: the chord fixture', () => {
  it('writes one item per transposition with stepOrder + index', async () => {
    const { contentDir, libraryRoot } = setUp({ 'chord-fixture.json': fixture('chord-fixture.json') });
    const written = await buildLessons(contentDir, libraryRoot, GENERATED_ON);
    expect(written).toEqual([
      'learning/chord-lessons/switches/fixture-switch-in-c-major.musicxml',
      'learning/chord-lessons/switches/fixture-switch-in-g-major.musicxml',
    ]);
    const sidecar = (slug: string) =>
      JSON.parse(
        fs.readFileSync(
          path.join(libraryRoot, `learning/chord-lessons/switches/fixture-switch-in-${slug}.json`),
          'utf8',
        ),
      );
    expect([sidecar('c-major').stepOrder, sidecar('g-major').stepOrder]).toEqual([10, 11]);
    expect([sidecar('c-major').title, sidecar('g-major').title]).toEqual([
      'Fixture switch in C major',
      'Fixture switch in G major',
    ]);
  });

  it('prints every chord symbol above staff 1, transposed with the notes, and loads with no notices', async () => {
    const { contentDir, libraryRoot } = setUp({ 'chord-fixture.json': fixture('chord-fixture.json') });
    await buildLessons(contentDir, libraryRoot, GENERATED_ON);
    const symbols = (slug: string) => {
      const xml = fs.readFileSync(
        path.join(libraryRoot, `learning/chord-lessons/switches/fixture-switch-in-${slug}.musicxml`),
        'utf8',
      );
      const { report, notices } = load(xml);
      expect(report.entries).toEqual([]);
      expect(notices).toEqual([]);
      return measuresOf(xml).map((m) =>
        wordsIn(m)
          .filter((w) => !w.italic)
          .map((w) => `${w.words}|${w.placement}|${w.staff}`),
      );
    };
    expect(symbols('c-major')).toEqual([['C|above|1'], ['Cmaj7|above|1'], ['G/B|above|1'], ['C|above|1']]);
    expect(symbols('g-major')).toEqual([['G|above|1'], ['Gmaj7|above|1'], ['D/F♯|above|1'], ['G|above|1']]);
  });

  it('transposes the notes and the key signature, splitting the seventh between the hands as written', async () => {
    const { contentDir, libraryRoot } = setUp({ 'chord-fixture.json': fixture('chord-fixture.json') });
    await buildLessons(contentDir, libraryRoot, GENERATED_ON);
    const xml = fs.readFileSync(
      path.join(libraryRoot, 'learning/chord-lessons/switches/fixture-switch-in-g-major.musicxml'),
      'utf8',
    );
    const { score } = load(xml);
    const bar = (index: number, staff: number) =>
      score.parts[0]?.notes.filter((n) => n.measureIndex === index && n.staff === staff).map((n) => n.soundingKey);
    expect(bar(1, 1)).toEqual([59, 62, 66]); // B3 D4 F#4 over
    expect(bar(1, 2)).toEqual([43]); // G2: Gmaj7 split
    expect(bar(2, 2)).toEqual([42]); // F#2: D/F#
    expect(xml).toContain('<key><fifths>1</fifths><mode>major</mode></key>');
  });
});

describe('buildLessons: validation writes nothing (contract §4 step 1)', () => {
  const basics = () => fixture('basics-fixture.json');

  async function refused(definitions: Record<string, Doc>, pattern: RegExp) {
    const { contentDir, libraryRoot } = setUp(definitions);
    let error: unknown;
    try {
      await buildLessons(contentDir, libraryRoot, GENERATED_ON);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(LessonDefinitionError);
    expect((error as Error).message).toMatch(pattern);
    expect(filesUnder(libraryRoot)).toEqual([]);
  }

  it('a duplicate stepOrder in one section', async () => {
    const other = { ...basics(), id: 'basics/fixture-other', title: 'Other' };
    await refused({ 'a.json': basics(), 'b.json': other }, /stepOrder 10/);
  });

  it('a Basics lesson without scoreText', async () => {
    const d = basics();
    delete d.scoreText;
    await refused({ 'a.json': d }, /scoreText/);
  });

  it('a Basics lesson that introduces nothing and is not practice', async () => {
    const d = basics();
    d.claims = { introduces: [] };
    await refused({ 'a.json': d }, /introduces/);
  });

  it('a section that is not the id without its last segment', async () => {
    const d = basics();
    d.section = 'learning/chord-lessons/switches';
    await refused({ 'a.json': d }, /section/);
  });

  it('a simplifies target that does not exist, or is not of a higher level', async () => {
    const missing = { ...basics(), simplifies: 'basics/nothing', departures: ['Fewer notes.'] };
    await refused({ 'a.json': missing }, /simplifies basics\/nothing/);
    const full = { ...basics(), id: 'basics/full', title: 'Full', stepOrder: 20 };
    const notLower = { ...basics(), simplifies: 'basics/full', departures: ['Fewer notes.'] };
    await refused({ 'a.json': notLower, 'b.json': full }, /simplifies basics\/full.*higher level/);
  });

  it('a bad token, naming the file, the bar and the token', async () => {
    const d = basics();
    d.bars[2].rh = 'E4:q)@3 F4:z G4:h~';
    await refused({ 'bad.json': d }, /bad\.json.*bar 2.*"F4:z"/);
  });

  it('runLessonsCommand exits 1 on an invalid definition and 0 on valid ones', async () => {
    const d = basics();
    delete d.scoreText;
    const bad = setUp({ 'a.json': d });
    const failed = await runLessonsCommand({ ...bad, generatedOn: GENERATED_ON });
    expect(failed.code).toBe(1);
    expect(filesUnder(bad.libraryRoot)).toEqual([]);
    const good = setUp({ 'a.json': basics() });
    expect((await runLessonsCommand({ ...good, generatedOn: GENERATED_ON })).code).toBe(0);
  });

  it('accepts a practice lesson that introduces nothing new', async () => {
    const d = basics();
    d.claims = { introduces: [], practice: true };
    const { contentDir, libraryRoot } = setUp({ 'a.json': d });
    expect(await buildLessons(contentDir, libraryRoot, GENERATED_ON)).toEqual(['basics/fixture-lesson.musicxml']);
  });
});

describe('buildLessons: the output is byte-stable', () => {
  it('a second run writes the same bytes, and they match the golden', async () => {
    const definitions = {
      'basics-fixture.json': fixture('basics-fixture.json'),
      'chord-fixture.json': fixture('chord-fixture.json'),
    };
    const first = setUp(definitions);
    await buildLessons(first.contentDir, first.libraryRoot, GENERATED_ON);
    const second = setUp(definitions);
    await buildLessons(second.contentDir, second.libraryRoot, GENERATED_ON);
    const files = filesUnder(first.libraryRoot);
    expect(filesUnder(second.libraryRoot)).toEqual(files);
    const contents = Object.fromEntries(
      files.map((f) => [f, fs.readFileSync(path.join(first.libraryRoot, f), 'utf8')] as const),
    );
    for (const f of files) expect(fs.readFileSync(path.join(second.libraryRoot, f), 'utf8'), f).toBe(contents[f]);
    expect(contents).toMatchSnapshot();
  });

  it('--lesson builds one item only', async () => {
    const { contentDir, libraryRoot } = setUp({
      'basics-fixture.json': fixture('basics-fixture.json'),
      'chord-fixture.json': fixture('chord-fixture.json'),
    });
    const written = await buildLessons(contentDir, libraryRoot, GENERATED_ON, 'basics/fixture-lesson');
    expect(written).toEqual(['basics/fixture-lesson.musicxml']);
  });
});
