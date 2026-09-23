/**
 * T030 [P] [US3] - Every LoadNoticeCode has English text in src/ui/i18n/en.ts.
 *
 * This test enumerates all codes from load-report.ts and checks that each one
 * maps to a non-empty string in the `en.notices` record (or the typed entries in en.ts).
 *
 * It MUST FAIL until T031 adds `engravingCompleted`, `beamDataInvalid` and
 * `accidentalContradicts` to both load-report.ts and en.ts.
 */
import { describe, expect, it } from 'vitest';
import type { LoadNoticeCode } from '../../src/core/score/load-report.js';
import { en } from '../../src/ui/i18n/en.js';

// ---------------------------------------------------------------------------
// The exhaustive list of all LoadNoticeCode values.
// This must stay in sync with src/core/score/load-report.ts.
// When a new code is added there, add it here too, and add its text to en.ts.
// ---------------------------------------------------------------------------
const ALL_LOAD_NOTICE_CODES: LoadNoticeCode[] = [
  'unsupportedElement',
  'timingRounded',
  'divisionsInvalid',
  'cursorClamped',
  'measureLengthMismatch',
  'measureRepeatOnlyRests',
  'brokenTie',
  'jumpTargetMissing',
  'jumpInferredFromText',
  'endingNoMatch',
  'repeatTooDeep',
  'unrollGuardHit',
  'tempoTextIgnored',
  'instrumentFallback',
  'unpitchedWithoutSound',
  'defaultTempo',
  'middleBarlineRepeat',
  // US3 additions (T031): must exist in load-report.ts before this test can pass
  'engravingCompleted',
  'beamDataInvalid',
  'accidentalContradicts',
];

describe('T030: every LoadNoticeCode has English text in en.notices', () => {
  for (const code of ALL_LOAD_NOTICE_CODES) {
    it(`notices.${code} is a non-empty string`, () => {
      const text = (en.notices as Record<string, string>)[code];
      expect(text, `en.notices.${code} is missing or empty - add it to src/ui/i18n/en.ts`).toBeTruthy();
      expect(typeof text).toBe('string');
      expect(text.trim().length).toBeGreaterThan(0);
    });
  }

  it('en.notices has no undefined holes for any code in the exhaustive list', () => {
    const missing = ALL_LOAD_NOTICE_CODES.filter((code) => !(en.notices as Record<string, string>)[code]);
    expect(missing, `Missing English text for: ${missing.join(', ')}`).toHaveLength(0);
  });
});
