import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SCORE_SCALE_DEFAULT, SCORE_SCALE_MAX, SCORE_SCALE_MIN, SCORE_SCALE_STEP } from '../../src/engine/config.js';
import '../../src/ui/elements/mx-size-controls.js';
import { viewState } from '../../src/ui/state/viewState.js';

const control = (el: HTMLElement, action: 'smaller' | 'reset' | 'larger') =>
  el.shadowRoot?.querySelector(`button[data-action="${action}"]`) as HTMLButtonElement;

/** FR-014a/b, `ui-shell.md` section 2. */
describe('mx-size-controls', () => {
  let el: HTMLElement;

  beforeEach(() => {
    viewState.resetScale();
    el = document.createElement('mx-size-controls');
    document.body.appendChild(el);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    viewState.resetScale();
  });

  it('renders larger, smaller and reset, each with an accessible name', () => {
    for (const action of ['smaller', 'reset', 'larger'] as const) {
      const button = control(el, action);
      expect(button, action).toBeTruthy();
      expect((button.getAttribute('aria-label') ?? button.textContent ?? '').trim().length).toBeGreaterThan(0);
    }
  });

  it('larger and smaller step the size by one step', () => {
    control(el, 'larger').click();
    expect(viewState.get().scale).toBe(SCORE_SCALE_DEFAULT + SCORE_SCALE_STEP);
    control(el, 'smaller').click();
    control(el, 'smaller').click();
    expect(viewState.get().scale).toBe(SCORE_SCALE_DEFAULT - SCORE_SCALE_STEP);
  });

  it('reset returns to the fitted size from anywhere', () => {
    viewState.setScale(170);
    control(el, 'reset').click();
    expect(viewState.get().scale).toBe(SCORE_SCALE_DEFAULT);
    viewState.setScale(60);
    control(el, 'reset').click();
    expect(viewState.get().scale).toBe(SCORE_SCALE_DEFAULT);
  });

  it('disables larger at the top of the range and smaller at the bottom', () => {
    viewState.setScale(SCORE_SCALE_MAX);
    expect(control(el, 'larger').disabled).toBe(true);
    expect(control(el, 'smaller').disabled).toBe(false);

    viewState.setScale(SCORE_SCALE_MIN);
    expect(control(el, 'smaller').disabled).toBe(true);
    expect(control(el, 'larger').disabled).toBe(false);

    viewState.setScale(SCORE_SCALE_DEFAULT);
    expect(control(el, 'smaller').disabled || control(el, 'larger').disabled).toBe(false);
  });

  it('can walk from the fitted size to twice as large within the ten activations of SC-008a', () => {
    let presses = 0;
    while (!control(el, 'larger').disabled) {
      control(el, 'larger').click();
      presses++;
    }
    expect(viewState.get().scale).toBe(SCORE_SCALE_MAX);
    expect(presses).toBeLessThanOrEqual(10);
    expect(SCORE_SCALE_MAX / SCORE_SCALE_DEFAULT).toBeGreaterThanOrEqual(2);
  });

  it('shows the current size as text, so the level is known without seeing the staves', () => {
    viewState.setScale(130);
    expect(el.shadowRoot?.textContent).toContain('130%');
  });

  it('stops following the store once removed', () => {
    el.remove();
    viewState.setScale(150);
    expect(el.shadowRoot?.textContent).not.toContain('150%');
  });
});
