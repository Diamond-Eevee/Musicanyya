import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildLibraryIndex } from '../../tools/library/build-index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MINIMAL_MUSICXML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>100</per-minute></metronome></direction-type><sound tempo="100"/></direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
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
