import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LibraryIndex } from '../../../src/core/library/types';
import { main } from '../../../tools/library/fidelity/cli';
import { runRecord } from '../../../tools/library/fidelity/records';
import { renderReport } from '../../../tools/library/fidelity/report';
import { loadSources } from '../../../tools/library/fidelity/sources';
import { INDEX, ITEM_ID, ITEM_XML, LY, MID, record, writeFile, writeTree } from './tiny-library';

let root: string;
let lines: string[];
const report = () => join(root, 'docs/library-audit.md');
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
      'wrote docs/library-audit.md',
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

  it('with no arguments writes docs/library-audit.md, equal to renderReport', () => {
    expect(run()).toBe(0);
    const sourcesRoot = join(root, 'content/library/sources');
    const ctx = { sources: loadSources(sourcesRoot), sourcesRoot, libraryRoot: join(root, 'public/library') };
    const rec = record();
    const expected = renderReport(
      [rec],
      new Map([[ITEM_ID, runRecord(rec, ctx)]]),
      INDEX as unknown as LibraryIndex,
      ctx.sources,
    );
    expect(readFileSync(report(), 'utf8')).toBe(expected);
    expect(expected).toContain('`repertoire/test/scale`');
  });

  it('does not write the report when a check does not reproduce', () => {
    writeFile(root, `public/library/${ITEM_ID}.musicxml`, ITEM_XML.replace('<step>E</step>', '<step>F</step>'));
    expect(run()).toBe(1);
    expect(existsSync(report())).toBe(false);
    expect(lines).not.toContain('wrote docs/library-audit.md');
  });

  it('--item never writes the report', () => {
    expect(run('--item', ITEM_ID)).toBe(0);
    expect(existsSync(report())).toBe(false);
  });

  it('--check exits 0 on a fresh report, 1 on a stale or missing one, and writes nothing', () => {
    expect(run('--check')).toBe(1);
    expect(lines.at(-1)).toBe('docs/library-audit.md is missing or stale: run pnpm library:fidelity');
    expect(existsSync(report())).toBe(false);

    expect(run()).toBe(0);
    expect(run('--check')).toBe(0);
    expect(lines.at(-1)).toBe('docs/library-audit.md is up to date');

    writeFile(root, 'docs/library-audit.md', 'stale\n');
    expect(run('--check')).toBe(1);
    expect(lines.at(-1)).toBe('docs/library-audit.md is missing or stale: run pnpm library:fidelity');
    expect(readFileSync(report(), 'utf8')).toBe('stale\n');
  });

  it('--check exits 1 when a check does not reproduce, even with a fresh report', () => {
    expect(run()).toBe(0);
    writeFile(root, `public/library/${ITEM_ID}.musicxml`, ITEM_XML.replace('<step>E</step>', '<step>F</step>'));
    expect(run('--check')).toBe(1);
    expect(lines).toContain('FAIL repertoire/test/scale: verified');
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
    expect(run('--bogus')).toBe(2);
    expect(lines[0]).toMatch(/^usage:/);
  });
});
