import { describe, expect, it } from 'vitest';
import { ANCHOR_GAP_PX, anchorRect } from '../../src/ui/layout/anchor.js';

const viewport = { width: 1000, height: 700 };
const popup = { width: 300, height: 200 };

/** research R-3: CSS Anchor Positioning is not used, so menus and panels are placed by this pure helper. */
describe('anchorRect', () => {
  it('places the popup under its invoker, left edges aligned, by default', () => {
    const invoker = { left: 100, top: 10, width: 80, height: 30 };
    expect(anchorRect(invoker, popup, viewport, 'below-start')).toEqual({
      left: 100,
      top: 10 + 30 + ANCHOR_GAP_PX,
      side: 'below',
    });
  });

  it('below-end aligns the right edges instead', () => {
    const invoker = { left: 500, top: 10, width: 80, height: 30 };
    expect(anchorRect(invoker, popup, viewport, 'below-end')).toMatchObject({ left: 500 + 80 - 300, side: 'below' });
  });

  it('shifts left so the popup does not leave the right edge of the viewport', () => {
    const invoker = { left: 900, top: 10, width: 80, height: 30 };
    expect(anchorRect(invoker, popup, viewport, 'below-start').left).toBe(viewport.width - popup.width);
  });

  it('shifts right when below-end would start left of the viewport', () => {
    const invoker = { left: 20, top: 10, width: 80, height: 30 };
    expect(anchorRect(invoker, popup, viewport, 'below-end').left).toBe(0);
  });

  it('flips above the invoker when there is no room below but room above', () => {
    const invoker = { left: 100, top: 600, width: 80, height: 30 };
    expect(anchorRect(invoker, popup, viewport, 'below-start')).toEqual({
      left: 100,
      top: 600 - ANCHOR_GAP_PX - popup.height,
      side: 'above',
    });
  });

  it('stays below when it fits below even if there is more room above', () => {
    const invoker = { left: 100, top: 400, width: 80, height: 30 };
    expect(anchorRect(invoker, popup, viewport, 'below-start').side).toBe('below');
  });

  it('shifts into the viewport when it fits neither below nor above', () => {
    const tall = { width: 300, height: 650 };
    const invoker = { left: 100, top: 300, width: 80, height: 30 };
    const placed = anchorRect(invoker, tall, viewport, 'below-start');
    expect(placed.top).toBe(viewport.height - tall.height);
    expect(placed.top).toBeGreaterThanOrEqual(0);
  });

  it('never returns a negative offset, even for a popup larger than the viewport', () => {
    const huge = { width: 2000, height: 1500 };
    const invoker = { left: 400, top: 300, width: 80, height: 30 };
    for (const placement of ['below-start', 'below-end'] as const) {
      const placed = anchorRect(invoker, huge, viewport, placement);
      expect(placed.left).toBeGreaterThanOrEqual(0);
      expect(placed.top).toBeGreaterThanOrEqual(0);
    }
    expect(anchorRect(invoker, huge, viewport, 'below-start')).toMatchObject({ left: 0, top: 0 });
  });

  it('is deterministic and does not mutate its inputs', () => {
    const invoker = Object.freeze({ left: 100, top: 10, width: 80, height: 30 });
    const frozenPopup = Object.freeze({ ...popup });
    const frozenViewport = Object.freeze({ ...viewport });
    expect(anchorRect(invoker, frozenPopup, frozenViewport, 'below-start')).toEqual(
      anchorRect(invoker, frozenPopup, frozenViewport, 'below-start'),
    );
  });
});
