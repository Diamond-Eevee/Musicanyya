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
import { checkLevel } from '../../src/core/library/levels';
import { checkStepOrder } from '../../src/core/library/step-order';
import type { Level, LibraryItem } from '../../src/core/library/types';
import { claimForItem } from '../../tools/library/fidelity/exercise-claims';
import {
  checkMelodyRules,
  checkMelodyVariation,
  type MelodyFinding,
  melodyDegrees,
} from '../../tools/library/fidelity/melody-rules';
import { readScore } from '../../tools/library/fidelity/theory';
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

/** The one `raisedBecause` on a key-change item at 7f8ab96 (`key-change-relative-intermediate.json`). */
const RELATIVE_INTERMEDIATE_RAISED_BECAUSE_AT_BASELINE =
  'the minor-to-major pairs (A minor to C major, E minor to G major, B minor to D major) compute beginner on this content - kept at intermediate so every pair in the folder shares one step';

function keysOf(item: ShelfItem) {
  const claim = claimForItem({ itemId: item.id, title: item.title, trains: item.trains });
  return claim.segments?.map((s) => ({ firstBar: s.firstBar, key: s.key })) ?? [{ firstBar: 1, key: claim.key }];
}

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

  let shifts = 0;
  let thumb: number | null = null;
  for (const m of melody) {
    if (m.finger !== undefined) {
      const diat = diatOf(m);
      const newThumb = diat - (m.finger - 1);
      if (thumb !== null && newThumb !== thumb) {
        shifts++;
      }
      thumb = newThumb;
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

  it.each(drillItems)('$id passes the level check at its shelved level with no raisedBecause', (shelfItem) => {
    const { meta, facts } = shelfItem.item;
    expect(meta.raisedBecause).toBeUndefined();
    const result = checkLevel(facts, meta.level, {
      expectedNotices: meta.expected?.notices ?? [],
      kind: meta.kind,
      tags: meta.tags,
    });
    expect(result.pass).toBe(true);
  });

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

  describe('left-hand notes equal those of commit 7f8ab96 (FR-002)', () => {
    it.each(keyChangeItems)('$id left hand is unchanged', (item) => {
      const reading = readScore(item.xml);
      const currentLh = reading.notes
        .filter((n) => n.hand === 'left')
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
      expect(currentLh).toEqual((recordedLeftHand as Record<string, unknown[]>)[item.id]);
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
        tags: meta.tags,
        ...(meta.arrangement !== undefined ? { arrangement: meta.arrangement } : {}),
        ...(meta.raisedBecause !== undefined ? { raisedBecause: meta.raisedBecause } : {}),
      });
      expect(result.pass).toBe(true);
      // FR-011: "without a new raisedBecause unless the item already had one" - at 7f8ab96 only the relative
      // intermediate items had one; it may stay or go, but no other item may gain one.
      if (meta.raisedBecause !== undefined) {
        expect(`${familyOf(shelfItem.id)}-${meta.step}`).toBe('relative-intermediate');
        expect(meta.raisedBecause).toBe(RELATIVE_INTERMEDIATE_RAISED_BECAUSE_AT_BASELINE);
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
