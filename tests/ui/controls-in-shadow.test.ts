import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CHROME_FOCUS_RING_PX, THEME_CONTROL_TRANSITION_MS } from '../../src/engine/config.js';
import '../../src/ui/elements/mx-menu.js';
import '../../src/ui/elements/mx-midi-panel.js';
import '../../src/ui/elements/mx-panel.js';
import '../../src/ui/elements/mx-practice-help.js';
import '../../src/ui/elements/mx-size-controls.js';

import { practiceState } from '../../src/ui/state/practiceState.js';

const CONTROLS_CSS_PATH = resolve(process.cwd(), 'src/ui/styles/controls.css');
const CONTROLS_MARKER = '/* mx-controls */';

describe('Shared control styles inside shadow roots and CSS constants (T017)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    practiceState.clearHelpOverlay();
  });

  const elementsToTest = [
    { tag: 'mx-menu', setup: (el: HTMLElement) => el.setAttribute('menu', 'view') },
    { tag: 'mx-panel', setup: () => {} },
    { tag: 'mx-size-controls', setup: () => {} },
    { tag: 'mx-midi-panel', setup: () => {} },
    {
      tag: 'mx-practice-help',
      setup: () => {
        practiceState.setHelpOverlay({
          reason: 'stuck',
          keys: [{ key: 60, noteName: 'C4', fingering: '1' }],
        });
      },
    },
  ];

  for (const { tag, setup } of elementsToTest) {
    it(`${tag} shadow root contains <style> with ${CONTROLS_MARKER}`, () => {
      const el = document.createElement(tag);
      setup(el);
      document.body.appendChild(el);

      expect(el.shadowRoot, `${tag} should have a shadow root`).toBeTruthy();
      const styleEls = Array.from(el.shadowRoot?.querySelectorAll('style') ?? []);
      const hasMarker = styleEls.some((s) => s.textContent?.includes(CONTROLS_MARKER));
      expect(hasMarker, `${tag} shadow root should include ${CONTROLS_MARKER}`).toBe(true);
    });
  }

  it('src/ui/styles/controls.css exists and starts with /* mx-controls */', () => {
    expect(existsSync(CONTROLS_CSS_PATH), 'controls.css must exist').toBe(true);
    const css = readFileSync(CONTROLS_CSS_PATH, 'utf8').trimStart();
    expect(css.startsWith(CONTROLS_MARKER), 'controls.css must start with /* mx-controls */').toBe(true);
  });

  it(`controls.css :focus-visible outline width matches CHROME_FOCUS_RING_PX (${CHROME_FOCUS_RING_PX}px)`, () => {
    expect(existsSync(CONTROLS_CSS_PATH), 'controls.css must exist').toBe(true);
    const css = readFileSync(CONTROLS_CSS_PATH, 'utf8');

    // Strip comments
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');

    // Find :focus-visible rule block
    const focusBlockMatch = stripped.match(/:focus-visible\s*\{([^}]+)\}/);
    expect(focusBlockMatch, 'controls.css must declare a :focus-visible rule block').toBeTruthy();
    const blockContent = focusBlockMatch?.[1] ?? '';

    // Check outline width is CHROME_FOCUS_RING_PX
    const expectedWidthPx = `${CHROME_FOCUS_RING_PX}px`;
    const outlineMatch = blockContent.match(/outline\s*:\s*([^;]+);/);
    const outlineWidthMatch = blockContent.match(/outline-width\s*:\s*([^;]+);/);

    const hasExpectedWidth =
      outlineMatch?.[1].includes(expectedWidthPx) || outlineWidthMatch?.[1].includes(expectedWidthPx);

    expect(hasExpectedWidth, `:focus-visible outline should use ${expectedWidthPx}, got: ${blockContent}`).toBe(true);
  });

  it(`controls.css transitions use THEME_CONTROL_TRANSITION_MS (${THEME_CONTROL_TRANSITION_MS}ms) or 0s`, () => {
    expect(existsSync(CONTROLS_CSS_PATH), 'controls.css must exist').toBe(true);
    const css = readFileSync(CONTROLS_CSS_PATH, 'utf8');

    // Extract all transition and transition-duration values outside reduced-motion
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');

    // Split out prefers-reduced-motion block
    const reducedMotionRegex = /@media[^{]*prefers-reduced-motion[^{]*\{([\s\S]*?\}\s*)\}/g;
    const standardCss = stripped.replace(reducedMotionRegex, '');

    const transitionMatches = [...standardCss.matchAll(/(?:transition|transition-duration)\s*:\s*([^;}]+)[;}]/g)];
    expect(transitionMatches.length, 'controls.css must define transitions on controls').toBeGreaterThan(0);

    const expectedDurationMs = `${THEME_CONTROL_TRANSITION_MS}ms`;

    for (const match of transitionMatches) {
      const val = match[1].trim();
      if (val === 'none') continue;
      // Extract duration (e.g. "120ms" or "0.12s")
      expect(
        val.includes(expectedDurationMs) || val.includes(`${THEME_CONTROL_TRANSITION_MS / 1000}s`),
        `Transition duration should be ${expectedDurationMs}, got: "${val}"`,
      ).toBe(true);
    }
  });
});
