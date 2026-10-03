import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { KEY_CHANGE_PAIRS, KEYS } from '../../src/core/library/exercise/keys.js';
import { buildLibraryIndex } from '../../tools/library/build-index.js';
import { LIBRARY_SECTIONS, type LibrarySectionDefinition } from '../../tools/library/sections.js';
import { SUCCESSORS } from '../../tools/library/successors.js';

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

  // Feature 011 replaced "at least 24 chord exercises and 12 chord-change drills" (contract library-index 1.2.0 §4): the shelf
  // now counts step exercises, and every old drill's skill lives on in its successor (checked by the successor tests below).
  it('has at least 96 step exercises (24 keys x 4 steps) and the C major extras (five kept drills after US2)', async () => {
    const { index } = await buildLibraryIndex(libraryRoot);
    const steps = index.items.filter(
      (item) =>
        item.id.startsWith('learning/keys/') && item.meta.step !== undefined && (item.meta.stepOrder ?? 0) === 0,
    );
    expect(steps.length).toBeGreaterThanOrEqual(96);
    const kept = index.items.filter((item) => (item.meta.stepOrder ?? 0) > 0 && item.meta.kind === 'exercise');
    expect(kept.length).toBeGreaterThanOrEqual(3);
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

  it('an extra (stepOrder 10+) keeps its own level: the step is where it sits, the level is how hard it measures', async () => {
    const { problems } = await build([
      ...goodFolder(),
      { id: 'learning/keys/c-major/extra', tempo: 60, meta: { step: 'advanced', stepOrder: 10, level: 'beginner' } },
    ]);
    expect(problems).toEqual([]);
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

// Feature 011 T023 (spec FR-002, FR-003, FR-005, FR-006, FR-020; library-index 1.2.0 §4): the Learning > Keys shelf.
describe('the Learning > Keys shelf (feature 011 US1)', () => {
  const STEPS = ['introduction', 'beginner', 'intermediate', 'advanced'] as const;

  it('has 24 key folders in circle-of-fifths order, titled with the key, under Learning > Keys', async () => {
    const { index } = await buildLibraryIndex(libraryRoot);
    const folders = index.sections.filter((s) => s.parent === 'learning/keys');
    expect(folders.sort((a, b) => a.order - b.order).map((s) => s.id)).toEqual(
      KEYS.map((k) => `learning/keys/${k.slug}`),
    );
    expect(folders.map((s) => s.title)).toEqual(KEYS.map((k) => k.displayName));
    expect(folders.map((s) => s.title).slice(0, 4)).toEqual(['C major', 'A minor', 'G major', 'E minor']);
    expect(folders.map((s) => s.order)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    const keys = index.sections.find((s) => s.id === 'learning/keys');
    expect(keys?.title).toBe('Keys');
    expect(keys?.parent).toBe('learning');
    expect(index.sections.find((s) => s.id === 'learning')?.parent).toBeNull();
  });

  it('every key folder has exactly one main item for each of the four steps, at the matching level', async () => {
    const { index } = await buildLibraryIndex(libraryRoot);
    for (const key of KEYS) {
      const items = index.items.filter((i) => i.section === `learning/keys/${key.slug}`);
      for (const step of STEPS) {
        const main = items.filter((i) => i.meta.step === step && (i.meta.stepOrder ?? 0) === 0);
        expect(
          main.map((i) => i.id),
          `${key.slug} ${step}`,
        ).toEqual([`learning/keys/${key.slug}/${step}`]);
        expect(main[0]?.meta.level, `${key.slug} ${step}`).toBe(step);
        expect(main[0]?.meta.kind).toBe('exercise');
      }
    }
  });

  it('has at least 96 step exercises (24 keys x 4 steps)', async () => {
    const { index } = await buildLibraryIndex(libraryRoot);
    const stepExercises = index.items.filter(
      (i) =>
        i.id.startsWith('learning/keys/') &&
        i.meta.step !== undefined &&
        i.meta.step !== 'song' &&
        (i.meta.stepOrder ?? 0) === 0,
    );
    expect(stepExercises.length).toBeGreaterThanOrEqual(96);
  });

  it('C major keeps the three Advanced extras, after the main step: stepOrder 10, 20, 30', async () => {
    const { index } = await buildLibraryIndex(libraryRoot);
    const extras = index.items
      .filter((i) => i.section === 'learning/keys/c-major' && (i.meta.stepOrder ?? 0) > 0 && i.meta.step !== 'song')
      .sort((a, b) => (a.meta.stepOrder ?? 0) - (b.meta.stepOrder ?? 0));
    expect(extras.map((i) => [i.id, i.meta.step, i.meta.stepOrder])).toEqual([
      ['learning/keys/c-major/i-v-vi-iv', 'advanced', 10],
      ['learning/keys/c-major/turnaround', 'advanced', 20],
      ['learning/keys/c-major/diatonic-ladder', 'advanced', 30],
    ]);
  });

  it('replaces the old Chords items: nothing remains under learning/chords (the two same-tonic drills moved in US2)', async () => {
    const { index } = await buildLibraryIndex(libraryRoot);
    expect(index.items.filter((i) => i.id.startsWith('learning/chords/'))).toEqual([]);
  });

  it('every old item that US1 replaces is superseded by exactly one new item, with the SHA-256 of its old file (FR-005, FR-020)', async () => {
    const { index } = await buildLibraryIndex(libraryRoot);
    // Feature 014 FR-012: the three drills under learning/keys that got a melody start fresh (resetBy '014') - no claimant.
    const handledByUs1 = SUCCESSORS.filter((s) => s.newId.startsWith('learning/keys/') && s.resetBy === undefined);
    expect(handledByUs1.length).toBeGreaterThan(0);
    for (const successor of SUCCESSORS.filter((s) => s.newId.startsWith('learning/keys/') && s.resetBy === '014'))
      expect(
        index.items.filter((i) => i.meta.supersedes?.some((s) => s.id === successor.oldId)).map((i) => i.id),
        successor.oldId,
      ).toEqual([]);
    for (const successor of handledByUs1) {
      const claimants = index.items.filter((i) => i.meta.supersedes?.some((s) => s.id === successor.oldId));
      expect(
        claimants.map((i) => i.id),
        successor.oldId,
      ).toEqual([successor.newId]);
      const entry = claimants[0]?.meta.supersedes?.find((s) => s.id === successor.oldId);
      expect(entry?.hash, successor.oldId).toBe(successor.hash);
    }
  });

  it('no superseded id is still a shelf item', async () => {
    const { index } = await buildLibraryIndex(libraryRoot);
    const shelf = new Set(index.items.map((i) => i.id));
    for (const item of index.items)
      for (const old of item.meta.supersedes ?? []) expect(shelf.has(old.id), old.id).toBe(false);
  });
});

// Feature 011 T045 (spec FR-013-FR-015; data-model §2; library-index 1.2.0 §4): the Learning > Key changes shelf.
describe('the Learning > Key changes shelf (feature 011 US2)', () => {
  const PAIR_SLUGS = [
    'c-major-to-a-minor',
    'a-minor-to-c-major',
    'c-major-to-c-minor',
    'c-minor-to-c-major',
    'g-major-to-e-minor',
    'e-minor-to-g-major',
    'g-major-to-g-minor',
    'g-minor-to-g-major',
    'f-major-to-d-minor',
    'd-minor-to-f-major',
    'f-major-to-f-minor',
    'f-minor-to-f-major',
    'd-major-to-b-minor',
    'b-minor-to-d-major',
    'd-major-to-d-minor',
    'd-minor-to-d-major',
    'a-minor-to-a-major',
    'a-major-to-a-minor',
  ];
  const STEPS = ['introduction', 'beginner', 'intermediate'] as const;

  it('has 18 pair folders under Learning > Key changes, in data-model §2 order, titled "<from> -> <to>"', async () => {
    const { index } = await buildLibraryIndex(libraryRoot);
    const root = index.sections.find((s) => s.id === 'learning/key-changes');
    expect(root?.title).toBe('Key changes');
    expect(root?.parent).toBe('learning');
    expect(root?.order).toBe(2);
    const folders = index.sections.filter((s) => s.parent === 'learning/key-changes').sort((a, b) => a.order - b.order);
    expect(folders.map((s) => s.id)).toEqual(PAIR_SLUGS.map((slug) => `learning/key-changes/${slug}`));
    expect(folders.map((s) => s.order)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    expect(folders.slice(0, 4).map((s) => s.title)).toEqual([
      'C major -> A minor',
      'A minor -> C major',
      'C major -> C minor',
      'C minor -> C major',
    ]);
    expect(folders.map((s) => s.description)).toEqual(
      KEY_CHANGE_PAIRS.map((p) => p.relation), // the pair table's own order is the shelf's
    );
  });

  it('every pair folder has exactly one main introduction, beginner and intermediate, tagged key-changes', async () => {
    const { index } = await buildLibraryIndex(libraryRoot);
    for (const slug of PAIR_SLUGS) {
      const items = index.items.filter((i) => i.section === `learning/key-changes/${slug}`);
      for (const step of STEPS) {
        const main = items.filter((i) => i.meta.step === step && (i.meta.stepOrder ?? 0) === 0);
        expect(
          main.map((i) => i.id),
          `${slug} ${step}`,
        ).toEqual([`learning/key-changes/${slug}/${step}`]);
        expect(main[0]?.meta.level, `${slug} ${step}`).toBe(step);
        expect(main[0]?.meta.tags, `${slug} ${step}`).toContain('key-changes');
      }
      expect(
        items.every((i) => i.meta.tags.includes('key-changes')),
        slug,
      ).toBe(true);
    }
  });

  it('has at least 54 key-change exercises (18 pairs x 3 steps)', async () => {
    const { index } = await buildLibraryIndex(libraryRoot);
    const mains = index.items.filter(
      (i) => i.id.startsWith('learning/key-changes/') && (i.meta.stepOrder ?? 0) === 0 && i.meta.step !== undefined,
    );
    expect(mains.length).toBeGreaterThanOrEqual(54);
  });

  it('the two same-tonic drills sit in their pair folders as extras: major-and-minor and minor-and-major', async () => {
    const { index } = await buildLibraryIndex(libraryRoot);
    const extras = index.items.filter((i) => i.id.startsWith('learning/key-changes/') && (i.meta.stepOrder ?? 0) > 0);
    expect(extras.map((i) => [i.id, i.meta.step, i.meta.stepOrder]).sort()).toEqual([
      ['learning/key-changes/a-minor-to-a-major/minor-and-major', 'intermediate', 10],
      ['learning/key-changes/c-major-to-c-minor/major-and-minor', 'intermediate', 10],
    ]);
  });

  it('nothing is left under learning/chords, and the folders remember the old ids', async () => {
    const { index } = await buildLibraryIndex(libraryRoot);
    expect(index.items.filter((i) => i.id.startsWith('learning/chords/'))).toEqual([]);
    expect(index.sections.filter((s) => s.id.startsWith('learning/chords'))).toEqual([]);
    expect(index.sections.find((s) => s.id === 'learning/key-changes')?.formerIds).toEqual(['learning/chords/changes']);
  });

  // Changed expectation (feature 014 FR-012, owner decision 2026-09-28): the two moved drills superseded their old ids until
  // feature 014 gave them a melody; now they start fresh, so no item supersedes those ids and their entries say resetBy '014'.
  it('the two moved drills start fresh after feature 014: no item supersedes their old ids (FR-014, 014 FR-012)', async () => {
    const { index } = await buildLibraryIndex(libraryRoot);
    const moved = SUCCESSORS.filter((s) => s.newId?.startsWith('learning/key-changes/'));
    expect(moved.map((s) => s.oldId).sort()).toEqual([
      'learning/chords/changes/changes-a-minor-major-a-minor',
      'learning/chords/changes/changes-same-tonic-c-major',
    ]);
    for (const successor of moved) {
      expect(successor.resetBy, successor.oldId).toBe('014');
      const claimants = index.items.filter((i) => i.meta.supersedes?.some((s) => s.id === successor.oldId));
      expect(claimants.map((i) => i.id)).toEqual([]);
    }
  });
});

// Feature 011 T056 (spec FR-016, FR-017, FR-019, SC-004; contract song-definition §2 step 6): the songs on the shelf.
describe('the songs on the Learning > Keys shelf (feature 011 US3)', () => {
  const songs = async () => (await buildLibraryIndex(libraryRoot)).index.items.filter((i) => i.meta.step === 'song');

  it('has at least 8 songs, at least 6 of them beginner, in at least 4 keys, at least 2 of them minor', async () => {
    const all = await songs();
    expect(all.length).toBeGreaterThanOrEqual(8);
    expect(all.filter((s) => s.meta.level === 'beginner').length).toBeGreaterThanOrEqual(6);
    const folders = new Set(all.map((s) => s.section));
    expect(folders.size).toBeGreaterThanOrEqual(4);
    expect([...folders].filter((f) => f.endsWith('-minor')).length).toBeGreaterThanOrEqual(2);
  });

  it('every song is a piece in a key folder, an arrangement with its departures, based on an approved source', async () => {
    const sources = new Set(
      fs
        .readdirSync(path.resolve(__dirname, '../../content/library/sources'), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name),
    );
    for (const song of await songs()) {
      expect(song.id, song.id).toMatch(/^learning\/keys\/[a-z0-9-]+\/song-[a-z0-9-]+$/);
      expect(song.meta.kind, song.id).toBe('piece');
      expect(song.meta.arrangement, song.id).toBe(true);
      expect(song.meta.departures?.length ?? 0, song.id).toBeGreaterThan(0);
      expect(song.meta.tags, song.id).toEqual(expect.arrayContaining(['chords', 'hands-together']));
      expect(['beginner', 'intermediate'], song.id).toContain(song.meta.level);
      const provenance = song.meta.provenance;
      expect(provenance.origin, song.id).toBe('authored');
      expect(provenance.licence, song.id).toBe('CC0-1.0');
      const basedOn = provenance.origin === 'authored' ? (provenance.basedOn ?? '') : '';
      expect(
        [...sources].some((id) => basedOn.includes(id)),
        `${song.id} is based on ${basedOn}`,
      ).toBe(true);
    }
  });

  // Changed expectation (feature 022, song-definition 1.2.0 item 5, analyze H3): a simplified song and its full version
  // are listed together, simplified first, after the folder's unpaired songs - so "beginner first" now holds among the
  // unpaired songs, and each pair puts its Beginner song before its Intermediate one.
  it('songs come after the four steps of their folder, with distinct stepOrder: unpaired songs first, beginner first, then each pair, simplified first', async () => {
    const { index } = await buildLibraryIndex(libraryRoot);
    for (const key of KEYS) {
      const inFolder = index.items
        .filter((i) => i.section === `learning/keys/${key.slug}` && i.meta.step === 'song')
        .sort((a, b) => (a.meta.stepOrder ?? 0) - (b.meta.stepOrder ?? 0));
      const orders = inFolder.map((i) => i.meta.stepOrder ?? 0);
      expect(new Set(orders).size, key.slug).toBe(orders.length);
      const paired = (i: (typeof inFolder)[number]) =>
        i.id.endsWith('-simplified') || inFolder.some((j) => j.id === `${i.id}-simplified`);
      const unpaired = inFolder.filter((i) => !paired(i));
      const pairs = inFolder.filter(paired);
      expect(inFolder.slice(0, unpaired.length), key.slug).toEqual(unpaired);
      const levels = unpaired.map((i) => i.meta.level);
      expect(levels, key.slug).toEqual(
        [...levels].sort((a, b) => (a === 'beginner' ? 0 : 1) - (b === 'beginner' ? 0 : 1)),
      );
      for (let k = 0; k < pairs.length; k += 2) {
        const [simplified, full] = [pairs[k], pairs[k + 1]];
        expect(simplified?.id, key.slug).toBe(`${full?.id}-simplified`);
        expect(simplified?.meta.level, key.slug).toBe('beginner');
      }
      const fullTitles = pairs.filter((_, k) => k % 2 === 1).map((i) => i.meta.title);
      expect(fullTitles, key.slug).toEqual([...fullTitles].sort((a, b) => a.localeCompare(b)));
    }
  });
});

// Feature 011 T069 (SC-006, FR-020): every one of the 41 items the old Learning shelf held has a successor on the shelf.
describe('the successors of the old Learning shelf (feature 011 US4, SC-006)', () => {
  // Changed expectation (feature 014 FR-012): the 5 drills that got a melody start fresh (resetBy '014'), so 36 of the 41
  // old ids are claimed, each exactly once, and the 5 reset ones by no item.
  it('the 36 old ids not reset by feature 014 appear exactly once across the shelf supersedes, with the SHA-256 from main', async () => {
    const { index } = await buildLibraryIndex(libraryRoot);
    expect(SUCCESSORS).toHaveLength(41);
    expect(new Set(SUCCESSORS.map((s) => s.oldId)).size).toBe(41);
    const claims = index.items.flatMap((i) => (i.meta.supersedes ?? []).map((s) => ({ ...s, by: i.id })));
    expect(claims).toHaveLength(36);
    const reset = SUCCESSORS.filter((s) => s.resetBy === '014');
    expect(reset).toHaveLength(5);
    for (const successor of reset)
      expect(
        claims.filter((c) => c.id === successor.oldId),
        successor.oldId,
      ).toEqual([]);
    for (const successor of SUCCESSORS.filter((s) => s.resetBy === undefined)) {
      const found = claims.filter((c) => c.id === successor.oldId);
      expect(
        found.map((c) => c.by),
        successor.oldId,
      ).toEqual([successor.newId]);
      expect(found[0]?.hash, successor.oldId).toBe(successor.hash);
      expect(successor.hash, successor.oldId).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('every successor item is on the shelf', async () => {
    const { index } = await buildLibraryIndex(libraryRoot);
    const ids = new Set(index.items.map((i) => i.id));
    for (const successor of SUCCESSORS) expect(ids.has(successor.newId), successor.newId).toBe(true);
  });
});

// Feature 022 (data-model §2, library-index 1.5.0): Basics comes first, so Learning and Repertoire move down one; the
// new section ids never reuse an id a section already replaced (learning/chords is a former id of Keys).
describe('022 section order (library-index 1.5.0 item 5)', () => {
  it('learning has order 2 and repertoire order 3', async () => {
    const { index } = await buildLibraryIndex(libraryRoot);
    expect(index.sections.find((s) => s.id === 'learning')?.order).toBe(2);
    expect(index.sections.find((s) => s.id === 'repertoire')?.order).toBe(3);
  });

  it('no section id equals a formerIds entry of any section', () => {
    const former = new Set(LIBRARY_SECTIONS.flatMap((s) => s.formerIds ?? []));
    expect(LIBRARY_SECTIONS.filter((s) => former.has(s.id)).map((s) => s.id)).toEqual([]);
  });

  it('declares basics and the three chord-lesson folders with the titles of data-model §2', () => {
    const pick = (id: string) => {
      const s = LIBRARY_SECTIONS.find((x) => x.id === id);
      return s && { title: s.title, description: s.description, parent: s.parent, order: s.order, path: s.path };
    };
    expect(pick('basics')).toEqual({
      title: 'Basics',
      description: 'Reading music from the first note: note lengths, rests, ties, slurs, time.',
      parent: null,
      order: 1,
      path: 'basics',
    });
    expect(pick('learning/chord-lessons')).toEqual({
      title: 'Chords',
      description: 'Chords one at a time, switching between two, then progressions.',
      parent: 'learning',
      order: 3,
      path: 'learning/chord-lessons',
    });
    expect(pick('learning/chord-lessons/single-chords')).toEqual({
      title: 'One chord',
      description: 'One chord type and its inversions.',
      parent: 'learning/chord-lessons',
      order: 1,
      path: 'learning/chord-lessons/single-chords',
    });
    expect(pick('learning/chord-lessons/switches')).toEqual({
      title: 'Chord switches',
      description: 'From one chord to another with the least movement.',
      parent: 'learning/chord-lessons',
      order: 2,
      path: 'learning/chord-lessons/switches',
    });
    expect(pick('learning/chord-lessons/progressions')).toEqual({
      title: 'Progressions',
      description: 'Common chord sequences, in several keys.',
      parent: 'learning/chord-lessons',
      order: 3,
      path: 'learning/chord-lessons/progressions',
    });
  });

  it('sibling order values stay unique', () => {
    const seen = new Map<string, string>();
    for (const s of LIBRARY_SECTIONS) {
      const key = `${s.parent}|${s.order}`;
      expect(seen.get(key), `${s.id} shares order ${s.order} with ${seen.get(key)}`).toBeUndefined();
      seen.set(key, s.id);
    }
  });
});

// Feature 022 (library-index 1.5.0 item 1): `simplifies` names the item a simplified version simplifies; the build
// fails unless that item exists, sits in the same section and has a higher level.
describe('022 simplifies (library-index 1.5.0 item 1)', () => {
  const SECTIONS: readonly LibrarySectionDefinition[] = [
    { id: 'repertoire', title: 'Repertoire', path: 'repertoire', parent: null, order: 1 },
    { id: 'repertoire/beginner', title: 'Beginner', path: 'repertoire/beginner', parent: 'repertoire', order: 1 },
    { id: 'repertoire/other', title: 'Other', path: 'repertoire/other', parent: 'repertoire', order: 2 },
  ];
  const ATTRIBUTES =
    '<attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves></attributes>' +
    '<direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>60</per-minute></metronome></direction-type><sound tempo="60"/></direction>';
  const BAR =
    '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>whole</type><staff>1</staff></note>' +
    '<backup><duration>4</duration></backup>' +
    '<note><pitch><step>C</step><octave>3</octave></pitch><duration>4</duration><voice>5</voice><type>whole</type><staff>2</staff></note>';
  /** 16 bars (inside both the Beginner and the Intermediate bar ranges) of whole notes at 60 qpm, one per hand. */
  const XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">${Array.from(
    { length: 16 },
    (_, i) => `<measure number="${i + 1}">${i === 0 ? ATTRIBUTES : ''}${BAR}</measure>`,
  ).join('')}</part></score-partwise>`;

  async function build(items: { id: string; level: string; simplifies?: string }[]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'musicanyya-simplifies-'));
    try {
      for (const item of items) {
        const file = path.join(root, item.id);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(`${file}.musicxml`, XML);
        fs.writeFileSync(
          `${file}.json`,
          JSON.stringify({
            version: 1,
            title: item.id,
            kind: 'piece',
            level: item.level,
            tags: ['chords'],
            provenance: { origin: 'authored', licence: 'CC0-1.0', author: 'Test', created: '2026-10-03' },
            reviewedBy: 'test',
            reviewedOn: '2026-10-03',
            raisedBecause: 'test data: the same music at a higher level',
            ...(item.simplifies !== undefined ? { simplifies: item.simplifies } : {}),
          }),
        );
      }
      return await buildLibraryIndex(root, '', SECTIONS);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }

  it('accepts a simplified item whose target exists in the same section at a higher level', async () => {
    const { problems } = await build([
      { id: 'repertoire/beginner/tune', level: 'intermediate' },
      { id: 'repertoire/beginner/tune-simplified', level: 'beginner', simplifies: 'repertoire/beginner/tune' },
    ]);
    expect(problems).toEqual([]);
  });

  it('refuses a missing target, naming both ids', async () => {
    const { problems } = await build([
      { id: 'repertoire/beginner/tune-simplified', level: 'beginner', simplifies: 'repertoire/beginner/tune' },
    ]);
    expect(problems).toContain(
      'repertoire/beginner/tune-simplified: simplifies repertoire/beginner/tune, which does not exist',
    );
  });

  it('refuses a target in another section, naming both ids', async () => {
    const { problems } = await build([
      { id: 'repertoire/other/tune', level: 'intermediate' },
      { id: 'repertoire/beginner/tune-simplified', level: 'beginner', simplifies: 'repertoire/other/tune' },
    ]);
    expect(problems).toContain(
      'repertoire/beginner/tune-simplified: simplifies repertoire/other/tune, which is in another section (repertoire/other)',
    );
  });

  it('refuses a target that is not of a higher level, naming both ids', async () => {
    const { problems } = await build([
      { id: 'repertoire/beginner/tune', level: 'beginner' },
      { id: 'repertoire/beginner/tune-simplified', level: 'beginner', simplifies: 'repertoire/beginner/tune' },
    ]);
    expect(problems).toContain(
      'repertoire/beginner/tune-simplified: simplifies repertoire/beginner/tune, which is beginner - it needs a higher level than beginner',
    );
  });
});
