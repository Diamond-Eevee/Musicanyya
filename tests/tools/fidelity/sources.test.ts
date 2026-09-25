import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadSources, SourceError } from '../../../tools/library/fidelity/sources';

const LY = "\\relative c' { c4 d e f | }\n";
const MID = new Uint8Array([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 1, 0x80]);
const sha = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');

function manifest(id: string, patch: Record<string, unknown> = {}, filePatch: Record<string, unknown>[] = [{}, {}]) {
  return {
    version: 1,
    id,
    work: 'Own work, Test piece',
    edition: 'unknown',
    publisher: 'Test',
    url: 'https://example.org/piece/1',
    licence: 'public-domain',
    obtained: '2026-09-24',
    approvedByOwner: '2026-09-24',
    files: [
      {
        role: 'notation',
        path: 'piece.ly',
        url: 'https://example.org/piece.ly',
        sha256: sha(LY),
        format: 'lilypond',
        ...filePatch[0],
      },
      {
        role: 'sound',
        path: 'piece.mid',
        url: 'https://example.org/piece.mid',
        sha256: sha(MID),
        format: 'midi',
        midiOrder: 'written',
        midiNoteTracks: [1, 2],
        midiArticulate: false,
        ...filePatch[1],
      },
    ],
    ...patch,
  };
}

let root: string;
function source(folder: string, json: unknown): void {
  mkdirSync(join(root, folder), { recursive: true });
  writeFileSync(join(root, folder, 'piece.ly'), LY);
  writeFileSync(join(root, folder, 'piece.mid'), MID);
  writeFileSync(join(root, folder, 'source.json'), JSON.stringify(json));
}
const load = () => loadSources(root);
const failsWith = (pattern: RegExp) => {
  expect(load).toThrow(SourceError);
  expect(load).toThrow(pattern);
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'sources-'));
  writeFileSync(join(root, 'README.md'), '# Sources\n');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('loadSources (contract source-manifest.md)', () => {
  it('loads a valid manifest and re-hashes its files', () => {
    source('test-1', manifest('test-1'));
    const sources = load();
    expect([...sources.keys()]).toEqual(['test-1']);
    expect(sources.get('test-1')?.files.map((f) => f.role)).toEqual(['notation', 'sound']);
  });

  it('accepts CC0 and an uncommitted scan recorded by URL only', () => {
    source('test-1', manifest('test-1', { licence: 'CC0-1.0' }));
    const m = manifest('test-2');
    m.files.push({ role: 'scan', url: 'https://example.org/scan.pdf', format: 'pdf' } as never);
    source('test-2', m);
    expect([...load().keys()]).toEqual(['test-1', 'test-2']);
  });

  it('fails a Creative Commons BY-SA licence (Mutopia 659)', () => {
    source('test-1', manifest('test-1', { licence: 'CC BY-SA 2.5' }));
    failsWith(/test-1.*licence "CC BY-SA 2\.5".*public-domain or CC0-1\.0/);
  });

  it('fails a file whose content changed since its hash was recorded', () => {
    source('test-1', manifest('test-1'));
    writeFileSync(join(root, 'test-1', 'piece.ly'), `${LY}% changed\n`);
    failsWith(/test-1.*piece\.ly.*SHA-256/);
  });

  it.each(['midiOrder', 'midiNoteTracks', 'midiArticulate'])('fails a sound file without %s', (field) => {
    source('test-1', manifest('test-1', {}, [{}, { [field]: undefined }]));
    failsWith(new RegExp(`test-1.*sound file piece\\.mid.*${field}`));
  });

  it('fails a manifest without approvedByOwner', () => {
    source('test-1', manifest('test-1', { approvedByOwner: undefined }));
    failsWith(/test-1.*approvedByOwner/);
  });

  it('fails a folder whose name is not the manifest id', () => {
    source('test-1', manifest('test-2'));
    failsWith(/folder "test-1".*id "test-2"/);
  });

  it('fails an unknown field, a missing file, a committed scan and a file path outside the folder', () => {
    source('test-1', manifest('test-1', { note: 'x' }));
    failsWith(/test-1.*unknown field "note"/);
    rmSync(join(root, 'test-1'), { recursive: true });

    source('test-1', manifest('test-1', {}, [{ path: 'missing.ly' }, {}]));
    failsWith(/test-1.*missing\.ly.*not found/);
    rmSync(join(root, 'test-1'), { recursive: true });

    source('test-1', manifest('test-1', {}, [{}, { role: 'scan', format: 'pdf' }]));
    failsWith(/test-1.*scan.*not committed/);
    rmSync(join(root, 'test-1'), { recursive: true });

    source('test-1', manifest('test-1', {}, [{ path: '../piece.ly' }, {}]));
    failsWith(/test-1.*\.\.\/piece\.ly.*inside the source folder/);
  });

  it('accepts the number of the \\score to read in a LilyPond file with one \\score per movement (1.1.0)', () => {
    source('test-1', manifest('test-1', {}, [{ score: 2 }, {}]));
    expect(load().get('test-1')?.files[0]?.score).toBe(2);
  });

  it('fails a score number on a non-LilyPond file, or one that is not a positive integer', () => {
    source('test-1', manifest('test-1', {}, [{}, { score: 1 }]));
    failsWith(/test-1.*score.*LilyPond notation file/);
    rmSync(join(root, 'test-1'), { recursive: true });
    source('test-1', manifest('test-1', {}, [{ score: 0 }, {}]));
    failsWith(/test-1.*score.*positive integer/);
  });

  it('accepts a file extracted from a published archive: the archive hash and member name are recorded (1.1.0)', () => {
    const archive = { sha256: 'a'.repeat(64), member: 'piece-1.mid' };
    source('test-1', manifest('test-1', {}, [{}, { url: 'https://example.org/piece-mids.zip', archive }]));
    expect(load().get('test-1')?.files[1]?.archive).toEqual(archive);
  });

  it('fails an archive record without its hash or member name', () => {
    source('test-1', manifest('test-1', {}, [{}, { archive: { member: 'piece-1.mid' } }]));
    failsWith(/test-1.*archive.*sha256/);
    rmSync(join(root, 'test-1'), { recursive: true });
    source('test-1', manifest('test-1', {}, [{}, { archive: { sha256: 'a'.repeat(64) } }]));
    failsWith(/test-1.*archive.*member/);
  });

  it('fails a folder without source.json', () => {
    mkdirSync(join(root, 'test-1'));
    failsWith(/test-1.*source\.json/);
  });
});
