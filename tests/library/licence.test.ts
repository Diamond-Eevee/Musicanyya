import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { LIBRARY_BUDGET_BYTES } from '../../src/core/defaults.js';
import { buildLibraryIndex } from '../../tools/library/build-index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const libraryRoot = path.resolve(__dirname, '../../public/library');

/** Beginner-satisfying by construction (data-model.md §4): 1 part, 2 staves, 8 measures, a stated
 *  tempo in range, one sounding note per measure - the same shape tests/library/extensibility.test.ts
 *  uses, so a fixture that should pass genuinely would. */
function measure(number: number, opts: { silent?: boolean } = {}): string {
  const attributes =
    number === 1
      ? '<attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves></attributes>' +
        '<direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>80</per-minute></metronome></direction-type><sound tempo="80"/></direction>'
      : '';
  const top = opts.silent
    ? '<note><rest/><duration>4</duration><voice>1</voice><type>whole</type><staff>1</staff></note>'
    : '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>whole</type><staff>1</staff></note>';
  const bottom = opts.silent
    ? '<note><rest/><duration>4</duration><voice>5</voice><type>whole</type><staff>2</staff></note>'
    : '<note><pitch><step>C</step><octave>3</octave></pitch><duration>4</duration><voice>5</voice><type>whole</type><staff>2</staff></note>';
  return `<measure number="${number}">${attributes}${top}<backup><duration>4</duration></backup>${bottom}</measure>`;
}

function musicXml(opts: { silent?: boolean } = {}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    ${Array.from({ length: 8 }, (_, i) => measure(i + 1, opts)).join('\n    ')}
  </part>
</score-partwise>`;
}

function baseSidecar(): Record<string, unknown> {
  return {
    version: 1,
    title: 'A Fixture Item',
    kind: 'piece',
    level: 'beginner',
    tags: ['sight-reading'],
    provenance: { origin: 'authored', licence: 'CC0-1.0', author: 'Test', created: '2026-09-22' },
    reviewedBy: 'test',
    reviewedOn: '2026-09-22',
  };
}

const createdTempRoots: string[] = [];

/** Writes a one-item fixture library (`repertoire/beginner/fixture.*`) into a fresh temp tree, using
 *  a passing MusicXML unless `xml` overrides it, and returns its root. */
function makeFixture(sidecar: Record<string, unknown>, xml: string = musicXml()): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'musicanyya-library-licence-'));
  createdTempRoots.push(tempRoot);
  const sectionDir = path.join(tempRoot, 'repertoire', 'beginner');
  fs.mkdirSync(sectionDir, { recursive: true });
  fs.writeFileSync(path.join(sectionDir, 'fixture.musicxml'), xml);
  fs.writeFileSync(path.join(sectionDir, 'fixture.json'), JSON.stringify(sidecar, null, 2));
  return tempRoot;
}

function totalBytes(dir: string): number {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? totalBytes(full) : fs.statSync(full).size;
  }
  return total;
}

afterEach(() => {
  for (const tempRoot of createdTempRoots.splice(0)) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

describe('the real shelf (FR-017, FR-018, FR-025, US4)', () => {
  it('every item carries an admitted licence and a recorded reviewer', async () => {
    const { index, problems } = await buildLibraryIndex(libraryRoot);
    expect(problems).toEqual([]);
    for (const item of index.items) {
      expect(['CC0-1.0', 'public-domain']).toContain(item.meta.provenance.licence);
      expect(item.meta.reviewedBy.length).toBeGreaterThan(0);
      expect(item.meta.reviewedOn.length).toBeGreaterThan(0);
    }
  });

  it('stays inside the SC-008 size budget (FR-026, analyze A7)', () => {
    expect(totalBytes(libraryRoot)).toBeLessThanOrEqual(LIBRARY_BUDGET_BYTES);
  });
});

describe('licence and provenance validation (FR-017, FR-018, FR-020, FR-025)', () => {
  it('fails the whole build when a licence is not CC0-1.0 or public-domain', async () => {
    const tempRoot = makeFixture({
      ...baseSidecar(),
      provenance: {
        origin: 'downloaded',
        licence: 'CC-BY-4.0',
        source: 'https://example.com/x',
        obtained: '2026-09-22',
      },
    });
    const { problems } = await buildLibraryIndex(tempRoot);
    expect(problems.some((p) => p.includes('fixture.json'))).toBe(true);
  });

  it('rejects a downloaded item whose source is not recorded in THIRD_PARTY_NOTICES.md (FR-020)', async () => {
    const source = 'https://example.com/an-unrecorded-work';
    const tempRoot = makeFixture({
      ...baseSidecar(),
      provenance: { origin: 'downloaded', licence: 'CC0-1.0', source, obtained: '2026-09-22' },
    });
    const { problems } = await buildLibraryIndex(
      tempRoot,
      '# Third Party Notices\n\nNothing about that source here.\n',
    );
    expect(problems.some((p) => p.includes('THIRD_PARTY_NOTICES'))).toBe(true);
  });

  it('accepts a downloaded item once its source is recorded in THIRD_PARTY_NOTICES.md', async () => {
    const source = 'https://example.com/a-recorded-work';
    const tempRoot = makeFixture({
      ...baseSidecar(),
      provenance: { origin: 'downloaded', licence: 'CC0-1.0', source, obtained: '2026-09-22' },
    });
    const { problems } = await buildLibraryIndex(tempRoot, `# Third Party Notices\n\n- A Recorded Work\n  ${source}\n`);
    expect(problems).toEqual([]);
  });
});

describe('placeholder rejection (FR-021)', () => {
  it('rejects a 0-byte score file', async () => {
    const tempRoot = makeFixture(baseSidecar(), '');
    const { problems } = await buildLibraryIndex(tempRoot);
    expect(problems.some((p) => p.includes('empty'))).toBe(true);
  });

  it('rejects a score with no sounding note (silent)', async () => {
    const tempRoot = makeFixture(baseSidecar(), musicXml({ silent: true }));
    const { problems } = await buildLibraryIndex(tempRoot);
    expect(problems.some((p) => p.includes('silent'))).toBe(true);
  });
});

describe('arrangement labelling (FR-007)', () => {
  it('rejects arrangement: true when the title does not say so', async () => {
    const tempRoot = makeFixture({ ...baseSidecar(), arrangement: true, title: 'A Fixture Item' });
    const { problems } = await buildLibraryIndex(tempRoot);
    expect(problems.some((p) => p.includes('arrangement'))).toBe(true);
  });
});

describe('a raised level requires raisedBecause (data-model.md §3, FR-009)', () => {
  it('fails the level check when the assigned level sits above the computed one with no reason given', async () => {
    const tempRoot = makeFixture({ ...baseSidecar(), level: 'advanced' });
    const { problems } = await buildLibraryIndex(tempRoot);
    expect(problems.some((p) => p.includes('level check failed'))).toBe(true);
  });

  it('passes once raisedBecause explains the raise', async () => {
    const tempRoot = makeFixture({ ...baseSidecar(), level: 'advanced', raisedBecause: 'test: raised on purpose' });
    const { problems } = await buildLibraryIndex(tempRoot);
    expect(problems).toEqual([]);
  });
});
