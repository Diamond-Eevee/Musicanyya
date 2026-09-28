import { describe, expect, it } from 'vitest';
import { PROGRESS_RESULTS_MAX } from '../../../src/core/defaults.js';
import { PERFORMANCES_PER_SCORE_MAX } from '../../../src/engine/config.js';

describe('progress constants', () => {
  it('keeps at least as many results as the Performance store keeps attempts (data-model.md section 3)', () => {
    expect(PROGRESS_RESULTS_MAX).toBeGreaterThanOrEqual(PERFORMANCES_PER_SCORE_MAX);
  });
});
