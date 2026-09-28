import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  type GeneratedExerciseItem,
  generateKeyChangeFamily,
  generatePatternFamily,
} from '../../../../src/core/library/exercise/generate.js';
import { KEY_CHANGE_PAIRS, KEYS } from '../../../../src/core/library/exercise/keys.js';
import type { ExerciseDefinition } from '../../../../src/core/library/exercise/types.js';
import { checkStepOrder } from '../../../../src/core/library/step-order.js';
import type { ItemFacts, LibraryItem, Step } from '../../../../src/core/library/types.js';
import { attacks, factsOf, levelCheckOf, notesOf, type TestNote } from './support.js';

// Feature 011 T018 (spec FR-006-FR-012, FR-022, SC-002, SC-003; research R6): the four step definitions, each
// generated in all 24 keys.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.join(__dirname, '../../../../content/library/exercises');

function load(file: string): ExerciseDefinition {
  return JSON.parse(fs.readFileSync(path.join(contentDir, file), 'utf-8')) as ExerciseDefinition;
}

const STEP_FILES: Record<'introduction' | 'beginner' | 'intermediate' | 'advanced', string> = {
  introduction: 'step-introduction.json',
  beginner: 'step-beginner.json',
  intermediate: 'step-intermediate.json',
  advanced: 'step-advanced.json',
};

interface Built {
  item: GeneratedExerciseItem;
  key: (typeof KEYS)[number];
  notes: TestNote[];
  facts: ItemFacts;
}

const definitions = Object.fromEntries(Object.entries(STEP_FILES).map(([step, file]) => [step, load(file)])) as Record<
  keyof typeof STEP_FILES,
  ExerciseDefinition
>;

const built = Object.fromEntries(
  (Object.keys(STEP_FILES) as (keyof typeof STEP_FILES)[]).map((step) => {
    const items = generatePatternFamily(definitions[step], '2026-09-26');
    const rows: Built[] = items.map((item, i) => {
      const key = KEYS[i];
      if (!key) throw new Error('more items than keys');
      return { item, key, notes: notesOf(item.xml), facts: factsOf(item.xml) };
    });
    return [step, rows];
  }),
) as Record<keyof typeof STEP_FILES, Built[]>;

/** Pitch classes of a triad on `root` (semitones above the tonic) with `third` and the fifth 7 above. */
const triadPcs = (tonicPc: number, root: number, third: number) =>
  new Set([root, root + third, root + 7].map((n) => (((tonicPc + n) % 12) + 12) % 12));

function tonicPc(key: (typeof KEYS)[number]): number {
  const natural: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  return (
    ((natural[key.tonic[0] ?? 'C'] ?? 0) + (key.tonic.endsWith('#') ? 1 : key.tonic.endsWith('b') ? -1 : 0) + 12) % 12
  );
}

/** Every chord (attack of two or more notes) of the score: bar, staff, the notes. */
function chordsOf(notes: readonly TestNote[]) {
  const out: { measure: number; staff: number; notes: TestNote[] }[] = [];
  const measures = Math.max(...notes.map((n) => n.measure));
  for (let m = 1; m <= measures; m++) {
    for (const staff of [1, 2]) {
      for (const group of attacks(notes, staff, m)) {
        if (group.length >= 2) out.push({ measure: m, staff, notes: group });
      }
    }
  }
  return out;
}

const pcsOf = (chord: { notes: readonly TestNote[] }) => new Set(chord.notes.map((n) => n.midi % 12));
const sameSet = (a: ReadonlySet<number>, b: ReadonlySet<number>) => a.size === b.size && [...a].every((x) => b.has(x));

describe('the four step definitions cover the 24 keys of the table', () => {
  it.each(Object.entries(definitions))('%s: keys equal the key table in circle order', (_step, definition) => {
    expect(definition.form).toBe('pattern');
    expect(definition.keys.map((k) => ({ tonic: k.tonic, mode: k.mode, fifths: k.fifths }))).toEqual(
      KEYS.map((k) => ({ tonic: k.tonic, mode: k.mode, fifths: k.fifths })),
    );
    expect(definition.section).toBe('learning/keys/{key}');
    expect(definition.stepOrder ?? 0).toBe(0);
  });

  it.each(Object.entries(STEP_FILES))('%s: generates one item per key with the fixed file stem', (step, _file) => {
    const rows = built[step as keyof typeof STEP_FILES];
    expect(rows).toHaveLength(24);
    expect(rows.map((r) => r.item.fileStem)).toEqual(Array(24).fill(step));
    expect(rows.map((r) => r.item.section)).toEqual(KEYS.map((k) => `learning/keys/${k.slug}`));
    expect(rows.map((r) => r.item.meta.title)).toEqual(KEYS.map((k) => `${k.displayName} - ${step}`));
    expect(rows.every((r) => r.item.meta.step === step && r.item.meta.level === step)).toBe(true);
  });
});

describe('Introduction (FR-007, SC-003)', () => {
  const rows = built.introduction;

  it('is 10 bars at quarter = 60 in every key', () => {
    for (const { notes, facts, key } of rows) {
      expect(Math.max(...notes.map((n) => n.measure)), key.slug).toBe(10);
      expect(facts.tempoBpm, key.slug).toBe(60);
    }
  });

  it('one hand plays the scale in quarter notes (closing on a whole note), the other only chords', () => {
    for (const { notes, key } of rows) {
      for (let m = 1; m <= 10; m++) {
        const scaleStaff = m <= 5 ? 1 : 2;
        const chordStaff = m <= 5 ? 2 : 1;
        const scale = notes.filter((n) => n.measure === m && n.staff === scaleStaff);
        expect(
          scale.map((n) => n.duration),
          `${key.slug} bar ${m}`,
        ).toEqual(m === 5 || m === 10 ? [3840] : [960, 960, 960, 960]);
        expect(
          attacks(notes, chordStaff, m).every((g) => g.length === 3),
          `${key.slug} bar ${m}`,
        ).toBe(true);
      }
    }
  });

  it('the chord hand plays only I and V in root position, at most one chord onset per bar', () => {
    for (const { notes, key } of rows) {
      const tpc = tonicPc(key);
      const third = key.mode === 'major' ? 4 : 3;
      const I = triadPcs(tpc, 0, third);
      const V = triadPcs(tpc, 7, 4); // V is major in both modes (the raised leading tone)
      for (const chord of chordsOf(notes)) {
        const pcs = pcsOf(chord);
        expect(sameSet(pcs, I) || sameSet(pcs, V), `${key.slug} bar ${chord.measure}`).toBe(true);
        // root position: the lowest note is the root
        const bass = Math.min(...chord.notes.map((n) => n.midi)) % 12;
        expect([tpc, (tpc + 7) % 12], `${key.slug} bar ${chord.measure}`).toContain(bass);
      }
      for (let m = 1; m <= 10; m++) {
        const chordOnsets = chordsOf(notes).filter((c) => c.measure === m).length;
        expect(chordOnsets, `${key.slug} bar ${m}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is at least 10% slower than Beginner in every key', () => {
    for (let i = 0; i < 24; i++) {
      const intro = built.introduction[i]?.facts.tempoBpm ?? 0;
      const beginner = built.beginner[i]?.facts.tempoBpm ?? 0;
      expect(intro, KEYS[i]?.slug).toBeLessThanOrEqual(0.9 * beginner);
    }
  });
});

describe('Beginner (FR-008)', () => {
  const rows = built.beginner;

  it('is 10 bars at quarter = 72; the scale is against half-note chords; the hands swap at bar 6', () => {
    for (const { notes, facts, key } of rows) {
      expect(Math.max(...notes.map((n) => n.measure)), key.slug).toBe(10);
      expect(facts.tempoBpm, key.slug).toBe(72);
      for (let m = 1; m <= 10; m++) {
        const scaleStaff = m <= 5 ? 1 : 2;
        const scale = notes.filter((n) => n.measure === m && n.staff === scaleStaff);
        expect(
          scale.every((n) => [960, 3840].includes(n.duration)),
          `${key.slug} bar ${m}`,
        ).toBe(true);
        const chordStaff = m <= 5 ? 2 : 1;
        expect(
          attacks(notes, chordStaff, m).every((g) => g.length === 3 && [1920, 3840].includes(g[0]?.duration ?? 0)),
        ).toBe(true);
      }
    }
  });

  it('the chords are I, IV and V in root position', () => {
    for (const { notes, key } of rows) {
      const tpc = tonicPc(key);
      const third = key.mode === 'major' ? 4 : 3;
      const allowed = [triadPcs(tpc, 0, third), triadPcs(tpc, 5, key.mode === 'major' ? 4 : 3), triadPcs(tpc, 7, 4)];
      const bassOk = [tpc, (tpc + 5) % 12, (tpc + 7) % 12];
      for (const chord of chordsOf(notes)) {
        expect(
          allowed.some((a) => sameSet(a, pcsOf(chord))),
          `${key.slug} bar ${chord.measure}`,
        ).toBe(true);
        expect(bassOk).toContain(Math.min(...chord.notes.map((n) => n.midi)) % 12);
      }
    }
  });
});

describe('Intermediate (FR-009)', () => {
  const rows = built.intermediate;

  it('is at quarter = 80 and adds inversions', () => {
    for (const { notes, facts, key } of rows) {
      expect(facts.tempoBpm, key.slug).toBe(80);
      const tpc = tonicPc(key);
      const roots = [tpc, (tpc + 5) % 12, (tpc + 7) % 12];
      const inverted = chordsOf(notes).filter((c) => !roots.includes(Math.min(...c.notes.map((n) => n.midi)) % 12));
      expect(inverted.length, key.slug).toBeGreaterThan(0);
    }
  });

  it('has a passage where both hands play chords in the same bar', () => {
    for (const { notes, key } of rows) {
      const both = [...new Set(chordsOf(notes).map((c) => c.measure))].filter(
        (m) =>
          chordsOf(notes).some((c) => c.measure === m && c.staff === 1) &&
          chordsOf(notes).some((c) => c.measure === m && c.staff === 2),
      );
      expect(both.length, key.slug).toBeGreaterThan(0);
    }
  });

  it('names the melodic minor scale in minor keys', () => {
    for (const { item, key } of rows) {
      if (key.mode === 'minor') expect(item.xml, key.slug).toContain('melodic minor');
      else expect(item.xml, key.slug).not.toContain('minor scale');
    }
  });
});

describe('Advanced (FR-009)', () => {
  const rows = built.advanced;

  it('is at quarter = 96, has eighth notes and a four-chord progression with vi or ii (VI or iv in minor)', () => {
    for (const { notes, facts, key } of rows) {
      expect(facts.tempoBpm, key.slug).toBe(96);
      expect(
        notes.some((n) => n.duration === 480),
        key.slug,
      ).toBe(true);
      const tpc = tonicPc(key);
      const minorChord =
        key.mode === 'major' ? [triadPcs(tpc, 9, 3), triadPcs(tpc, 2, 3)] : [triadPcs(tpc, 8, 4), triadPcs(tpc, 5, 3)];
      const chords = chordsOf(notes);
      expect(
        chords.some((c) => minorChord.some((m) => sameSet(m, pcsOf(c)))),
        key.slug,
      ).toBe(true);
      // a bar with four chords in a row on one staff (the progression)
      const perBar = new Map<string, number>();
      for (const c of chords) perBar.set(`${c.measure}:${c.staff}`, (perBar.get(`${c.measure}:${c.staff}`) ?? 0) + 1);
      expect(Math.max(...perBar.values()), key.slug).toBeGreaterThanOrEqual(4);
    }
  });
});

describe('FR-011: every step has the same shape in every key', () => {
  it.each(Object.keys(STEP_FILES))('%s: identical rhythm, staves and chord sizes across the 24 keys', (step) => {
    const rows = built[step as keyof typeof STEP_FILES];
    const shape = (notes: readonly TestNote[]) =>
      notes.map((n) => `${n.measure}/${n.staff}/${n.onset}/${n.duration}/${n.finger === null ? '-' : 'f'}`);
    const [reference, ...rest] = rows;
    if (!reference) throw new Error('no items');
    for (const row of rest) expect(shape(row.notes), row.key.slug).toEqual(shape(reference.notes));
  });

  it.each(Object.keys(STEP_FILES))(
    '%s: the degree sequence (intervals inside the chords and the scale) is identical',
    (step) => {
      const rows = built[step as keyof typeof STEP_FILES];
      // the chord shapes: number of notes per attack and their intervals above the lowest note
      const chordShape = (notes: readonly TestNote[]) =>
        chordsOf(notes).map((c) => c.notes.map((n) => n.midi - Math.min(...c.notes.map((x) => x.midi))).join(','));
      const majorRows = rows.filter((r) => r.key.mode === 'major');
      const [reference, ...rest] = majorRows;
      if (!reference) throw new Error('no items');
      for (const row of rest) expect(chordShape(row.notes), row.key.slug).toEqual(chordShape(reference.notes));
    },
  );
});

describe('level, step order and hand independence (FR-010, FR-022, SC-002)', () => {
  it.each(Object.keys(STEP_FILES))('%s: every item passes its own level', (step) => {
    for (const { item, facts, key } of built[step as keyof typeof STEP_FILES]) {
      const check = levelCheckOf(facts, item.meta);
      expect(check.failed, `${key.slug} ${step}`).toEqual([]);
      expect(check.pass, `${key.slug} ${step}`).toBe(true);
    }
  });

  it('every key folder is in step order', () => {
    const items: Pick<LibraryItem, 'id' | 'section' | 'meta' | 'facts'>[] = [];
    for (const step of Object.keys(STEP_FILES) as (keyof typeof STEP_FILES)[]) {
      for (const { item, facts } of built[step]) {
        items.push({ id: `${item.section}/${item.fileStem}`, section: item.section, meta: item.meta, facts });
      }
    }
    expect(checkStepOrder(items)).toEqual([]);
  });

  it('hand independence is 0 in every step and key (B1)', () => {
    for (const step of Object.keys(STEP_FILES) as (keyof typeof STEP_FILES)[]) {
      for (const { facts, key } of built[step]) expect(facts.handIndependenceFraction, `${key.slug} ${step}`).toBe(0);
    }
  });

  it('chordChangesPerBar, notesPerBeat and tempo rise strictly enough that no step is easier than the one before', () => {
    const order: Step[] = ['introduction', 'beginner', 'intermediate', 'advanced'];
    for (let i = 0; i < 24; i++) {
      for (let s = 1; s < order.length; s++) {
        const before = built[order[s - 1] as keyof typeof STEP_FILES][i]?.facts;
        const after = built[order[s] as keyof typeof STEP_FILES][i]?.facts;
        expect(after?.tempoBpm ?? 0).toBeGreaterThan(before?.tempoBpm ?? 0);
        expect(after?.notesPerBeat ?? 0).toBeGreaterThanOrEqual(before?.notesPerBeat ?? 0);
        expect(after?.chordChangesPerBar ?? 0).toBeGreaterThanOrEqual(before?.chordChangesPerBar ?? 0);
      }
    }
  });

  it("raisedBecause is present exactly when the computed level is below the step's level (analyze A3)", () => {
    for (const step of Object.keys(STEP_FILES) as (keyof typeof STEP_FILES)[]) {
      const needs = built[step].map(({ item, facts }) => !levelCheckOf(facts, item.meta, false).pass);
      const declared = built[step].map(({ item }) => item.meta.raisedBecause !== undefined);
      expect(declared, step).toEqual(needs);
    }
  });

  it('every item has full fingering coverage and no load notices', () => {
    for (const step of Object.keys(STEP_FILES) as (keyof typeof STEP_FILES)[]) {
      for (const { facts, key } of built[step]) {
        expect(facts.fingeringCoverage, `${key.slug} ${step}`).toBe(1);
        expect(facts.notices, `${key.slug} ${step}`).toEqual([]);
      }
    }
  });
});

describe('minor keys name the scale form in their section labels (spec edge case, analyze A8)', () => {
  it.each(['introduction', 'beginner', 'advanced'] as const)('%s uses harmonic minor', (step) => {
    for (const { item, key } of built[step]) {
      if (key.mode === 'minor') expect(item.xml, key.slug).toContain('harmonic minor');
    }
  });
  it('the facts report a minor key for a minor exercise', () => {
    for (const { facts, key } of built.beginner) {
      expect(facts.keys, key.slug).toEqual([key.displayName]);
    }
  });
});

// Feature 011 T041 (US2, research R7, data-model §2-3): the three key-change definitions (one file per relation),
// generated over all 18 pairs.

const KEY_CHANGE_STEP_FILES: Record<'introduction' | 'beginner' | 'intermediate', [string, string]> = {
  introduction: ['key-change-relative-introduction.json', 'key-change-parallel-introduction.json'],
  beginner: ['key-change-relative-beginner.json', 'key-change-parallel-beginner.json'],
  intermediate: ['key-change-relative-intermediate.json', 'key-change-parallel-intermediate.json'],
};
const KEY_CHANGE_BARS: Record<'introduction' | 'beginner' | 'intermediate', number> = {
  introduction: 12,
  beginner: 11,
  intermediate: 9,
};
const KEY_CHANGE_TEMPO: Record<'introduction' | 'beginner' | 'intermediate', number> = {
  introduction: 60,
  beginner: 72,
  intermediate: 80,
};

interface BuiltPair {
  item: GeneratedExerciseItem;
  slug: string;
  relation: 'relative' | 'parallel';
  notes: TestNote[];
  facts: ItemFacts;
}

const keyChangeBuilt = Object.fromEntries(
  (Object.keys(KEY_CHANGE_STEP_FILES) as (keyof typeof KEY_CHANGE_STEP_FILES)[]).map((step) => {
    const rows: BuiltPair[] = [];
    for (const file of KEY_CHANGE_STEP_FILES[step]) {
      const definition = load(file);
      for (const item of generateKeyChangeFamily(definition, '2026-09-26')) {
        const slug = item.section.replace('learning/key-changes/', '');
        const pair = KEY_CHANGE_PAIRS.find((p) => p.slug === slug);
        if (!pair) throw new Error(`no KEY_CHANGE_PAIRS entry for ${slug}`);
        rows.push({ item, slug, relation: pair.relation, notes: notesOf(item.xml), facts: factsOf(item.xml) });
      }
    }
    return [step, rows];
  }),
) as Record<keyof typeof KEY_CHANGE_STEP_FILES, BuiltPair[]>;

describe('key-change steps cover all 18 pairs (T041)', () => {
  it.each(Object.keys(KEY_CHANGE_STEP_FILES) as (keyof typeof KEY_CHANGE_STEP_FILES)[])(
    '%s: one item per pair, 18 total',
    (step) => {
      const rows = keyChangeBuilt[step];
      expect(rows).toHaveLength(18);
      expect(new Set(rows.map((r) => r.slug)).size).toBe(18);
      expect(rows.every((r) => r.item.fileStem === step)).toBe(true);
      expect(rows.every((r) => r.item.meta.step === step && r.item.meta.level === step)).toBe(true);
    },
  );

  // Feature 014 (FR-002, T061): the left hand keeps its whole-note chords; the right hand, which doubled them, now plays
  // a single-note melody no shorter than the level's ladder value (half / quarter / eighth), filling every bar.
  const SHORTEST_RIGHT_HAND_TICKS = { introduction: 1920, beginner: 960, intermediate: 480 } as const;
  it.each(Object.entries(KEY_CHANGE_BARS))(
    '%s: is %i bars at the right tempo, left-hand whole-note chords under a single-note right hand',
    (step, bars) => {
      for (const { notes, facts, slug } of keyChangeBuilt[step as keyof typeof KEY_CHANGE_BARS]) {
        expect(Math.max(...notes.map((n) => n.measure)), slug).toBe(bars);
        expect(facts.tempoBpm, slug).toBe(KEY_CHANGE_TEMPO[step as keyof typeof KEY_CHANGE_TEMPO]);
        const left = notes.filter((n) => n.staff === 2);
        const right = notes.filter((n) => n.staff === 1);
        expect(
          left.every((n) => n.duration === 3840),
          slug,
        ).toBe(true);
        expect(new Set(right.map((n) => `${n.measure}/${n.onset}`)).size, slug).toBe(right.length);
        expect(Math.min(...right.map((n) => n.duration)), slug).toBeGreaterThanOrEqual(
          SHORTEST_RIGHT_HAND_TICKS[step as keyof typeof SHORTEST_RIGHT_HAND_TICKS],
        );
        for (let m = 1; m <= bars; m++)
          expect(
            right.filter((n) => n.measure === m).reduce((sum, n) => sum + n.duration, 0),
            `${slug} bar ${m}`,
          ).toBe(3840);
      }
    },
  );

  it('Intermediate has a passage where both hands play in the same bar', () => {
    for (const { notes, slug } of keyChangeBuilt.intermediate) {
      const bothHands = new Set(notes.filter((n) => n.staff === 1).map((n) => n.measure)).intersection(
        new Set(notes.filter((n) => n.staff === 2).map((n) => n.measure)),
      );
      expect(bothHands.size, slug).toBeGreaterThan(0);
    }
  });

  it('every item passes its own level', () => {
    for (const step of Object.keys(KEY_CHANGE_STEP_FILES) as (keyof typeof KEY_CHANGE_STEP_FILES)[]) {
      for (const { item, facts, slug } of keyChangeBuilt[step]) {
        const check = levelCheckOf(facts, item.meta);
        expect(check.failed, `${slug} ${step}`).toEqual([]);
        expect(check.pass, `${slug} ${step}`).toBe(true);
      }
    }
  });

  it('every key-change folder is in step order (introduction, beginner, intermediate)', () => {
    const items: Pick<LibraryItem, 'id' | 'section' | 'meta' | 'facts'>[] = [];
    for (const step of Object.keys(KEY_CHANGE_STEP_FILES) as (keyof typeof KEY_CHANGE_STEP_FILES)[]) {
      for (const { item, facts } of keyChangeBuilt[step]) {
        items.push({ id: `${item.section}/${item.fileStem}`, section: item.section, meta: item.meta, facts });
      }
    }
    expect(checkStepOrder(items)).toEqual([]);
  });

  // Feature 014 (T061): the right hand's melody varies from pair to pair (FR-008), so only the left hand keeps one
  // rhythm across a relation.
  it.each(['relative', 'parallel'] as const)(
    '%s: identical left-hand rhythm and staves in every pair of the relation (FR-011)',
    (relation) => {
      for (const step of Object.keys(KEY_CHANGE_STEP_FILES) as (keyof typeof KEY_CHANGE_STEP_FILES)[]) {
        const rows = keyChangeBuilt[step].filter((r) => r.relation === relation);
        const shape = (notes: readonly TestNote[]) =>
          notes.filter((n) => n.staff === 2).map((n) => `${n.measure}/${n.staff}/${n.onset}/${n.duration}`);
        const [reference, ...rest] = rows;
        if (!reference) throw new Error('no items');
        for (const row of rest) expect(shape(row.notes), `${step} ${row.slug}`).toEqual(shape(reference.notes));
      }
    },
  );

  // Unlike the four single-key steps (one file, one `meta.raisedBecause` per whole shelf), a key-change file's
  // `meta` is shared by all 18 (or however many of one relation) pairs, so `raisedBecause` cannot follow the exact
  // per-item rule T018 established (analyze A3) - it can only say "at least one pair here needs it". Every pair
  // that actually needs it must have it (this is the part that would silently break a real gap); a pair that
  // doesn't need it but gets it anyway is the accepted cost of one string covering the whole file.
  it('every pair that needs raisedBecause has it (a uniform raisedBecause covers the whole file - FR-022)', () => {
    for (const step of Object.keys(KEY_CHANGE_STEP_FILES) as (keyof typeof KEY_CHANGE_STEP_FILES)[]) {
      for (const { item, facts, slug } of keyChangeBuilt[step]) {
        const needsRaised = !levelCheckOf(facts, item.meta, false).pass;
        if (needsRaised) expect(item.meta.raisedBecause, `${step} ${slug}`).toBeDefined();
      }
    }
  });
});
