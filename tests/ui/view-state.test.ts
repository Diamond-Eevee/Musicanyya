import { describe, expect, it, vi } from 'vitest';
import {
  OVERLAYS_DEFAULT,
  SCORE_SCALE_DEFAULT,
  SCORE_SCALE_MAX,
  SCORE_SCALE_MIN,
  SCORE_SCALE_STEP,
} from '../../src/engine/config.js';
import { createViewStateStore, PANEL_IDS, type PanelId, parsePanelId } from '../../src/ui/state/viewState.js';

describe('viewState: Score size (data-model.md section 2)', () => {
  it('starts at the fitted size', () => {
    expect(createViewStateStore().get().scale).toBe(SCORE_SCALE_DEFAULT);
  });

  it('clamps setScale to the supported range', () => {
    const view = createViewStateStore();
    view.setScale(9999);
    expect(view.get().scale).toBe(SCORE_SCALE_MAX);
    view.setScale(-5);
    expect(view.get().scale).toBe(SCORE_SCALE_MIN);
  });

  it('rounds setScale to the nearest step, halves going up', () => {
    const view = createViewStateStore();
    const cases: Array<[number, number]> = [
      [104, 100],
      [105, 110],
      [111, 110],
      [149, 150],
      [50, 50],
      [200, 200],
    ];
    for (const [input, expected] of cases) {
      view.setScale(input);
      expect(view.get().scale, `setScale(${input})`).toBe(expected);
      expect(view.get().scale % SCORE_SCALE_STEP).toBe(0);
    }
  });

  it('ignores a value that is not a finite number', () => {
    const view = createViewStateStore();
    view.setScale(150);
    view.setScale(Number.NaN);
    view.setScale(Number.POSITIVE_INFINITY);
    expect(view.get().scale).toBe(150);
  });

  it('resetScale returns to the fitted size', () => {
    const view = createViewStateStore();
    view.setScale(180);
    view.resetScale();
    expect(view.get().scale).toBe(SCORE_SCALE_DEFAULT);
  });

  it('notifies subscribers only when the value actually changes', () => {
    const view = createViewStateStore();
    const listener = vi.fn();
    view.subscribe(listener);
    view.setScale(SCORE_SCALE_DEFAULT);
    expect(listener).not.toHaveBeenCalled();
    view.setScale(SCORE_SCALE_DEFAULT + SCORE_SCALE_STEP);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('viewState: panels (FR-004, FR-006)', () => {
  it('starts with no panel open', () => {
    expect(createViewStateStore().get().openPanel).toBeNull();
  });

  it('opens a panel and replaces the one that was open', () => {
    const view = createViewStateStore();
    view.openPanel('midi');
    expect(view.get().openPanel).toBe('midi');
    view.openPanel('help');
    expect(view.get().openPanel).toBe('help');
  });

  it('closePanel leaves none open', () => {
    const view = createViewStateStore();
    view.openPanel('diagnostics');
    view.closePanel();
    expect(view.get().openPanel).toBeNull();
  });

  it('closeForRun closes whatever is open and is harmless when nothing is', () => {
    const view = createViewStateStore();
    view.openPanel('setup');
    view.closeForRun();
    expect(view.get().openPanel).toBeNull();

    const listener = vi.fn();
    view.subscribe(listener);
    view.closeForRun();
    expect(listener).not.toHaveBeenCalled();
  });

  it('reads an unknown panel id as no panel', () => {
    const view = createViewStateStore();
    view.openPanel('midi');
    view.openPanel('not-a-panel' as PanelId);
    expect(view.get().openPanel).toBeNull();
  });

  it('parsePanelId accepts exactly the ten known ids and nothing else', () => {
    expect(PANEL_IDS).toHaveLength(10);
    for (const id of PANEL_IDS) expect(parsePanelId(id)).toBe(id);
    for (const bad of ['', 'Midi', 'midi ', 'x', null, undefined, 3, {}, []]) expect(parsePanelId(bad)).toBeNull();
  });

  it('does not persist or expose openPanel through the overlay switches', () => {
    const view = createViewStateStore();
    view.openPanel('view');
    expect(Object.keys(view.get().overlays).sort()).toEqual(['advice', 'cursor', 'marks', 'notices', 'pianoKeys']);
  });
});

describe('viewState: overlay layers (FR-012, FR-015)', () => {
  it('starts from the documented defaults, with the piano keys off', () => {
    const { overlays } = createViewStateStore().get();
    expect(overlays).toEqual(OVERLAYS_DEFAULT);
    expect(overlays.pianoKeys).toBe(false);
    expect(overlays.cursor && overlays.marks && overlays.advice && overlays.notices).toBe(true);
  });

  it('setOverlay changes exactly one layer', () => {
    const view = createViewStateStore();
    view.setOverlay('cursor', false);
    expect(view.get().overlays).toEqual({ ...OVERLAYS_DEFAULT, cursor: false });
    view.setOverlay('pianoKeys', true);
    expect(view.get().overlays).toEqual({ ...OVERLAYS_DEFAULT, cursor: false, pianoKeys: true });
  });

  it('ignores an unknown layer name', () => {
    const view = createViewStateStore();
    // @ts-expect-error - a layer that does not exist must not create a field
    view.setOverlay('sparkles', true);
    expect(view.get().overlays).toEqual(OVERLAYS_DEFAULT);
  });

  it('does not share state between stores or with the exported defaults', () => {
    const first = createViewStateStore();
    const second = createViewStateStore();
    first.setOverlay('marks', false);
    expect(second.get().overlays.marks).toBe(true);
    expect(OVERLAYS_DEFAULT.marks).toBe(true);
  });
});
