import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TRANSPORT_BUTTON_MIN_PX } from '../../src/engine/config.js';

const LAYOUT_CSS = readFileSync(resolve(process.cwd(), 'src/ui/styles/layout.css'), 'utf8');

/** The CSS cannot import the constant, so this pins them together (as controls-in-shadow.test.ts does for the focus ring). */
describe('transport button CSS (feature 021 US4, FR-023)', () => {
  const rule = (selector: string): string => {
    const start = LAYOUT_CSS.indexOf(`${selector} {`);
    expect(start, `layout.css has a rule for ${selector}`).toBeGreaterThanOrEqual(0);
    return LAYOUT_CSS.slice(start, LAYOUT_CSS.indexOf('}', start));
  };

  it(`gives each transport button at least TRANSPORT_BUTTON_MIN_PX (${TRANSPORT_BUTTON_MIN_PX}px) each way`, () => {
    const body = rule('mx-transport button.mx-transport-btn');
    expect(body).toContain(`min-width: ${TRANSPORT_BUTTON_MIN_PX}px;`);
    expect(body).toContain(`min-height: ${TRANSPORT_BUTTON_MIN_PX}px;`);
  });

  it('draws a disabled transport button with a dashed border, not by opacity alone', () => {
    expect(rule('mx-transport button.mx-transport-btn:disabled')).toContain('border-style: dashed;');
  });
});
