import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildLibraryIndex } from '../../tools/library/build-index.js';

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
