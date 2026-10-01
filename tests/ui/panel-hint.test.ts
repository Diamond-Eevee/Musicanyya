import { afterEach, describe, expect, it } from 'vitest';
import { MxPanelHint } from '../../src/ui/elements/mx-panel-hint.js';
import { practiceState } from '../../src/ui/state/practiceState.js';

/** 017 T041: a one-line hint in a popup whose own content has nothing to show in the current state. */
describe('mx-panel-hint', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    practiceState.setMode('listen');
  });

  function mount(showWhen: () => boolean): MxPanelHint {
    const hint = new MxPanelHint('Choose Practice or Play mode.', showWhen);
    document.body.appendChild(hint);
    return hint;
  }

  it('shows its text while the condition holds, and follows mode changes', () => {
    practiceState.setMode('listen');
    const hint = mount(() => practiceState.get().mode === 'listen');
    expect(hint.hidden).toBe(false);
    expect(hint.textContent).toBe('Choose Practice or Play mode.');
    expect(hint.classList.contains('panel-hint')).toBe(true);
    practiceState.setMode('practice');
    expect(hint.hidden).toBe(true);
    practiceState.setMode('listen');
    expect(hint.hidden).toBe(false);
  });

  it('stops following the state once removed', () => {
    let calls = 0;
    const hint = mount(() => {
      calls++;
      return true;
    });
    hint.remove();
    const before = calls;
    practiceState.setMode('play');
    expect(calls).toBe(before);
  });
});
