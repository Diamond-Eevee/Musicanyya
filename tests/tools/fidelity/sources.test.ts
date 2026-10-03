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

  // 1.3.0 (019 FR-025): CC BY-SA is admitted as an SPDX id; a licence written any other way is still refused.
  it('fails a licence that is not one of the listed SPDX ids (Mutopia 659 as its page writes it)', () => {
    source('test-1', manifest('test-1', { licence: 'CC BY-SA 2.5' }));
    failsWith(/test-1.*licence "CC BY-SA 2\.5" is not allowed/);
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

// Feature 019 (source-manifest 1.2.0): our own CC0 reading of a public-domain print is a source too
describe('loadSources: origin "transcription" (feature 019)', () => {
  /** A transcription: the LilyPond we wrote, and the print it reads recorded by URL only. */
  function transcription(id: string, patch: Record<string, unknown> = {}) {
    return {
      version: 1,
      id,
      work: 'Own transcription of a printed piece',
      edition: 'G. Schirmer, 1899',
      publisher: 'G. Schirmer',
      url: 'https://archive.org/download/example/example.pdf',
      licence: 'CC0-1.0',
      origin: 'transcription',
      obtained: '2026-10-01',
      approvedByOwner: '2026-10-01',
      files: [
        {
          role: 'notation',
          path: 'piece.ly',
          url: 'https://archive.org/download/example/example.pdf',
          sha256: sha(LY),
          format: 'lilypond',
        },
        { role: 'scan', url: 'https://archive.org/download/example/example.pdf', format: 'pdf' },
      ],
      ...patch,
    };
  }
  const write = (folder: string, json: unknown) => {
    mkdirSync(join(root, folder), { recursive: true });
    writeFileSync(join(root, folder, 'piece.ly'), LY);
    writeFileSync(join(root, folder, 'source.json'), JSON.stringify(json));
  };

  it('a transcription under CC0-1.0 with a notation file and the print by URL validates, and keeps its origin', () => {
    write('own-1', transcription('own-1'));
    expect(load().get('own-1')?.origin).toBe('transcription');
  });

  it('origin "downloaded", or none at all, is a manifest as before', () => {
    write('own-1', transcription('own-1', { origin: 'downloaded', licence: 'public-domain' }));
    write('own-2', transcription('own-2', { origin: undefined, licence: 'public-domain' }));
    const sources = load();
    expect(sources.get('own-1')?.origin).toBe('downloaded');
    expect(sources.get('own-2')?.origin).toBeUndefined();
  });

  it('an unknown origin fails', () => {
    write('own-1', transcription('own-1', { origin: 'scribbled' }));
    failsWith(/origin/);
  });

  it('a transcription is our own CC0 work: another licence fails', () => {
    write('own-1', transcription('own-1', { licence: 'public-domain' }));
    failsWith(/transcription.*CC0/);
  });
});

// Feature 019 FR-025, source-manifest 1.3.0 (research R-19).
describe('loadSources: attribution licences (source-manifest 1.3.0)', () => {
  it('accepts CC BY-SA 3.0 with a credit, and keeps the credit', () => {
    source('test-1', manifest('test-1', { licence: 'CC-BY-SA-3.0', credit: 'Typeset by A. Person' }));
    expect(load().get('test-1')?.licence).toBe('CC-BY-SA-3.0');
  });

  it('fails CC BY 4.0 without a credit, naming the field; the same manifest with one loads', () => {
    source('test-1', manifest('test-1', { licence: 'CC-BY-4.0', credit: 'A. Person' }));
    expect(() => load()).not.toThrow();
    source('test-1', manifest('test-1', { licence: 'CC-BY-4.0' }));
    failsWith(/test-1.*credit/);
  });

  it('fails a NonCommercial licence even with a credit, where CC BY 4.0 loads', () => {
    source('test-1', manifest('test-1', { licence: 'CC-BY-4.0', credit: 'A. Person' }));
    expect(() => load()).not.toThrow();
    source('test-1', manifest('test-1', { licence: 'CC-BY-NC-4.0', credit: 'A. Person' }));
    failsWith(/test-1.*licence "CC-BY-NC-4\.0" is not allowed/);
  });
});

// Feature 022 (source-manifest 1.4.0, FR-034): whether a multi-part version exists, for a later Orchestra.
describe('loadSources: multiPart (source-manifest 1.4.0)', () => {
  const multiPart = {
    available: true,
    where: 'https://example.org/piece/1',
    licence: 'public-domain',
    note: 'SATB, tune in the Soprano',
  };

  it('accepts a multiPart record, and one that says no version exists', () => {
    source('test-1', manifest('test-1', { multiPart }));
    expect(load().get('test-1')?.multiPart).toEqual(multiPart);
    source('test-2', manifest('test-2', { multiPart: { available: false } }));
    expect(load().get('test-2')?.multiPart).toEqual({ available: false });
  });

  it('fails a malformed multiPart: no available, an unknown field, a bad url', () => {
    source('test-1', manifest('test-1', { multiPart: { where: 'https://example.org' } }));
    failsWith(/multiPart\.available/);
    rmSync(join(root, 'test-1'), { recursive: true });
    source('test-1', manifest('test-1', { multiPart: { available: true, parts: 4 } }));
    failsWith(/multiPart.*parts/);
    rmSync(join(root, 'test-1'), { recursive: true });
    source('test-1', manifest('test-1', { multiPart: { available: true, where: 'not a url' } }));
    failsWith(/multiPart\.where/);
  });
});
