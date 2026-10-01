import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { LIBRARY_BUDGET_BYTES } from '../../src/core/defaults.js';
import { LIBRARY_LICENCES } from '../../src/core/library/licences.js';
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
      expect(LIBRARY_LICENCES).toContain(item.meta.provenance.licence);
      expect(item.meta.reviewedBy.length).toBeGreaterThan(0);
      expect(item.meta.reviewedOn.length).toBeGreaterThan(0);
    }
  });

  // T051: fails until every arrangement's sidecar names its departures (T060-T067, US2 checkpoint).
  it('every arrangement names its departures, and no original has any (FR-010)', async () => {
    const { index } = await buildLibraryIndex(libraryRoot);
    const wrong = index.items
      .filter((item) => (item.meta.arrangement ? !item.meta.departures?.length : item.meta.departures !== undefined))
      .map((item) => item.id);
    expect(wrong).toEqual([]);
  });

  it('stays inside the SC-008 size budget (FR-026, analyze A7)', () => {
    expect(totalBytes(libraryRoot)).toBeLessThanOrEqual(LIBRARY_BUDGET_BYTES);
  });
});

describe('licence and provenance validation (FR-017, FR-018, FR-020, FR-025)', () => {
  // 019 FR-025 admitted CC BY / CC BY-SA (library-index 1.4.0); a licence outside the list still fails the build.
  it('fails the whole build when a licence is not one the library lists (NonCommercial)', async () => {
    const tempRoot = makeFixture({
      ...baseSidecar(),
      provenance: {
        origin: 'downloaded',
        licence: 'CC-BY-NC-4.0',
        credit: 'A. Person',
        unmodified: true,
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
    // Departures present (FR-010, T097), so only the title rule can reject it.
    const tempRoot = makeFixture({
      ...baseSidecar(),
      arrangement: true,
      title: 'A Fixture Item',
      departures: ['Bar 1: a named departure.'],
    });
    const { problems } = await buildLibraryIndex(tempRoot);
    expect(problems.some((p) => p.includes('arrangement'))).toBe(true);
  });

  // T097: the index model enforces FR-010 once every shelf arrangement has departures (after T067).
  it('rejects arrangement: true without departures', async () => {
    const tempRoot = makeFixture({ ...baseSidecar(), arrangement: true, title: 'Arranged Fixture' });
    const { problems } = await buildLibraryIndex(tempRoot);
    expect(problems.some((p) => p.includes('item-metadata schema'))).toBe(true);
  });

  // T097, as above.
  it('rejects arrangement: false with a departures array', async () => {
    const tempRoot = makeFixture({ ...baseSidecar(), arrangement: false, departures: ['A departure'] });
    const { problems } = await buildLibraryIndex(tempRoot);
    expect(problems.some((p) => p.includes('item-metadata schema'))).toBe(true);
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

// Feature 011 T056: every public-domain source a song is built from is recorded in THIRD_PARTY_NOTICES.md before release.
describe('the sources of the songs (feature 011 FR-017)', () => {
  it('every source a shelf song is based on appears in THIRD_PARTY_NOTICES.md', async () => {
    const { index } = await buildLibraryIndex(libraryRoot);
    const notices = fs.readFileSync(path.resolve(__dirname, '../../THIRD_PARTY_NOTICES.md'), 'utf8');
    const songs = index.items.filter((i) => i.meta.step === 'song');
    expect(songs.length).toBeGreaterThan(0);
    for (const song of songs) {
      const basedOn = song.meta.provenance.origin === 'authored' ? (song.meta.provenance.basedOn ?? '') : '';
      const id = /^(mutopia-\d+-[a-z0-9-]+)/.exec(basedOn)?.[1];
      expect(id, `${song.id}: basedOn "${basedOn}" starts with the source id`).toBeDefined();
      expect(notices, `${id} in THIRD_PARTY_NOTICES.md`).toContain(id as string);
    }
  });
});

// Feature 019 FR-025 / FR-026 / SC-010 (research R-19): attribution items are credited and keep their source's licence.
describe('attribution licences on the shelf (019 FR-025, FR-026)', () => {
  const SOURCE = 'https://example.com/a-by-sa-work';
  const CREDIT = 'Typeset by A. Person';
  const attributed = (patch: Record<string, unknown> = {}) => ({
    ...baseSidecar(),
    provenance: {
      origin: 'downloaded',
      licence: 'CC-BY-SA-4.0',
      source: SOURCE,
      sourcePath: 'by-sa-1/piece.mxl',
      obtained: '2026-10-01',
      credit: CREDIT,
      unmodified: false,
      ...patch,
    },
  });
  const notices = `# Third Party Notices

- A Work - ${CREDIT}, CC BY-SA 4.0
  ${SOURCE}
`;
  const licences: Record<string, string> = { 'by-sa-1': 'CC-BY-SA-4.0', 'cc0-1': 'CC0-1.0' };
  const build = (sidecar: Record<string, unknown>, notes = notices) =>
    buildLibraryIndex(makeFixture(sidecar), notes, undefined, (id) => licences[id]);

  it('accepts a CC BY-SA item credited in the notices whose source has the same licence', async () => {
    const { problems } = await build(attributed());
    expect(problems).toEqual([]);
  });

  it('fails when the source it names has another licence (share-alike, FR-026)', async () => {
    const { problems } = await build(attributed({ sourcePath: 'cc0-1/piece.mxl' }));
    expect(problems.some((p) => p.includes('licence') && p.includes('cc0-1'))).toBe(true);
  });

  it('fails when it names no source at all', async () => {
    const { problems } = await build(attributed({ sourcePath: undefined }));
    expect(problems.some((p) => p.includes('sourcePath'))).toBe(true);
  });

  it('fails when THIRD_PARTY_NOTICES.md lists the source but not the credit', async () => {
    const { problems } = await build(
      attributed(),
      `# Third Party Notices

- A Work
  ${SOURCE}
`,
    );
    expect(problems.some((p) => p.includes('credit') && p.includes('THIRD_PARTY_NOTICES'))).toBe(true);
  });

  it('fails an authored item based on an attribution-licensed source; one based on a CC0 source passes', async () => {
    const authored = (basedOn: string) => ({
      ...baseSidecar(),
      provenance: { origin: 'authored', licence: 'CC0-1.0', author: 'Test', created: '2026-10-01', basedOn },
    });
    expect((await build(authored('cc0-1: A CC0 tune'))).problems).toEqual([]);
    const { problems } = await build(authored('by-sa-1: A BY-SA tune'));
    expect(problems.some((p) => p.includes('basedOn') && p.includes('by-sa-1'))).toBe(true);
  });
});
