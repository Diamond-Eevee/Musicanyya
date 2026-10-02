import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readXml } from '../../src/core/musicxml/read.js';
import { engraveFile, engraveLibrary, planLibraryEngraving } from '../../tools/library/engrave.js';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engrave-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

const BARE_EIGHTHS = `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>4</divisions><time><beats>2</beats><beat-type>4</beat-type></time></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type></note><note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type></note><note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type></note><note><pitch><step>F</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type></note></measure></part></score-partwise>`;

describe('engraveFile', () => {
  it('completes a temp copy in place', () => {
    const dir = makeTempDir();
    const file = path.join(dir, 'piece.musicxml');
    fs.writeFileSync(file, BARE_EIGHTHS);

    const result = engraveFile(file);
    expect(result.beamGroupsAdded).toBeGreaterThan(0);

    const written = fs.readFileSync(file, 'utf-8');
    expect(written).toContain('<beam number="1">begin</beam>');
    expect(written).not.toBe(BARE_EIGHTHS);
  });

  it('a second run changes nothing (idempotent)', () => {
    const dir = makeTempDir();
    const file = path.join(dir, 'piece.musicxml');
    fs.writeFileSync(file, BARE_EIGHTHS);

    engraveFile(file);
    const afterFirst = fs.readFileSync(file, 'utf-8');

    const secondResult = engraveFile(file);
    const afterSecond = fs.readFileSync(file, 'utf-8');

    expect(afterSecond).toBe(afterFirst);
    expect(secondResult.beamGroupsAdded).toBe(0);
    expect(secondResult.accidentalsAdded).toEqual({ required: 0, courtesy: 0 });
  });
});

// BARE_EIGHTHS with a never-printed Orchestra part (019 orchestra-score contract section 1) holding the same bare
// eighths plus an F-sharp that would need its accidental if it were printed.
const ORCHESTRA_PART = `<part id="orch-oboe"><measure number="1"><attributes><divisions>4</divisions><time><beats>2</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef><staff-details print-object="no" print-spacing="no"/></attributes><note><pitch><step>C</step><octave>5</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type></note><note><pitch><step>D</step><octave>5</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type></note><note><pitch><step>E</step><octave>5</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type></note><note><pitch><step>F</step><alter>1</alter><octave>5</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type></note></measure></part>`;
const WITH_ORCHESTRA = BARE_EIGHTHS.replace(
  '</part-list>',
  '<score-part id="orch-oboe"><part-name>Oboe</part-name><score-instrument id="orch-oboe-I1"><instrument-name>Oboe</instrument-name></score-instrument><midi-instrument id="orch-oboe-I1"><midi-program>69</midi-program></midi-instrument></score-part></part-list>',
).replace('</score-partwise>', `${ORCHESTRA_PART}</score-partwise>`);

describe('engraveFile with an Orchestra part (019 T107)', () => {
  it('completes the printed part only: the Orchestra part is never printed, so it is left exactly as written', () => {
    const dir = makeTempDir();
    const file = path.join(dir, 'piece.musicxml');
    fs.writeFileSync(file, WITH_ORCHESTRA);

    engraveFile(file);
    const written = fs.readFileSync(file, 'utf-8');
    const printed = written.slice(0, written.indexOf('<part id="orch-oboe">'));
    expect(printed).toContain('<beam number="1">begin</beam>');
    expect(written.slice(written.indexOf('<part id="orch-oboe">'))).toBe(`${ORCHESTRA_PART}</score-partwise>`);

    const second = engraveFile(file);
    expect(second.beamGroupsAdded).toBe(0);
    expect(second.accidentalsAdded).toEqual({ required: 0, courtesy: 0 });
  });

  it('planLibraryEngraving finds nothing to add in a file whose only gaps are in the Orchestra part', () => {
    const dir = makeTempDir();
    const file = path.join(dir, 'piece.musicxml');
    fs.writeFileSync(file, WITH_ORCHESTRA);
    engraveFile(file);
    const plan = planLibraryEngraving(readXml(fs.readFileSync(file, 'utf-8')).doc);
    expect(plan.findings).toEqual([]);
    expect(plan.inserts).toEqual([]);
  });
});

describe('engraveLibrary', () => {
  it('completes hand-written repertoire files and skips generated family files under learning/', () => {
    const root = makeTempDir();
    fs.mkdirSync(path.join(root, 'repertoire', 'beginner'), { recursive: true });
    fs.mkdirSync(path.join(root, 'learning', 'chords'), { recursive: true });

    const repertoireFile = path.join(root, 'repertoire', 'beginner', 'piece.musicxml');
    const learningFile = path.join(root, 'learning', 'chords', 'exercise.musicxml');
    fs.writeFileSync(repertoireFile, BARE_EIGHTHS);
    fs.writeFileSync(learningFile, BARE_EIGHTHS);

    const result = engraveLibrary(root);

    expect(result.engraved).toEqual(['repertoire/beginner/piece.musicxml']);
    expect(result.skipped).toEqual(['learning/chords/exercise.musicxml']);
    expect(fs.readFileSync(repertoireFile, 'utf-8')).toContain('<beam');
    expect(fs.readFileSync(learningFile, 'utf-8')).toBe(BARE_EIGHTHS); // untouched
  });
});
