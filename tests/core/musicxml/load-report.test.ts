import { describe, it, expect } from 'vitest';
import { analyzeLoadReport } from '../../../src/core/musicxml/load-report.js';

describe('load-report', () => {
  it('groups unsupported elements with measure labels', () => {
    // Fails since load-report implementation doesn't exist yet
    const rawElements = [
      { element: 'accordion-registration', measureNumber: '1', staff: 1 },
      { element: 'accordion-registration', measureNumber: '2', staff: 1 },
      { element: 'other-unsupported', measureNumber: '1', staff: 1 }
    ];
    const report = analyzeLoadReport(rawElements);
    expect(report.notices.length).toBeGreaterThan(0);
    expect(report.notices[0].message).toContain('accordion-registration');
    expect(report.notices[0].measures).toEqual(['1', '2']);
  });
});
