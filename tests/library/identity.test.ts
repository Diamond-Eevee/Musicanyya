import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildLibraryIdentity,
  gradeSavedPerformanceLog,
  type LibraryIdentityGolden,
} from '../../tools/library/identity.js';
import { SUCCESSORS } from '../../tools/library/successors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const libraryRoot = path.resolve(__dirname, '../../public/library');
const goldenPath = path.resolve(__dirname, '../fixtures/library-identity.json');
const performanceLogPath = path.resolve(__dirname, '../fixtures/performance-logs/fur-elise-theme.json');

// Feature 022 T020 (research R9, owner decision OD-3) re-recorded the schedule digests of the four Scores with printed
// staccato (Burgmüller Op. 100 Nos. 2 and 5, both Morning Moods): their staccato notes now sound for half their length.
// Their Note IDs, onsets, durations and keys are unchanged.
describe('library identity golden (SC-003, FR-005)', () => {
  it('every library file rebuilds the same Note IDs, onsets, durations and keys as the golden captured before completion', async () => {
    const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf-8')) as LibraryIdentityGolden;
    const { golden: rebuilt } = await buildLibraryIdentity(libraryRoot);

    expect(rebuilt.items.map((i) => i.file)).toEqual(golden.items.map((i) => i.file));
    expect(rebuilt.items).toEqual(golden.items);
  });

  it('grading the saved recorded performance against the now-completed Für Elise (theme) equals the golden Grade exactly (T050)', async () => {
    const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf-8')) as LibraryIdentityGolden;
    const grade = await gradeSavedPerformanceLog(libraryRoot, performanceLogPath);
    expect(grade).toEqual(golden.furEliseThemeGrade);
  });
});

// Feature 011 T087 (data-model §7, FR-005, FR-020): every old Learning item has exactly one successor, and the definitions
// that write the successors' `supersedes` agree with the table.
describe('the successor table (feature 011 data-model §7)', () => {
  const contentDir = path.resolve(__dirname, '../../content/library/exercises');
  interface SupersedingDefinition {
    section: string;
    fileStem?: string;
    supersedes?: Record<string, string[]>;
  }
  const definitions = fs
    .readdirSync(contentDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(contentDir, f), 'utf-8')) as SupersedingDefinition);

  it('has the 41 old Learning items of the audited shelf, each once, all under learning/chords/', () => {
    expect(SUCCESSORS).toHaveLength(41);
    const oldIds = SUCCESSORS.map((s) => s.oldId);
    expect(new Set(oldIds).size).toBe(41);
    expect(oldIds.every((id) => id.startsWith('learning/chords/'))).toBe(true);
    expect(oldIds.filter((id) => id.startsWith('learning/chords/triads-'))).toHaveLength(24);
    expect(oldIds.filter((id) => id.startsWith('learning/chords/changes/'))).toHaveLength(16);
    expect(oldIds).toContain('learning/chords/c-major-scale-and-chords');
  });

  it('maps every old id to exactly one new id under learning/keys or learning/key-changes, with a SHA-256', () => {
    for (const s of SUCCESSORS) {
      expect(s.newId, s.oldId).toMatch(/^learning\/(keys|key-changes)\/[a-z0-9-]+\/[a-z0-9-]+$/);
      expect(s.hash, s.oldId).toMatch(/^[0-9a-f]{64}$/);
      expect(['superseded', 'moved']).toContain(s.kind);
    }
  });

  it("every triads drill is superseded by its own key's Intermediate step", () => {
    for (const s of SUCCESSORS.filter((x) => x.oldId.startsWith('learning/chords/triads-'))) {
      const slug = s.oldId.replace('learning/chords/triads-', '');
      expect(s.newId).toBe(`learning/keys/${slug}/intermediate`);
      expect(s.kind).toBe('superseded');
    }
  });

  it('the five drills that keep their music are moved, the other 36 superseded (research R12)', () => {
    expect(
      SUCCESSORS.filter((s) => s.kind === 'moved')
        .map((s) => [s.oldId, s.newId])
        .sort(),
    ).toEqual(
      [
        ['learning/chords/changes/changes-i-v-vi-iv-c-major', 'learning/keys/c-major/i-v-vi-iv'],
        ['learning/chords/changes/changes-turnaround-c-major', 'learning/keys/c-major/turnaround'],
        ['learning/chords/changes/changes-diatonic-ladder-c-major', 'learning/keys/c-major/diatonic-ladder'],
        [
          'learning/chords/changes/changes-same-tonic-c-major',
          'learning/key-changes/c-major-to-c-minor/major-and-minor',
        ],
        [
          'learning/chords/changes/changes-a-minor-major-a-minor',
          'learning/key-changes/a-minor-to-a-major/minor-and-major',
        ],
      ].sort(),
    );
  });

  // Feature 014 FR-012 (owner decision 2026-09-28, research R9): the five moved drills got a melody, so they start fresh -
  // their entries stay as history for the audit report but are marked `resetBy: '014'`, and nothing supersedes them.
  it("the five moved drills are reset by feature 014 (resetBy '014'), the other 36 are not", () => {
    const reset = SUCCESSORS.filter((s) => s.resetBy === '014');
    expect(reset.map((s) => s.oldId).sort()).toEqual(
      SUCCESSORS.filter((s) => s.kind === 'moved')
        .map((s) => s.oldId)
        .sort(),
    );
    expect(reset).toHaveLength(5);
    expect(SUCCESSORS.filter((s) => s.resetBy === undefined)).toHaveLength(36);
  });

  it('no definition supersedes an old id that feature 014 reset', () => {
    const reset = new Set(SUCCESSORS.filter((s) => s.resetBy === '014').map((s) => s.oldId));
    for (const definition of definitions)
      for (const oldIds of Object.values(definition.supersedes ?? {}))
        for (const oldId of oldIds) expect(reset.has(oldId), oldId).toBe(false);
  });

  it("the definitions' `supersedes` agree with the table: same new id for the same old id", () => {
    const fromDefinitions = new Map<string, string>();
    for (const definition of definitions) {
      for (const [slug, oldIds] of Object.entries(definition.supersedes ?? {})) {
        const newId = `${definition.section.replace(/\{(key|pair)\}/, slug)}/${definition.fileStem}`;
        for (const oldId of oldIds) {
          expect(fromDefinitions.has(oldId), `${oldId} is superseded by two definitions`).toBe(false);
          fromDefinitions.set(oldId, newId);
        }
      }
    }
    expect(fromDefinitions.size).toBeGreaterThan(0);
    for (const [oldId, newId] of fromDefinitions) {
      expect(SUCCESSORS.find((s) => s.oldId === oldId)?.newId, oldId).toBe(newId);
    }
  });
});
