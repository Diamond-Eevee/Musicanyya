import { MAX_PAGE_UNITS, MIN_PAGE_UNITS, SCORE_SCALE_MAX, SCORE_SCALE_MIN } from '../../engine/config.js';
import type { LayoutOptions } from '../score/verovio-client.js';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * The Verovio page that makes one page exactly one screenful of the Score viewport at the chosen size
 * (`contracts/score-layout.md` section 2). Pure, so it is tested in Node.
 *
 * Verovio lays the music out by `pageWidth` alone, so the user's size (`scale`, 100 = fitted) is expressed by
 * asking for a narrower or wider page: fewer interlines across it draws each one larger. Returns `null` when the
 * viewport has no usable size yet, so the caller keeps the last good layout instead of asking for a degenerate one.
 */
export function fitLayout(viewportWidthPx: number, viewportHeightPx: number, scale: number): LayoutOptions | null {
  if (![viewportWidthPx, viewportHeightPx, scale].every(Number.isFinite)) return null;
  if (viewportWidthPx <= 0 || viewportHeightPx <= 0) return null;

  const usable = clamp(scale, SCORE_SCALE_MIN, SCORE_SCALE_MAX);
  return {
    pageWidth: clamp(Math.round((viewportWidthPx * 100) / usable), MIN_PAGE_UNITS, MAX_PAGE_UNITS),
    pageHeight: clamp(Math.round((viewportHeightPx * 100) / usable), MIN_PAGE_UNITS, MAX_PAGE_UNITS),
    scale: usable,
  };
}
