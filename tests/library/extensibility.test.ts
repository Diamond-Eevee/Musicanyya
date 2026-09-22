import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildLibraryIndex } from '../../tools/library/build-index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Beginner-satisfying by construction (data-model.md §4): 1 part, 2 staves, 8 measures, a stated
 *  tempo in range, nothing else that any criterion caps. */
function measure(number: number): string {
  const attributes =
    number === 1
      ? '<attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves></attributes>' +
        '<direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>80</per-minute></metronome></direction-type><sound tempo="80"/></direction>'
      : '';
  return (
    `<measure number="${number}">${attributes}` +
    '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>whole</type><staff>1</staff></note>' +
    '<backup><duration>4</duration></backup>' +
    '<note><pitch><step>C</step><octave>3</octave></pitch><duration>4</duration><voice>5</voice><type>whole</type><staff>2</staff></note>' +
    '</measure>'
  );
}

const MINIMAL_MUSICXML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    ${Array.from({ length: 8 }, (_, i) => measure(i + 1)).join('\n    ')}
  </part>
</score-partwise>`;

function minimalSidecar() {
  return {
    version: 1,
    title: 'A New Item',
    kind: 'piece',
    level: 'beginner',
    tags: ['sight-reading'],
    provenance: { origin: 'authored', licence: 'CC0-1.0', author: 'Test', created: '2026-09-22' },
    reviewedBy: 'test',
    reviewedOn: '2026-09-22',
  };
}

/** Every file directly under `src/core/library`, by mtime - a change here would mean the generator
 *  wrote to source code rather than only to the content tree it was pointed at (FR-016). */
function coreLibrarySnapshot(): Record<string, number> {
  const dir = path.resolve(__dirname, '../../src/core/library');
  const snapshot: Record<string, number> = {};
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isFile()) snapshot[full] = fs.statSync(full).mtimeMs;
  }
  return snapshot;
}

describe('library extensibility (FR-016, analyze A8)', () => {
  it('a new score plus sidecar written into a copy of the tree appears in a regenerated index, with no change under src/', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'musicanyya-library-'));
    const sectionDir = path.join(tempRoot, 'repertoire', 'beginner');
    fs.mkdirSync(sectionDir, { recursive: true });
    fs.writeFileSync(path.join(sectionDir, 'a-new-item.musicxml'), MINIMAL_MUSICXML);
    fs.writeFileSync(path.join(sectionDir, 'a-new-item.json'), JSON.stringify(minimalSidecar(), null, 2));

    const before = coreLibrarySnapshot();
    const { index, problems } = await buildLibraryIndex(tempRoot);
    const after = coreLibrarySnapshot();

    expect(problems).toEqual([]);
    expect(index.items.map((item) => item.id)).toContain('repertoire/beginner/a-new-item');
    expect(after).toEqual(before);

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });
});
