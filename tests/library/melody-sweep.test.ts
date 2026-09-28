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
    // 6 groups: relative/parallel x introduction/beginner/intermediate (9 items each)
    const groups = new Map<string, { itemId: string; degrees: string }[]>();
    for (const item of keyChangeItems) {
      const keys = keysOf(item);
      const degrees = melodyDegrees({ itemId: item.id, xml: item.xml, keys });
      const parts = item.id.split('/');
      // e.g. "learning/key-changes/c-major-to-a-minor/introduction" -> group by step and whether relative or parallel
      const pairFolder = parts[2] ?? '';
      const step = parts[3] ?? '';
      const isParallel =
        pairFolder.includes('-major-to-') &&
        pairFolder.includes('-minor') &&
        pairFolder.split('-to-')[0]?.replace('-major', '') === pairFolder.split('-to-')[1]?.replace('-minor', '');
      const groupKey = `${isParallel ? 'parallel' : 'relative'}-${step}`;
      const list = groups.get(groupKey) ?? [];
      list.push({ itemId: item.id, degrees });
      groups.set(groupKey, list);
    }

    it('has 6 groups of 9 items each', () => {
      expect(groups.size).toBe(6);
      for (const [key, items] of groups) {
        expect(items, key).toHaveLength(9);
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

  describe('checkLevel passes with no raisedBecause (FR-011)', () => {
    it.each(keyChangeItems)('$id passes at assigned level without raisedBecause', (shelfItem) => {
      const { meta, facts } = shelfItem.item;
      const result = checkLevel(facts, meta.level, {
        expectedNotices: meta.expected?.notices ?? [],
        kind: meta.kind,
        tags: meta.tags,
        ...(meta.arrangement !== undefined ? { arrangement: meta.arrangement } : {}),
      });
      expect(result.pass).toBe(true);
      expect(meta.raisedBecause).toBeUndefined();
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
