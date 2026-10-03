// Feature 011 (constitution audit, Principle IV): the generated shelf is deterministic. Regenerating every exercise and song on
// some other day must give back the committed files: the day is stamped into a sidecar only when it is new. Feature 019:
// every item's Orchestra must equal a fresh generation from its definition (rule O4).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { buildExercises } from '../../tools/library/build-exercises.js';
import { buildLessons } from '../../tools/library/build-lessons.js';
import { buildSongs } from '../../tools/library/build-songs.js';
import { main as orchestraMain } from '../../tools/library/orchestra/cli.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const committed = path.join(root, 'public/library');
const LATER = '2099-01-01';

function filesUnder(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? filesUnder(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'musicanyya-regeneration-'));
afterAll(() => fs.rmSync(temp, { recursive: true, force: true }));

describe('regenerating the shelf on another day', () => {
  it('gives back every generated exercise and song exactly (MusicXML byte for byte, sidecars as data)', async () => {
    // start from the committed generated shelf, so an existing sidecar is what the tools see
    fs.cpSync(path.join(committed, 'learning'), path.join(temp, 'learning'), { recursive: true });
    const before = filesUnder(path.join(temp, 'learning')).map((f) => path.relative(temp, f));

    const exercises = await buildExercises(path.join(root, 'content/library/exercises'), temp, LATER);
    const songs = await buildSongs(
      path.join(root, 'content/library/songs'),
      temp,
      path.join(root, 'content/library/sources'),
      LATER,
    );
    expect(exercises.written.length).toBeGreaterThan(150);
    expect(songs.length).toBeGreaterThanOrEqual(10);

    const after = filesUnder(path.join(temp, 'learning')).map((f) => path.relative(temp, f));
    expect(after.sort()).toEqual(before.sort()); // nothing new, nothing missing

    for (const file of after) {
      const now = fs.readFileSync(path.join(temp, file), 'utf8');
      const was = fs.readFileSync(path.join(committed, file), 'utf8');
      if (file.endsWith('.json')) expect(JSON.parse(now), file).toEqual(JSON.parse(was));
      else expect(now, file).toBe(was);
    }
  });
});

// Feature 022 (contract lesson-definition 1.0.0 §4 step 4): the Basics and chord lessons are generated too. Regenerating
// them on another day writes exactly the committed files of their folders, and nothing else.
describe('regenerating every lesson on another day', () => {
  const lessonFolders = ['basics', 'learning/chord-lessons'];
  const contentDir = path.join(root, 'content/library/lessons');

  it('gives back every lesson item exactly (MusicXML byte for byte, sidecars as data)', async () => {
    const lessonTemp = path.join(temp, 'lessons');
    for (const folder of lessonFolders) {
      if (fs.existsSync(path.join(committed, folder)))
        fs.cpSync(path.join(committed, folder), path.join(lessonTemp, folder), { recursive: true });
    }
    const committedFiles = lessonFolders
      .flatMap((folder) =>
        fs.existsSync(path.join(committed, folder)) ? filesUnder(path.join(committed, folder)) : [],
      )
      .map((f) => path.relative(committed, f).split(path.sep).join('/'))
      .sort();

    fs.mkdirSync(lessonTemp, { recursive: true });
    const written = fs.existsSync(contentDir) ? await buildLessons(contentDir, lessonTemp, LATER) : [];
    const writtenFiles = written.flatMap((f) => [f, f.replace(/\.musicxml$/, '.json')]).sort();
    expect(writtenFiles).toEqual(committedFiles); // every committed lesson file is generated, nothing more

    for (const file of committedFiles) {
      const now = fs.readFileSync(path.join(lessonTemp, file), 'utf8');
      const was = fs.readFileSync(path.join(committed, file), 'utf8');
      if (file.endsWith('.json')) expect(JSON.parse(now), file).toEqual(JSON.parse(was));
      else expect(now, file).toBe(was);
    }
  });
});

describe('regenerating every Orchestra (019 T055, rule O4)', () => {
  const definitions = fs
    .readdirSync(path.join(root, 'content/library/orchestra'))
    .filter((f) => f.endsWith('.json'))
    .map(
      (f) => JSON.parse(fs.readFileSync(path.join(root, 'content/library/orchestra', f), 'utf8')) as { itemId: string },
    );

  it('has at least one definition (Morning Mood)', () => {
    expect(definitions.map((d) => d.itemId)).toContain('repertoire/advanced/grieg-morning-mood');
  });

  it.each(definitions.map((d) => d.itemId))(
    'pnpm library:orchestra %s --check: the committed parts equal a fresh generation',
    (itemId) => {
      const lines: string[] = [];
      expect(orchestraMain([itemId, '--check'], { root, out: (line) => lines.push(line) }), lines.join('\n')).toBe(0);
    },
  );
});
