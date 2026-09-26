import { STEP_ORDER_FACTS } from '../defaults.js';
import type { ItemFacts, LibraryItem, Step } from './types.js';
import { STEP_RANK } from './types.js';

/** Feature 011 FR-010, SC-002 (specs/011-learning-by-key/data-model.md §4 "Step order"): within one key or
 *  key-change folder, each step's main item must be at least as demanding as the step before on every measured
 *  fact and more demanding on at least one. Pure: takes the shelf's items (any folders), groups them by section,
 *  and returns one message per failure - empty when every folder is in order. Only main exercise items take part
 *  (a `step` other than `song` and `stepOrder` 0); extras, songs and repertoire are ignored. */
export function checkStepOrder(items: readonly Pick<LibraryItem, 'id' | 'section' | 'meta' | 'facts'>[]): string[] {
  const bySection = new Map<string, { step: Step; facts: ItemFacts }[]>();
  for (const item of items) {
    const { step, stepOrder } = item.meta;
    if (step === undefined || step === 'song' || (stepOrder ?? 0) !== 0) continue;
    const list = bySection.get(item.section) ?? [];
    list.push({ step, facts: item.facts });
    bySection.set(item.section, list);
  }

  const messages: string[] = [];
  for (const [section, list] of bySection) {
    list.sort((a, b) => STEP_RANK[a.step] - STEP_RANK[b.step]);
    for (let i = 1; i < list.length; i++) {
      const earlier = list[i - 1];
      const later = list[i];
      if (!earlier || !later) continue;
      let risen = false;
      let fallen = false;
      for (const fact of STEP_ORDER_FACTS) {
        const before = measured(earlier.facts, fact);
        const after = measured(later.facts, fact);
        if (after < before) {
          fallen = true;
          messages.push(
            `${section}: ${later.step} is less demanding than ${earlier.step} on ${fact} (${show(after)} < ${show(before)})`,
          );
        } else if (after > before) {
          risen = true;
        }
      }
      if (!fallen && !risen) {
        messages.push(`${section}: ${later.step} is not more demanding than ${earlier.step} on any fact`);
      }
    }
  }
  return messages;
}

/** The value of a step-order fact; a fact an older index did not record, or a missing tempo, counts as 0. */
function measured(facts: ItemFacts, fact: (typeof STEP_ORDER_FACTS)[number]): number {
  return facts[fact] ?? 0;
}

function show(value: number): string {
  return String(Number(value.toFixed(2)));
}
