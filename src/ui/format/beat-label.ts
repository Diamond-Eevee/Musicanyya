import type { TempoBeat } from '../../core/tempo/tempo-display.js';
import { en } from '../i18n/en.js';

/** English fallback matching `src/core/tempo/beat-unit.ts`'s `beatLabel`, built from i18n keys for localisation
 *  (contract: beatLabel is English internally, the UI always maps it through i18n). Shared by the tempo field,
 *  the attempts list and the Grade panel (feature 012, US3). */
export function localizedBeatLabel(beat: TempoBeat): string {
  const prefix = en.transport.beatDotPrefixes[beat.dots] ?? '';
  const name = en.transport.beatNames[beat.type] ?? beat.type;
  return `${prefix}${name}`;
}
