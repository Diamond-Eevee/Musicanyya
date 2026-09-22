import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { buildScore } from '../../src/core/musicxml/build.js';
import { readXml } from '../../src/core/musicxml/read.js';
import { compileSchedule } from '../../src/core/schedule/compile.js';
import { buildTimeline } from '../../src/core/timeline/timeline.js';
import { decodeXml } from '../../src/engine/files/decode.js';
import { readMxl } from '../../src/engine/files/mxl.js';
import { buildLibraryIndex } from '../../tools/library/build-index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const libraryRoot = path.resolve(__dirname, '../../public/library');

function findScoreFiles(dir: string, base: string = dir): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...findScoreFiles(full, base));
    } else if (/\.(musicxml|mxl)$/i.test(entry.name)) {
      out.push(path.relative(base, full).split(path.sep).join('/'));
    }
  }
  return out;
}

describe('the real shelf sweep (FR-022, FR-023, US5, quickstart §US5.1)', () => {
  it('every item loads without error (FR-022)', async () => {
    const { problems } = await buildLibraryIndex(libraryRoot);
    expect(problems).toEqual([]);
  });

  it("every item's load notices exactly match its recorded meta.expected.notices (FR-023)", async () => {
    const { index } = await buildLibraryIndex(libraryRoot);
    for (const item of index.items) {
      const expectedNotices = [...(item.meta.expected?.notices ?? [])].sort();
      const actualNotices = [...item.facts.notices].sort();
      expect(actualNotices, `${item.id} facts.notices`).toEqual(expectedNotices);
    }
  });

  it('every item produces a playable timeline: at least one scheduled event (FR-022)', async () => {
    for (const relFile of findScoreFiles(libraryRoot)) {
      const fileBuffer = fs.readFileSync(path.join(libraryRoot, relFile));
      let rawBytes = new Uint8Array(fileBuffer.buffer, fileBuffer.byteOffset, fileBuffer.byteLength);
      if (relFile.toLowerCase().endsWith('.mxl')) rawBytes = await readMxl(rawBytes);
      const xmlString = decodeXml(rawBytes);
      const { doc } = readXml(xmlString);
      const { score } = buildScore(doc);
      const { timeline } = buildTimeline(score);
      const schedule = compileSchedule(timeline);
      expect(timeline.endTick, `${relFile} timeline.endTick`).toBeGreaterThan(0);
      expect(schedule.eventTick.length, `${relFile} schedule events`).toBeGreaterThan(0);
    }
  });
});

describe('an unrecorded notice fails the sweep (FR-023, quickstart §US5.2)', () => {
  const createdTempRoots: string[] = [];

  afterEach(() => {
    for (const tempRoot of createdTempRoots.splice(0)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('flags an item whose real load notices are not listed in meta.expected.notices', async () => {
    // A <harmony> element is unsupported (src/core/musicxml/build.ts), producing an
    // 'unsupportedElement' load notice the sidecar below never declares in `expected.notices`.
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>80</per-minute></metronome></direction-type><sound tempo="80"/></direction>
      <harmony><root><root-step>C</root-step></root><kind>major</kind></harmony>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>whole</type></note>
    </measure>
    ${Array.from(
      { length: 7 },
      (_, i) =>
        `<measure number="${i + 2}"><note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>whole</type></note></measure>`,
    ).join('\n    ')}
  </part>
</score-partwise>`;

    const sidecar = {
      version: 1,
      title: 'A Fixture Item',
      kind: 'piece',
      level: 'beginner',
      tags: ['sight-reading'],
      provenance: { origin: 'authored', licence: 'CC0-1.0', author: 'Test', created: '2026-09-22' },
      reviewedBy: 'test',
      reviewedOn: '2026-09-22',
    };

    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'musicanyya-library-sweep-'));
    createdTempRoots.push(tempRoot);
    const sectionDir = path.join(tempRoot, 'repertoire', 'beginner');
    fs.mkdirSync(sectionDir, { recursive: true });
    fs.writeFileSync(path.join(sectionDir, 'fixture.musicxml'), xml);
    fs.writeFileSync(path.join(sectionDir, 'fixture.json'), JSON.stringify(sidecar, null, 2));

    const { index, problems } = await buildLibraryIndex(tempRoot);
    const item = index.items.find((i) => i.id === 'repertoire/beginner/fixture');
    expect(item?.facts.notices).toContain('unsupportedElement');
    expect(problems.some((p) => p.includes('level check failed'))).toBe(true);
  });
});
