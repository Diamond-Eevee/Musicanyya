import { BRAND_SMALL_BELOW_PX } from '../../engine/config.js';

/**
 * The Musicanyya mark (brand.md 1.0.0 section 1, research R-10): two stems-up eighth notes whose stems are the
 * outer strokes of an M. From each stem top a beam-weight stroke slants down to the centre, forming the M's valley.
 * Filled, tilted note heads sit at the stem feet, left of their stems as in engraving. Drawn on a 32-unit grid as
 * plain paths with `fill="currentColor"`. Original work of the project (FR-017).
 *
 * The path data is computed once from the grid parameters below, so the two variants stay the same drawing.
 */
export type LogoVariant = 'regular' | 'small';

interface MarkGrid {
  /** Stem width. */
  readonly stem: number;
  /** Beam weight, measured across the stroke. */
  readonly beam: number;
  /** Note head half-axes and tilt (degrees, negative = rising to the right). */
  readonly headRx: number;
  readonly headRy: number;
  readonly headTilt: number;
  /** Centre line of both heads. */
  readonly headY: number;
  /** Distance between the two head centres. */
  readonly spread: number;
  /** Top of the stems and beams. */
  readonly top: number;
  /** How far the valley's upper edge dips below `top`. */
  readonly valley: number;
}

const GRID = 32;

const GRIDS: Record<LogoVariant, MarkGrid> = {
  regular: {
    stem: 2,
    beam: 2.8,
    headRx: 4.6,
    headRy: 3.2,
    headTilt: -20,
    headY: 24.6,
    spread: 17,
    top: 3.6,
    valley: 8.5,
  },
  // 16-23 px: heavier strokes and larger heads so it still reads as two joined notes (SC-007). With
  // TILE_MARK_SCALE.small, stem and spread put both stems exactly 1 px wide on whole pixels (5 and 13) of the 16 px
  // tile, so they render crisp instead of as grey half-pixels.
  small: {
    stem: 2.48,
    beam: 3.4,
    headRx: 5.1,
    headRy: 3.7,
    headTilt: -20,
    headY: 24,
    spread: 19.83,
    top: 3.2,
    valley: 8.4,
  },
};

/** Tile (app icon, favicon): the mark in white on Paper's ink blue (brand.md section 1). */
const TILE_FILL = '#1f3a5f';
const TILE_MARK = '#ffffff';
const TILE_RADIUS = 6; // of 32
/** The tile is also a standalone file (favicon.svg), so it names itself. */
const TILE_TITLE = 'Musicanyya';
/** Share of the tile the mark's grid takes, keeping the heads clear of the rounded corners. */
const TILE_MARK_SCALE: Record<LogoVariant, number> = { regular: 0.8, small: 0.807 };

const n = (v: number): string => String(Math.round(v * 100) / 100);

function headPath(cx: number, cy: number, g: MarkGrid): string {
  const t = (g.headTilt * Math.PI) / 180;
  const dx = g.headRx * Math.cos(t);
  const dy = g.headRx * Math.sin(t);
  const arc = `A${n(g.headRx)} ${n(g.headRy)} ${n(g.headTilt)} 0 1`;
  return `M${n(cx - dx)} ${n(cy - dy)}${arc} ${n(cx + dx)} ${n(cy + dy)}${arc} ${n(cx - dx)} ${n(cy - dy)}Z`;
}

function markPaths(g: MarkGrid): string[] {
  const t = (g.headTilt * Math.PI) / 180;
  // Rightmost point of the tilted ellipse: where the stem meets the head.
  const u = Math.atan2(-g.headRy * Math.sin(t), g.headRx * Math.cos(t));
  const reachX = g.headRx * Math.cos(u) * Math.cos(t) - g.headRy * Math.sin(u) * Math.sin(t);
  const reachY = g.headRx * Math.cos(u) * Math.sin(t) + g.headRy * Math.sin(u) * Math.cos(t);

  const leftHead = GRID / 2 - g.spread / 2;
  const rightHead = leftHead + g.spread;
  const foot = g.headY + reachY;
  const left = leftHead + reachX - g.stem; // outer edge of the left stem
  const right = rightHead + reachX; // outer edge of the right stem
  const mid = (left + right) / 2;
  const valleyTop = g.top + g.valley;

  const slope = g.valley / (mid - left);
  const drop = g.beam * Math.sqrt(1 + slope * slope); // vertical thickness of a slanted beam
  const inner = g.top + drop + g.stem * slope; // where a beam's lower edge meets a stem's inner edge

  const m = [
    `M${n(left)} ${n(foot)}`,
    `V${n(g.top)}`,
    `L${n(mid)} ${n(valleyTop)}`,
    `L${n(right)} ${n(g.top)}`,
    `V${n(foot)}`,
    `H${n(right - g.stem)}`,
    `V${n(inner)}`,
    `L${n(mid)} ${n(valleyTop + drop)}`,
    `L${n(left + g.stem)} ${n(inner)}`,
    `V${n(foot)}`,
    'Z',
  ].join('');
  return [m, headPath(leftHead, g.headY, g), headPath(rightHead, g.headY, g)];
}

const PATHS: Record<LogoVariant, string> = {
  regular: markPaths(GRIDS.regular)
    .map((d) => `<path d="${d}"/>`)
    .join(''),
  small: markPaths(GRIDS.small)
    .map((d) => `<path d="${d}"/>`)
    .join(''),
};

const escapeText = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The mark alone, in the current text colour. Hidden from assistive technology unless it has a title. */
export function logoMarkSvg(opts: { variant?: LogoVariant; title?: string }): string {
  const variant = opts.variant ?? 'regular';
  const labelled = opts.title !== undefined;
  const a11y = labelled ? 'role="img"' : 'aria-hidden="true"';
  const title = labelled ? `<title>${escapeText(opts.title ?? '')}</title>` : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" class="mx-logo-mark" viewBox="0 0 ${GRID} ${GRID}" ` +
    `fill="currentColor" focusable="false" ${a11y}>${title}${PATHS[variant]}</svg>`
  );
}

/** The app-icon tile at `size` px; the variant follows the size (brand.md section 1). */
export function logoTileSvg(size: number): string {
  const variant: LogoVariant = size < BRAND_SMALL_BELOW_PX ? 'small' : 'regular';
  const k = TILE_MARK_SCALE[variant];
  const offset = (GRID * (1 - k)) / 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<title>${TILE_TITLE}</title><rect width="${size}" height="${size}" rx="${n((size * TILE_RADIUS) / GRID)}" fill="${TILE_FILL}"/>` +
    `<g fill="${TILE_MARK}" transform="scale(${n(size / GRID)}) translate(${n(offset)} ${n(offset)}) scale(${k})">` +
    `${PATHS[variant]}</g></svg>`
  );
}
