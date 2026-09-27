/** data-model.md §2, research.md R-7 - whether a Play run covered the whole Score or only part of it. Pure
 *  (Principle V): no DOM, no Web API. */

import type { RunSettings } from '../play/types.js';
import type { HandSelection } from '../practice/types.js';
import type { Score } from '../score/model.js';
import type { ResultScope } from './types.js';

function handsOf(selection: HandSelection): 'right' | 'left' | 'custom' | null {
  if (selection.preset === 'both') return null;
  if (selection.preset === 'right') return 'right';
  if (selection.preset === 'left') return 'left';
  return 'custom';
}

function partialScope(settings: RunSettings): ResultScope {
  if (settings.range === null) {
    return { kind: 'partial', fromMeasure: null, toMeasure: null, hands: handsOf(settings.selection) };
  }
  const { fromMeasureIndex, toMeasureIndex } = settings.range;
  return {
    kind: 'partial',
    fromMeasure: Math.min(fromMeasureIndex, toMeasureIndex) + 1, // 1-based written bar (data-model.md §2)
    toMeasure: Math.max(fromMeasureIndex, toMeasureIndex) + 1,
    hands: handsOf(settings.selection),
  };
}

/** R-7: `whole` when the run covered the whole Score - no range, and every staff of the selected part that has any
 *  note is among the selected staves (a one-hand piece's `right` counts, since the other staff has nothing to
 *  leave out). Computed with the loaded Score, so it needs it; a stored run without one uses
 *  `scopeFromStoredSettings` instead. */
export function resultScope(score: Score, settings: RunSettings): ResultScope {
  if (settings.range !== null) return partialScope(settings);
  const part = score.parts[settings.selection.partIndex];
  const staffHasNotes = new Set(part?.notes.map((note) => note.staff) ?? []);
  const selected = new Set(settings.selection.staves);
  const coversEveryStaffWithNotes = [...staffHasNotes].every((staff) => selected.has(staff));
  return coversEveryStaffWithNotes ? { kind: 'whole' } : partialScope(settings);
}

/** R-6: the legacy rule for a `StoredPerformance` recorded before this feature, with no live Score to check for an
 *  empty staff - `whole` only for the literal "no range, both hands" case. */
export function scopeFromStoredSettings(settings: RunSettings): ResultScope {
  if (settings.range === null && settings.selection.preset === 'both') return { kind: 'whole' };
  return partialScope(settings);
}
