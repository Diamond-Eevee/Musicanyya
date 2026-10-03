// Feature 014: Melody sweep over the 54 key-change exercises on the shelf (FR-001, FR-002, FR-008, FR-011, US1, US2).
// Each item must satisfy checkMelodyRules at its level (0 findings: 0 doubled bars, chord tones on chord starts,
// minor degrees, ending, key-change audibility, register, fingering), checkMelodyVariation across its family group
// (0 findings), and its left-hand notes must match commit 7f8ab96 recorded in key-change-left-hand.json.
// In each folder, checkStepOrder returns no messages, checkLevel passes with no raisedBecause, and the melody ladder
// dimensions grow step by step (beginner not easier than introduction, intermediate not easier than beginner).
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MELODY_LADDER } from '../../src/core/defaults';
import { checkLevel } from '../../src/core/library/levels';
import { checkStepOrder } from '../../src/core/library/step-order';
import type { Level, LibraryItem } from '../../src/core/library/types';
import { claimForItem } from '../../tools/library/fidelity/exercise-claims';
import {
  checkMelodyRules,
  checkMelodyVariation,
  type MelodyCheckInput,
  type MelodyFinding,
  melodyDegrees,
} from '../../tools/library/fidelity/melody-rules';
import { songKeyOfItemId } from '../../tools/library/fidelity/song-chords';
import { type KeyClaim, readScore } from '../../tools/library/fidelity/theory';
import inScopeMetadata from './in-scope-metadata.json';
import recordedLeftHand from './key-change-left-hand.json';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const libRoot = path.join(root, 'public/library');
const indexJson = JSON.parse(fs.readFileSync(path.join(libRoot, 'index.json'), 'utf8'));

interface ShelfItem {
  id: string;
  title: string;
  section: string;
  level: Level;
  xml: string;
  trains: string;
  item: LibraryItem;
}

const keyChangeItems: ShelfItem[] = (indexJson.items as LibraryItem[])
  .filter(
    (i) =>
      i.section.startsWith('learning/key-changes') &&
      !i.id.endsWith('major-and-minor') &&
      !i.id.endsWith('minor-and-major'),
  )
  .map((i) => {
    const xml = fs.readFileSync(path.join(libRoot, `${i.id}.musicxml`), 'utf8');
    const sidecar = JSON.parse(fs.readFileSync(path.join(libRoot, `${i.id}.json`), 'utf8')) as {
      trains?: string;
    };
    return {
      id: i.id,
      title: i.meta.title,
      section: i.section,
      level: i.meta.level,
      xml,
      trains: sidecar.trains ?? '',
      item: i,
    };
  });

/** `relative` or `parallel`: a parallel pair keeps its tonic ("learning/key-changes/a-minor-to-a-major/..."). */
function familyOf(id: string): 'relative' | 'parallel' {
  const [fromKey = '', toKey = ''] = (id.split('/')[2] ?? '').split('-to-');
  return fromKey.split('-')[0] === toKey.split('-')[0] ? 'parallel' : 'relative';
}

/** Feature 022 (owner decision OD-1, FR-006): the level check stopped counting eighth-note runs, key changes and
 *  accidentals, so these items measure below their shelf and say why they keep it (022 T010). Every other item of this
 *  sweep still needs no `raisedBecause`. Keyed by the exercise definition the item is generated from. */
const RAISED_BECAUSE_022: Readonly<Record<string, string>> = {
  'key-change-parallel-intermediate':
    'A change of key in the middle of the exercise, under right-hand runs of more than four eighth notes in a row.',
  'key-change-relative-intermediate':
    "A change of key in the middle of the exercise, with the new key's accidentals written in, under right-hand runs of eighth notes.",
  'learning/key-changes/c-major-to-c-minor/major-and-minor':
    'Major and minor on the same tonic, switched back and forth with accidentals in almost every bar, ties across bar lines and a repeat.',
  'learning/key-changes/a-minor-to-a-major/minor-and-major':
    'Minor and major on the same tonic, switched back and forth with accidentals in almost every bar, ties across bar lines and a repeat.',
};

function keysOf(item: ShelfItem) {
  const claim = claimForItem({ itemId: item.id, title: item.title, trains: item.trains });
  return claim.segments?.map((s) => ({ firstBar: s.firstBar, key: s.key })) ?? [{ firstBar: 1, key: claim.key }];
}

interface RecordedNote {
  bar: number;
  midi: number;
  onset: { num: number; den: number };
}
function leftHandNotes(xml: string) {
  return readScore(xml)
    .notes.filter((n) => n.hand === 'left')
    .map((n) => ({
      bar: Number(n.bar),
      step: n.step,
      alter: n.alter,
      octave: n.octave,
      midi: n.midi,
      onset: n.onset,
      end: n.end,
      ...(n.finger !== undefined ? { finger: n.finger } : {}),
    }));
}
interface Chord {
  bar: number;
  onset: number;
  /** Sorted pitch classes. */
  pcs: number[];
  /** Sorted MIDI numbers. */
  midis: number[];
}
/** The left hand's chords in time order: the notes struck at one onset. */
function chordsOf(notes: readonly RecordedNote[]): Chord[] {
  const byOnset = new Map<number, RecordedNote[]>();
  for (const n of notes) {
    const t = n.onset.num / n.onset.den;
    byOnset.set(t, [...(byOnset.get(t) ?? []), n]);
  }
  return [...byOnset.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([onset, group]) => ({
      bar: group[0]?.bar ?? 0,
      onset,
      pcs: [...new Set(group.map((g) => g.midi % 12))].sort((a, b) => a - b),
      midis: group.map((g) => g.midi).sort((a, b) => a - b),
    }));
}
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** Sorted pitch classes of the triad on scale degree 1, 4, 5 or (minor) 6; V is major in minor too (the raised 7th),
 *  VI is major. */
function rootPc(key: KeyClaim, degree: 1 | 4 | 5 | 6): number {
  const tonic = (LETTER_PC[key.tonicLetter] ?? 0) + key.tonicAlter;
  return (((tonic + { 1: 0, 4: 5, 5: 7, 6: 8 }[degree]) % 12) + 12) % 12;
}
function triadPcs(key: KeyClaim, degree: 1 | 4 | 5 | 6): number[] {
  const tonic = (LETTER_PC[key.tonicLetter] ?? 0) + key.tonicAlter;
  const root = tonic + { 1: 0, 4: 5, 5: 7, 6: 8 }[degree];
  const third = key.mode === 'minor' && (degree === 1 || degree === 4) ? 3 : 4;
  return [...new Set([root, root + third, root + 7].map((pc) => ((pc % 12) + 12) % 12))].sort((a, b) => a - b);
}

const THUMB = 1;
/** The fingers that pass over the thumb, or that the thumb passes under (melody-rules.ts's CROSSING_FINGERS). */
const CROSSING_FINGERS: ReadonlySet<number> = new Set([2, 3, 4]);

function melodyMetrics(xml: string) {
  const reading = readScore(xml);
  const rightAll = reading.notes.filter((w) => w.hand === 'right' && !w.tiedFromPrevious);
  const onsets = new Map<number, (typeof rightAll)[number]>();
  for (const r of rightAll) {
    const t = r.onset.num / r.onset.den;
    const held = onsets.get(t);
    if (!held || held.midi < r.midi) onsets.set(t, r);
  }
  const melody = [...onsets.entries()].sort((a, b) => a[0] - b[0]).map(([, note]) => note);
  if (melody.length === 0) return { shortestValue: 4, range: 0, largestLeap: 0, shifts: 0 };

  const durations = melody.map((m) => m.end.num / m.end.den - m.onset.num / m.onset.den);
  const shortestValue = Math.min(...durations);

  const midis = melody.map((m) => m.midi);
  const range = Math.max(...midis) - Math.min(...midis);

  const diatOf = (n: (typeof melody)[number]) => n.octave * 7 + 'CDEFGAB'.indexOf(n.step);
  let largestLeap = 0;
  for (let i = 1; i < melody.length; i++) {
    const curr = melody[i];
    const prev = melody[i - 1];
    if (curr && prev) {
      const leap = Math.abs(diatOf(curr) - diatOf(prev));
      if (leap > largestLeap) largestLeap = leap;
    }
  }

  // A shift is a new hand position that is not a thumb-under / finger-over on a step: the Difficulty ladder as amended
  // 2026-09-28 (T076) lets introduction and beginner cross freely inside a scale run and limits only the other shifts.
  let shifts = 0;
  let thumb: number | null = null;
  let previous: { diat: number; finger: number } | null = null;
  for (const m of melody) {
    if (m.finger !== undefined) {
      const diat = diatOf(m);
      const newThumb = diat - (m.finger - 1);
      if (thumb !== null && previous !== null && newThumb !== thumb) {
        const step = diat - previous.diat;
        const thumbUnder = step === 1 && m.finger === THUMB && CROSSING_FINGERS.has(previous.finger);
        const fingerOver = step === -1 && previous.finger === THUMB && CROSSING_FINGERS.has(m.finger);
        if (!thumbUnder && !fingerOver) shifts++;
      }
      thumb = newThumb;
      previous = { diat, finger: m.finger };
    }
  }

  return { shortestValue, range, largestLeap, shifts };
}

// ---- the 5 chord-change drills (US3, T036) ----
const DRILL_IDS = [
  'learning/keys/c-major/i-v-vi-iv',
  'learning/keys/c-major/turnaround',
  'learning/keys/c-major/diatonic-ladder',
  'learning/key-changes/c-major-to-c-minor/major-and-minor',
  'learning/key-changes/a-minor-to-a-major/minor-and-major',
];
const drillItems: ShelfItem[] = DRILL_IDS.map((id) => {
  const item = (indexJson.items as LibraryItem[]).find((i) => i.id === id);
  if (!item) throw new Error(`${id} is not on the shelf`);
  const sidecar = JSON.parse(fs.readFileSync(path.join(libRoot, `${id}.json`), 'utf8')) as { trains?: string };
  return {
    id,
    title: item.meta.title,
    section: item.section,
    level: item.meta.level,
    xml: fs.readFileSync(path.join(libRoot, `${id}.musicxml`), 'utf8'),
    trains: sidecar.trains ?? '',
    item,
  };
});

describe('chord-change drill melody sweep (US3, FR-001, FR-005)', () => {
  it('covers the 5 drills, at their shelved levels', () => {
    expect(drillItems.map((d) => [d.id, d.level])).toEqual([
      ['learning/keys/c-major/i-v-vi-iv', 'beginner'],
      ['learning/keys/c-major/turnaround', 'beginner'],
      ['learning/keys/c-major/diatonic-ladder', 'intermediate'],
      ['learning/key-changes/c-major-to-c-minor/major-and-minor', 'advanced'],
      ['learning/key-changes/a-minor-to-a-major/minor-and-major', 'advanced'],
    ]);
  });

  it.each(drillItems)('$id has 0 melody rule findings at its level', (item) => {
    const findings: MelodyFinding[] = checkMelodyRules({
      itemId: item.id,
      xml: item.xml,
      level: item.level,
      keys: keysOf(item),
    });
    expect(findings).toEqual([]);
  });

  it.each(drillItems)(
    '$id passes the level check at its shelved level, with no raisedBecause but the 022 one',
    (shelfItem) => {
      const { meta, facts } = shelfItem.item;
      // 022 FR-006: only the two same-tonic drills gained one, with exactly this text
      expect(meta.raisedBecause).toBe(RAISED_BECAUSE_022[shelfItem.id]);
      const result = checkLevel(facts, meta.level, {
        expectedNotices: meta.expected?.notices ?? [],
        kind: meta.kind,
        ...(meta.raisedBecause !== undefined ? { raisedBecause: meta.raisedBecause } : {}),
      });
      expect(result.pass).toBe(true);
    },
  );

  it('the melodies of the two beginner drills differ (FR-008)', () => {
    const beginners = drillItems
      .filter((d) => d.level === 'beginner')
      .map((d) => ({ itemId: d.id, degrees: melodyDegrees({ itemId: d.id, xml: d.xml, keys: keysOf(d) }) }));
    expect(beginners).toHaveLength(2);
    // Each is a single-note line (the doubled triads' top notes would differ too, and are no melody).
    for (const d of drillItems.filter((x) => x.level === 'beginner')) {
      const onsets = readScore(d.xml)
        .notes.filter((n) => n.hand === 'right')
        .map((n) => `${n.onset.num}/${n.onset.den}`);
      expect(new Set(onsets).size, d.id).toBe(onsets.length);
    }
    expect(checkMelodyVariation(beginners)).toEqual([]);
  });

  // FR-005: over a chord borrowed from the parallel mode the melody takes that mode, so the quality change is heard in
  // both hands - the minor third (E flat) over C minor's i, the major third (C sharp) over A major's I.
  it.each([
    ['learning/key-changes/c-major-to-c-minor/major-and-minor', 'E', -1, 'minor'],
    ['learning/key-changes/a-minor-to-a-major/minor-and-major', 'C', 1, 'major'],
  ] as const)('%s: the melody sounds the borrowed third %s(%i) over the %s chords', (id, step, alter) => {
    const drill = drillItems.find((d) => d.id === id);
    if (!drill) throw new Error(id);
    const reading = readScore(drill.xml);
    const borrowedChordBars = new Set(
      reading.notes.filter((n) => n.hand === 'left' && n.step === step && n.alter === alter).map((n) => Number(n.bar)),
    );
    expect(borrowedChordBars.size).toBeGreaterThan(0);
    const right = reading.notes.filter((n) => n.hand === 'right');
    const alone = (n: (typeof right)[number]) =>
      right.filter((o) => o.onset.num * n.onset.den === n.onset.num * o.onset.den).length === 1;
    // a melody note: the only right-hand note at its onset (not a member of a doubled triad)
    const heard = right.filter(
      (n) => n.step === step && n.alter === alter && borrowedChordBars.has(Number(n.bar)) && alone(n),
    );
    expect(heard.length).toBeGreaterThan(0);
  });
});

describe('key-change melody sweep (FR-001, FR-002, US1)', () => {
  it('covers all 54 key-change items on the shelf', () => {
    expect(keyChangeItems).toHaveLength(54);
  });

  // FR-002 as amended 2026-09-28 (owner listening check, T077): the intermediate items keep the left hand of 7f8ab96;
  // the introduction and beginner items keep the key change, the chord before it and the voicing of every chord they
  // had, but their harmony moves with the key's primary triads.
  describe('left-hand notes equal those of commit 7f8ab96 (FR-002) - intermediate', () => {
    it.each(keyChangeItems.filter((i) => i.level === 'intermediate'))('$id left hand is unchanged', (item) => {
      expect(leftHandNotes(item.xml)).toEqual((recordedLeftHand as Record<string, unknown[]>)[item.id]);
    });
  });

  describe('introduction and beginner: a moving left hand of primary triads (FR-002 amended, T077)', () => {
    const moving = keyChangeItems.filter((i) => i.level === 'introduction' || i.level === 'beginner');

    it('covers the 36 introduction and beginner items', () => {
      expect(moving).toHaveLength(36);
    });

    it.each(moving)('$id keeps its key change, the chord before it and its tonic voicings, and moves', (item) => {
      const now = chordsOf(leftHandNotes(item.xml));
      const before = chordsOf((recordedLeftHand as Record<string, RecordedNote[]>)[item.id] ?? []);
      const keys = keysOf(item);
      const change = keys[1]?.firstBar;
      expect(change, 'a key-change item has a second key').toBeDefined();
      if (change === undefined) return;
      const keyAtBar = (b: number) => (b >= change ? keys[1] : keys[0])?.key as KeyClaim;
      const lastBar = (cs: Chord[]) => Math.max(...cs.map((c) => c.bar));

      // the same length and the same key-change bar (the claim's second key starts where the recorded chords did)
      expect(lastBar(now)).toBe(lastBar(before));
      // the chord before the change, note for note
      const pivot = (cs: Chord[]) => cs.filter((c) => c.bar < change).at(-1)?.midis;
      expect(pivot(now)).toEqual(pivot(before));
      // each key's section starts on its tonic, and the item ends on the new tonic
      const tonicOf = (k: KeyClaim) => triadPcs(k, 1);
      expect(now.find((c) => c.bar === 1)?.pcs).toEqual(tonicOf(keyAtBar(1)));
      expect(now.find((c) => c.bar === change)?.pcs).toEqual(tonicOf(keyAtBar(change)));
      expect(now.at(-1)?.pcs).toEqual(tonicOf(keyAtBar(change)));
      // every other chord is a primary triad of its key, or VI in a minor key (the chord a relative change pivots on,
      // with no accidental in a minor second key that keeps the first key's signature); the chord before the change is
      // the one kept as it was
      const pivotOnset = now.filter((c) => c.bar < change).at(-1)?.onset;
      for (const c of now.filter((x) => x.onset !== pivotOnset)) {
        const k = keyAtBar(c.bar);
        const primary = [1, 4, 5].map((d) => triadPcs(k, d).join(','));
        if (k.mode === 'minor') primary.push(triadPcs(k, 6).join(','));
        expect(primary, `bar ${c.bar}: ${c.pcs.join(',')}`).toContain(c.pcs.join(','));
      }
      // chords per bar: one at introduction, two at beginner (MELODY_LADDER.lhAttacksPerBar)
      const perBar = new Map<number, number>();
      for (const c of now) perBar.set(c.bar, (perBar.get(c.bar) ?? 0) + 1);
      expect(Math.max(...perBar.values())).toBeLessThanOrEqual(MELODY_LADDER[item.level].lhAttacksPerBar);
      // introduction plays root-position triads only (its widest chord is a fifth, level criterion 16): the bass is
      // the chord's root
      if (item.level === 'introduction') {
        for (const c of now) {
          const bassPc = (c.midis[0] ?? 0) % 12;
          const k = keyAtBar(c.bar);
          const roots = ([1, 4, 5, 6] as const)
            .filter((d) => triadPcs(k, d).join(',') === c.pcs.join(','))
            .map((d) => rootPc(k, d));
          expect(roots, `bar ${c.bar}: bass ${bassPc}`).toContain(bassPc);
        }
      }
      // the two tonic chords keep their recorded notes (the chord before the change is checked above); the new chords
      // are voiced by the level (root position at introduction, V6 and IV6/4 at beginner, so a IV6/4 may share the
      // pivot's notes in another inversion)
      const tonics = new Set([tonicOf(keyAtBar(1)).join(','), tonicOf(keyAtBar(change)).join(',')]);
      const recordedTonic = new Map(
        before.filter((c) => tonics.has(c.pcs.join(','))).map((c) => [c.pcs.join(','), c.midis.join(',')]),
      );
      for (const c of now.filter((x) => tonics.has(x.pcs.join(',')))) {
        expect(c.midis.join(','), `bar ${c.bar}`).toBe(recordedTonic.get(c.pcs.join(',')));
      }
      // the harmony moves: no chord held or repeated for more than two bars in a row, apart from the closing tonic
      const byBar = [...new Map(now.map((c) => [c.bar, c.pcs.join(',')])).entries()].sort((a, b) => a[0] - b[0]);
      let runLength = 1;
      for (let i = 1; i < byBar.length; i++) {
        runLength = byBar[i]?.[1] === byBar[i - 1]?.[1] ? runLength + 1 : 1;
        const closing = i === byBar.length - 1;
        if (!closing) expect(runLength, `bar ${byBar[i]?.[0]}: ${byBar[i]?.[1]} again`).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('checkMelodyVariation per family group (FR-008)', () => {
    // 6 groups: relative/parallel x introduction/beginner/intermediate, one definition each - 8 relative pairs and
    // 10 parallel pairs (5 major-to-minor, 5 minor-to-major) per level.
    const groups = new Map<string, { itemId: string; degrees: string }[]>();
    for (const item of keyChangeItems) {
      const keys = keysOf(item);
      const degrees = melodyDegrees({ itemId: item.id, xml: item.xml, keys });
      const groupKey = `${familyOf(item.id)}-${item.id.split('/')[3] ?? ''}`;
      const list = groups.get(groupKey) ?? [];
      list.push({ itemId: item.id, degrees });
      groups.set(groupKey, list);
    }

    it('has 6 groups: 8 relative and 10 parallel items per level', () => {
      expect(groups.size).toBe(6);
      for (const [key, items] of groups) {
        expect(items, key).toHaveLength(key.startsWith('parallel') ? 10 : 8);
      }
    });

    for (const [groupName, groupItems] of groups) {
      it(`family group ${groupName} has no variation findings`, () => {
        const findings = checkMelodyVariation(groupItems);
        expect(findings).toEqual([]);
      });
    }
  });

  describe('checkMelodyRules at item level (FR-001, US1)', () => {
    it.each(keyChangeItems)('$id has 0 melody rule findings', (item) => {
      const keys = keysOf(item);
      const findings: MelodyFinding[] = checkMelodyRules({
        itemId: item.id,
        xml: item.xml,
        level: item.level,
        keys,
      });
      expect(findings).toEqual([]);
    });
  });

  describe('checkLevel passes with no new raisedBecause (FR-011)', () => {
    it.each(keyChangeItems)('$id passes at assigned level without a new raisedBecause', (shelfItem) => {
      const { meta, facts } = shelfItem.item;
      const result = checkLevel(facts, meta.level, {
        expectedNotices: meta.expected?.notices ?? [],
        kind: meta.kind,
        ...(meta.arrangement !== undefined ? { arrangement: meta.arrangement } : {}),
        ...(meta.raisedBecause !== undefined ? { raisedBecause: meta.raisedBecause } : {}),
      });
      expect(result.pass).toBe(true);
      // FR-011: "without a new raisedBecause unless the item already had one" - at 7f8ab96 only the relative
      // intermediate items had one; it may stay or go, but no other item may gain one. Feature 022 FR-006 (owner
      // decision OD-1) replaced it: every intermediate item of both families now carries its family's 022 text, and no
      // other step has one.
      if (meta.step === 'intermediate') {
        expect(meta.raisedBecause).toBe(RAISED_BECAUSE_022[`key-change-${familyOf(shelfItem.id)}-intermediate`]);
      } else {
        expect(meta.raisedBecause).toBeUndefined();
      }
    });
  });

  describe('checkStepOrder and melody ladder comparison per folder (US2)', () => {
    const bySection = new Map<string, ShelfItem[]>();
    for (const item of keyChangeItems) {
      const list = bySection.get(item.section) ?? [];
      list.push(item);
      bySection.set(item.section, list);
    }

    it('has 18 key-change folders with 3 main items each', () => {
      expect(bySection.size).toBe(18);
      for (const [section, items] of bySection) {
        expect(items, section).toHaveLength(3);
      }
    });

    for (const [section, items] of bySection) {
      it(`${section}: checkStepOrder returns no messages`, () => {
        expect(checkStepOrder(items.map((i) => i.item))).toEqual([]);
      });

      it(`${section}: ladder dimensions are not easier, and strictly harder step by step`, () => {
        const intro = items.find((i) => i.item.meta.step === 'introduction');
        const beg = items.find((i) => i.item.meta.step === 'beginner');
        const inter = items.find((i) => i.item.meta.step === 'intermediate');
        expect(intro).toBeDefined();
        expect(beg).toBeDefined();
        expect(inter).toBeDefined();
        if (!intro || !beg || !inter) return;

        const mIntro = melodyMetrics(intro.xml);
        const mBeg = melodyMetrics(beg.xml);
        const mInter = melodyMetrics(inter.xml);

        // beginner vs introduction: not easier
        expect(mBeg.shortestValue).toBeLessThanOrEqual(mIntro.shortestValue);
        expect(mBeg.range).toBeGreaterThanOrEqual(mIntro.range);
        expect(mBeg.largestLeap).toBeGreaterThanOrEqual(mIntro.largestLeap);
        expect(mBeg.shifts).toBeGreaterThanOrEqual(mIntro.shifts);

        const begMoreDemanding =
          mBeg.shortestValue < mIntro.shortestValue ||
          mBeg.range > mIntro.range ||
          mBeg.largestLeap > mIntro.largestLeap ||
          mBeg.shifts > mIntro.shifts;
        expect(
          begMoreDemanding,
          `${section}: beginner must be more demanding than introduction on at least one ladder dimension`,
        ).toBe(true);

        // intermediate vs beginner: not easier
        expect(mInter.shortestValue).toBeLessThanOrEqual(mBeg.shortestValue);
        expect(mInter.range).toBeGreaterThanOrEqual(mBeg.range);
        expect(mInter.largestLeap).toBeGreaterThanOrEqual(mBeg.largestLeap);
        expect(mInter.shifts).toBeGreaterThanOrEqual(mBeg.shifts);

        const interMoreDemanding =
          mInter.shortestValue < mBeg.shortestValue ||
          mInter.range > mBeg.range ||
          mInter.largestLeap > mBeg.largestLeap ||
          mInter.shifts > mBeg.shifts;
        expect(
          interMoreDemanding,
          `${section}: intermediate must be more demanding than beginner on at least one ladder dimension`,
        ).toBe(true);
      });
    }
  });
});

// ---- SC-001 over the whole Learning section (T052) ----
describe('no doubled block chords in the Learning section (SC-001)', () => {
  // Feature 022: Learning > Chords holds chord drills whose right hand plays the chords on purpose; they are checked by
  // chord-lessons-v1 instead. The sweep keeps to the Keys and Key-changes shelves of feature 014, songs included.
  const learningItems = (indexJson.items as LibraryItem[]).filter((i) => /^learning\/(keys|key-changes)\//.test(i.id));

  /** The key per bar range: the claim table for exercises, the folder's key for songs (`checkSong` does the same). */
  function learningKeys(item: LibraryItem): MelodyCheckInput['keys'] {
    if (/\/song-[a-z0-9-]+$/.test(item.id)) return [{ firstBar: 1, key: songKeyOfItemId(item.id) }];
    const sidecar = JSON.parse(fs.readFileSync(path.join(libRoot, `${item.id}.json`), 'utf8')) as { trains?: string };
    const claim = claimForItem({ itemId: item.id, title: item.meta.title, trains: sidecar.trains ?? '' });
    return claim.segments?.map((s) => ({ firstBar: s.firstBar, key: s.key })) ?? [{ firstBar: 1, key: claim.key }];
  }

  it('the in-scope list has exactly 59 distinct ids, the 59 recorded before the feature', () => {
    const inScope = [...keyChangeItems, ...drillItems].map((i) => i.id);
    expect(new Set(inScope).size).toBe(59);
    expect([...inScope].sort()).toEqual(Object.keys(inScopeMetadata).sort());
  });

  it('checks every Learning item on the shelf, songs included', () => {
    expect(learningItems.length).toBeGreaterThan(59);
    expect(learningItems.some((i) => /\/song-/.test(i.id))).toBe(true);
  });

  it.each(learningItems.map((i) => ({ id: i.id, item: i })))(
    '$id has no doubled finding (a single closing tonic chord is allowed)',
    ({ item }) => {
      const xml = fs.readFileSync(path.join(libRoot, `${item.id}.musicxml`), 'utf8');
      const doubled = checkMelodyRules({
        itemId: item.id,
        xml,
        level: item.meta.level,
        keys: learningKeys(item),
      }).filter((f) => f.rule === 'doubled');
      expect(doubled).toEqual([]);
    },
  );
});
