import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildLibraryIndex } from '../../tools/library/build-index.js';
import type { LibrarySectionDefinition } from '../../tools/library/sections.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const libraryRoot = path.resolve(__dirname, '../../public/library');
const indexPath = path.join(libraryRoot, 'index.json');

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

describe('library index generation (contracts/library-index.md §4, FR-025)', () => {
  it('has no problems: every score file on disk has a valid sidecar, loads, and is not silent', async () => {
    const { problems } = await buildLibraryIndex(libraryRoot);
    expect(problems).toEqual([]);
  });

  it('lists every score file on disk - none is unlisted', async () => {
    const { index } = await buildLibraryIndex(libraryRoot);
    const onDisk = findScoreFiles(libraryRoot).sort();
    const listed = index.items.map((item) => item.file).sort();
    expect(listed).toEqual(onDisk);
  });

  it('regenerating the index in memory equals the committed index.json, apart from "generated"', async () => {
    const committed = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    const { index } = await buildLibraryIndex(libraryRoot);
    const { generated: _committedGenerated, ...committedRest } = committed;
    const { generated: _freshGenerated, ...freshRest } = index;
    expect(freshRest).toEqual(committedRest);
  });

  it('T036: refuses an item with engraving findings', async () => {
    // Create a temporary library folder with one file missing a beam/accidental
    const tmpLibrary = fs.mkdtempSync(path.join(os.tmpdir(), 'musicanyya-library-guard-'));
    try {
      const sectionDir = path.join(tmpLibrary, 'repertoire/beginner');
      fs.mkdirSync(sectionDir, { recursive: true });

      const xml = fs.readFileSync(
        path.join(libraryRoot, 'repertoire/beginner/fur-elise-theme-16-bar.musicxml'),
        'utf-8',
      );
      // mutate: drop a natural
      const mutatedXml = xml.replace('<accidental>natural</accidental>', '');
      fs.writeFileSync(path.join(sectionDir, 'bad-score.musicxml'), mutatedXml);

      // copy sidecar
      const sidecar = fs.readFileSync(
        path.join(libraryRoot, 'repertoire/beginner/fur-elise-theme-16-bar.json'),
        'utf-8',
      );
      fs.writeFileSync(path.join(sectionDir, 'bad-score.json'), sidecar);

      const { problems } = await buildLibraryIndex(tmpLibrary, 'OpenScore');
      expect(problems.length).toBeGreaterThan(0);
      expect(problems.some((p) => p.includes('needs a required accidental'))).toBe(true);
    } finally {
      fs.rmSync(tmpLibrary, { recursive: true, force: true });
    }
  });
});

describe('US2 chord shelf (data-model.md §5.1-5.2, FR-005, FR-006, SC-004, analyze A11)', () => {
  it('every exercise has full fingering coverage and no load notices', async () => {
    const { index } = await buildLibraryIndex(libraryRoot);
    const exercises = index.items.filter((item) => item.meta.kind === 'exercise');
    for (const item of exercises) {
      expect(item.facts.fingeringCoverage, `${item.id} fingeringCoverage`).toBe(1);
      expect(item.facts.notices, `${item.id} notices`).toEqual([]);
    }
  });

  it('has at least 24 chord exercises and 12 chord-change drills', async () => {
    const { index } = await buildLibraryIndex(libraryRoot);
    const chordExercises = index.items.filter(
      (item) => item.section === 'learning/chords' && item.id.startsWith('learning/chords/triads-'),
    );
    const changeDrills = index.items.filter((item) => item.section === 'learning/chords/changes');
    expect(chordExercises.length).toBeGreaterThanOrEqual(24);
    expect(changeDrills.length).toBeGreaterThanOrEqual(12);
  });
});

// Feature 011 T086: the build-index rules of contract library-index 1.2.0 §1 and the step-order check, each against a
// temporary tree (as extensibility.test.ts does) with its own declared sections.
describe('build-index rules for step folders (library-index 1.2.0 §1, feature 011 FR-010)', () => {
  const HASH_A = 'a'.repeat(64);
  const SECTIONS: readonly LibrarySectionDefinition[] = [
    { id: 'learning', title: 'Learning', path: 'learning', parent: null, order: 1 },
    { id: 'learning/keys', title: 'Keys', path: 'learning/keys', parent: 'learning', order: 1 },
    { id: 'learning/keys/c-major', title: 'C major', path: 'learning/keys/c-major', parent: 'learning/keys', order: 1 },
    { id: 'learning/keys/a-minor', title: 'A minor', path: 'learning/keys/a-minor', parent: 'learning/keys', order: 2 },
    { id: 'learning/key-changes', title: 'Key changes', path: 'learning/key-changes', parent: 'learning', order: 2 },
    {
      id: 'learning/key-changes/c-major-to-a-minor',
      title: 'C major -> A minor',
      path: 'learning/key-changes/c-major-to-a-minor',
      parent: 'learning/key-changes',
      order: 1,
    },
    { id: 'repertoire', title: 'Repertoire', path: 'repertoire', parent: null, order: 2 },
    { id: 'repertoire/beginner', title: 'Beginner', path: 'repertoire/beginner', parent: 'repertoire', order: 1 },
  ];

  /** 8 bars, whole notes with a fingering on every note (an exercise needs full coverage), at `tempo` qpm. */
  function exerciseXml(tempo: number): string {
    const fingered = (step: string, octave: number, staff: number, voice: number, finger: number) =>
      `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>4</duration><voice>${voice}</voice><type>whole</type><staff>${staff}</staff><notations><technical><fingering>${finger}</fingering></technical></notations></note>`;
    const bars = Array.from({ length: 8 }, (_, i) => {
      const first =
        i === 0
          ? `<attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves></attributes><direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${tempo}</per-minute></metronome></direction-type><sound tempo="${tempo}"/></direction>`
          : '';
      return `<measure number="${i + 1}">${first}${fingered('C', 4, 1, 1, 1)}<backup><duration>4</duration></backup>${fingered('C', 3, 2, 5, 5)}</measure>`;
    });
    return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">${bars.join('')}</part></score-partwise>`;
  }

  interface ItemSpec {
    id: string;
    tempo?: number;
    meta?: Record<string, unknown>;
  }

  function sidecar(meta: Record<string, unknown>) {
    return {
      version: 1,
      title: 'An item',
      kind: 'exercise',
      level: 'beginner',
      tags: ['chords'],
      hands: 'both',
      provenance: { origin: 'authored', licence: 'CC0-1.0', author: 'Test', created: '2026-09-26' },
      reviewedBy: 'test',
      reviewedOn: '2026-09-26',
      raisedBecause: 'test data: the same music at a higher level',
      ...meta,
    };
  }

  async function build(specs: readonly ItemSpec[]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'musicanyya-step-rules-'));
    try {
      for (const spec of specs) {
        const file = path.join(root, spec.id);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(`${file}.musicxml`, exerciseXml(spec.tempo ?? 60));
        fs.writeFileSync(`${file}.json`, JSON.stringify(sidecar(spec.meta ?? {})));
      }
      return await buildLibraryIndex(root, '', SECTIONS);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }

  const step = (id: string, stepName: string, tempo: number, extra: Record<string, unknown> = {}): ItemSpec => ({
    id,
    tempo,
    meta: { step: stepName, stepOrder: 0, level: stepName, ...extra },
  });

  /** A well-formed C major folder: same music, tempo rising per step. */
  const goodFolder = (): ItemSpec[] => [
    step('learning/keys/c-major/introduction', 'introduction', 60),
    step('learning/keys/c-major/beginner', 'beginner', 72),
    step('learning/keys/c-major/intermediate', 'intermediate', 80),
    step('learning/keys/c-major/advanced', 'advanced', 96),
  ];

  it('accepts a well-formed key folder and indexes its steps', async () => {
    const { index, problems } = await build(goodFolder());
    expect(problems).toEqual([]);
    expect(index.items.map((i) => i.meta.step)).toEqual(['advanced', 'beginner', 'intermediate', 'introduction']);
    expect(index.items.find((i) => i.id.endsWith('/introduction'))?.levelCheck?.level).toBe('introduction');
  });

  it('refuses an item under learning/keys with no step', async () => {
    const specs = goodFolder();
    specs.push({ id: 'learning/keys/c-major/extra', meta: { title: 'no step' } });
    const { problems } = await build(specs);
    expect(problems).toContainEqual(expect.stringContaining('learning/keys/c-major/extra: step is required'));
  });

  it('refuses an item with a step outside learning/keys and learning/key-changes', async () => {
    const { problems } = await build([
      { id: 'repertoire/beginner/piece', meta: { kind: 'piece', step: 'beginner', stepOrder: 0 } },
    ]);
    expect(problems).toContainEqual(expect.stringContaining('repertoire/beginner/piece: step is only allowed under'));
  });

  it('refuses a step whose level does not match', async () => {
    const specs = goodFolder();
    specs[1] = step('learning/keys/c-major/beginner', 'beginner', 72, { level: 'intermediate' });
    const { problems } = await build(specs);
    expect(problems).toContainEqual(
      expect.stringContaining('learning/keys/c-major/beginner: step "beginner" requires level "beginner"'),
    );
  });

  it('refuses a song that is not a piece of level beginner or intermediate', async () => {
    const song = (id: string, meta: Record<string, unknown>): ItemSpec => ({
      id,
      meta: { step: 'song', stepOrder: 10, arrangement: false, ...meta },
    });
    const wrongKind = await build([...goodFolder(), song('learning/keys/c-major/song-a', { kind: 'exercise' })]);
    expect(wrongKind.problems).toContainEqual(expect.stringContaining('song-a: a song must be a piece'));
    const wrongLevel = await build([
      ...goodFolder(),
      song('learning/keys/c-major/song-b', { kind: 'piece', level: 'advanced' }),
    ]);
    expect(wrongLevel.problems).toContainEqual(expect.stringContaining('song-b: a song is beginner or intermediate'));
  });

  it('refuses a duplicate (step, stepOrder) in one folder, naming both items', async () => {
    const specs = goodFolder();
    specs.push(step('learning/keys/c-major/beginner-again', 'beginner', 72));
    const { problems } = await build(specs);
    expect(problems).toContainEqual(
      expect.stringContaining('learning/keys/c-major: duplicate (step, stepOrder) (beginner, 0)'),
    );
  });

  it('allows the same (step, stepOrder) in two different folders', async () => {
    const other = goodFolder().map((s) => ({ ...s, id: s.id.replace('c-major', 'a-minor') }));
    const { problems } = await build([...goodFolder(), ...other]);
    expect(problems).toEqual([]);
  });

  it('refuses two items that supersede the same old id', async () => {
    const supersedes = [{ id: 'learning/chords/old-item', hash: HASH_A }];
    const specs = goodFolder();
    specs[0] = step('learning/keys/c-major/introduction', 'introduction', 60, { supersedes });
    specs[1] = step('learning/keys/c-major/beginner', 'beginner', 72, { supersedes });
    const { problems } = await build(specs);
    expect(problems).toContainEqual(
      expect.stringContaining('learning/chords/old-item: superseded by both learning/keys/c-major/'),
    );
  });

  it('refuses a supersedes id that is still a shelf item', async () => {
    const specs = goodFolder();
    specs[0] = step('learning/keys/c-major/introduction', 'introduction', 60, {
      supersedes: [{ id: 'learning/keys/c-major/beginner', hash: HASH_A }],
    });
    const { problems } = await build(specs);
    expect(problems).toContainEqual(
      expect.stringContaining(
        'learning/keys/c-major/introduction: supersedes learning/keys/c-major/beginner, which is still on the shelf',
      ),
    );
  });

  it('refuses an item under learning/key-changes without the key-changes tag', async () => {
    const folder = 'learning/key-changes/c-major-to-a-minor';
    const { problems } = await build([
      step(`${folder}/introduction`, 'introduction', 60),
      step(`${folder}/beginner`, 'beginner', 72, { tags: ['chords', 'key-changes'] }),
    ]);
    expect(problems).toContainEqual(
      expect.stringContaining(`${folder}/introduction: an item under learning/key-changes needs`),
    );
    expect(problems.some((p) => p.includes(`${folder}/beginner: an item under`))).toBe(false);
  });

  // one failing case per step-order failure: the folder is refused, and the message names folder, steps and fact
  it('refuses a folder whose later step is less demanding on tempoBpm', async () => {
    const specs = goodFolder();
    specs[2] = step('learning/keys/c-major/intermediate', 'intermediate', 66);
    const { problems } = await build(specs);
    expect(problems).toContainEqual(
      'learning/keys/c-major: intermediate is less demanding than beginner on tempoBpm (66 < 72)',
    );
  });

  it('refuses a folder whose steps are equal on every measured fact', async () => {
    const specs = goodFolder();
    specs[1] = step('learning/keys/c-major/beginner', 'beginner', 60);
    const { problems } = await build(specs);
    expect(problems).toContainEqual(
      'learning/keys/c-major: beginner is not more demanding than introduction on any fact',
    );
  });

  it('checks key-change folders (three steps) and ignores extras and songs', async () => {
    const folder = 'learning/key-changes/c-major-to-a-minor';
    const tags = { tags: ['chords', 'key-changes'] };
    const good = [
      step(`${folder}/introduction`, 'introduction', 60, tags),
      step(`${folder}/beginner`, 'beginner', 72, tags),
      step(`${folder}/intermediate`, 'intermediate', 80, tags),
      // an easier extra at the intermediate step must not break the order
      {
        id: `${folder}/extra`,
        tempo: 50,
        meta: { step: 'intermediate', stepOrder: 10, level: 'intermediate', ...tags },
      },
    ];
    expect((await build(good)).problems).toEqual([]);
    const bad = [...good];
    bad[2] = step(`${folder}/intermediate`, 'intermediate', 66, tags);
    expect((await build(bad)).problems).toContainEqual(
      `${folder}: intermediate is less demanding than beginner on tempoBpm (66 < 72)`,
    );
  });
});
