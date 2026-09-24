import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { main } from '../../../tools/library/fidelity/cli';
import { ITEM_ID, ITEM_XML, LY, MID, record, writeFile, writeTree } from './tiny-library';

let root: string;
let lines: string[];
const run = (...args: string[]) => {
  lines = [];
  return main(args, { root, out: (line) => lines.push(line) });
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'fidelity-cli-'));
  writeTree(root, 'content/library/sources', 'public/library');
  writeFile(root, `content/library/audit/${ITEM_ID}.json`, JSON.stringify(record()));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('pnpm library:fidelity (contract fidelity-tools.md §1)', () => {
  it('with no arguments re-runs every record, one line each, and exits 0 when all reproduce', () => {
    expect(run()).toBe(0);
    expect(lines).toEqual([
      'ok   repertoire/test/scale: verified',
      '       check 1 mechanical test-1: 0 differences (expected 0); item vs notation: 0 differences; notation vs sound: 0 differences',
      '1 records, 0 failed',
    ]);
  });

  it('exits 1 and names the item, the check and the difference when a check does not reproduce', () => {
    writeFile(root, `public/library/${ITEM_ID}.musicxml`, ITEM_XML.replace('<step>E</step>', '<step>F</step>'));
    expect(run()).toBe(1);
    expect(lines).toContain('FAIL repertoire/test/scale: verified');
    expect(lines).toContain('         bar 1, beat 2: pitch F4, source E4');
    expect(lines).toContain(
      '       rule: check 1 (mechanical, test-1): re-run gives 1 differences, the record expects 0',
    );
    expect(lines.at(-1)).toBe('1 records, 1 failed');
  });

  it('--item <id> --file <path> runs that record against a scratch copy and writes nothing', () => {
    writeFile(root, 'scratch/copy.musicxml', ITEM_XML.replace('<step>D</step>', '<step>D</step><alter>1</alter>'));
    expect(run('--item', ITEM_ID, '--file', 'scratch/copy.musicxml')).toBe(1);
    expect(lines).toContain('         bar 1, beat 1: pitch D#4, source D4');
    expect(run('--item', ITEM_ID)).toBe(0);
  });

  it('--item names an unknown item', () => {
    expect(run('--item', 'repertoire/test/nothing')).toBe(1);
    expect(lines).toEqual(['no audit record for repertoire/test/nothing']);
  });

  it('fails when a committed source file changed', () => {
    writeFile(root, 'content/library/sources/test-1/scale.ly', `${LY}% edited\n`);
    expect(run()).toBe(1);
    expect(lines[0]).toMatch(/^error: source test-1: file scale\.ly does not match its recorded SHA-256/);
  });

  it('--inspect-midi lists the tracks and compares note counts with the .ly beside it', () => {
    writeFile(root, 'scratch/scale.mid', MID);
    writeFile(root, 'scratch/scale.ly', LY);
    expect(run('--inspect-midi', 'scratch/scale.mid')).toBe(0);
    expect(lines.slice(1)).toEqual([
      '  track 1: 4 notes, channel 1, ticks 0-1536',
      expect.stringMatching(/scale\.ly: \\midi score does not unfold repeats$/),
      '  notation: 4 notes and grace notes as written, 4 in played order; MIDI: 4 notes in all tracks',
      '  -> midiOrder written',
    ]);
  });

  it('prints the usage for an unknown option', () => {
    expect(run('--check')).toBe(2);
    expect(lines[0]).toMatch(/^usage:/);
  });
});
