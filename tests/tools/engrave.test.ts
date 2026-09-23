import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { engraveFile, engraveLibrary } from '../../tools/library/engrave.js';

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
