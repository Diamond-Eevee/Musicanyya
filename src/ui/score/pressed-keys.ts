import type { Box, DiscSlot, StaffGeometry } from './disc-layout.js';
import type { MusicGlyphData } from './verovio-client.js';

/**
 * The red discs the Score shows for held keys that are not written at the current event (feature 008, research R-04,
 * R-11): a solid vermilion ellipse at the printed pitch, with the ledger lines and accidental it needs and an ottava
 * label when it was folded. Drawn on the overlay canvas above the notes; never dashed (SC-003).
 */

/** The Okabe-Ito vermilion of `--practice-disc-color`: canvas drawing takes a literal colour like the other marks do. */
export const DISC_COLOR = '#d55e00';

/** `--practice-heldover-color` and `--practice-skipped-color` as literals for the canvas. */
export const HELD_OVER_COLOR = '#e69f00';
export const SKIPPED_COLOR = '#999999';

/** How far a ledger line reaches past the disc on each side, in staff spaces. */
const LEDGER_OVERHANG_SPACES = 0.4;
/** Tilt of the disc, like the slant of an engraved notehead. */
export const DISC_TILT_RADIANS = -0.35;
/** The ottava label sits beside the disc, in staff spaces, and is this tall. */
const LABEL_OFFSET_SPACES = 0.35;
const LABEL_SIZE_SPACES = 1.1;

const OTTAVA_LABEL: Record<number, string> = {
  1: '8va',
  2: '15ma',
  3: '22ma',
  '-1': '8vb',
  '-2': '15mb',
  '-3': '22mb',
};

/** The accidental glyphs as canvas paths in font units (y up), plus how many font units make a staff space. */
export interface MusicGlyphs {
  sharp: Path2D;
  flat: Path2D;
  natural: Path2D;
  unitsPerSpace: number;
}

/** Turns the worker's path data into canvas paths; null when there is none or the platform has no `Path2D`. */
export function toMusicGlyphs(data: MusicGlyphData | null | undefined): MusicGlyphs | null {
  if (!data || typeof Path2D === 'undefined' || !(data.unitsPerEm > 0)) return null;
  return {
    sharp: new Path2D(data.sharp),
    flat: new Path2D(data.flat),
    natural: new Path2D(data.natural),
    unitsPerSpace: data.unitsPerEm / 4,
  };
}

export interface DiscOptions {
  ctx: CanvasRenderingContext2D;
  dpr: number;
  containerRect: DOMRect;
  slots: readonly DiscSlot[];
  /** The measured geometry of each staff a slot may be on, by staff number; a slot on another staff is skipped. */
  staff: ReadonlyMap<number, StaffGeometry>;
  /** Null draws discs without accidentals. */
  glyphs: MusicGlyphs | null;
  /** False when the user has switched the marks layer off: nothing is drawn, the session is unaffected. */
  visible: boolean;
}

export function drawPressedKeyDiscs(options: DiscOptions): void {
  const { ctx, dpr, containerRect, slots, staff, glyphs, visible } = options;
  if (!visible || slots.length === 0) return;
  const px = (x: number) => (x - containerRect.left) * dpr;
  const py = (y: number) => (y - containerRect.top) * dpr;

  for (const slot of slots) {
    const geometry = staff.get(slot.placement.staff);
    if (!geometry) continue;
    const { placement } = slot;
    const { space } = geometry;

    // Ledger lines, in the staff-line width, wider than the disc
    const lines = Math.abs(placement.ledgerLines);
    if (lines > 0) {
      ctx.strokeStyle = DISC_COLOR;
      ctx.lineWidth = geometry.lineWidth * dpr;
      const reach = slot.width / 2 + LEDGER_OVERHANG_SPACES * space;
      const topLineY = geometry.bottomLineY - 4 * space;
      for (let k = 1; k <= lines; k++) {
        const y = placement.ledgerLines < 0 ? geometry.bottomLineY + k * space : topLineY - k * space;
        ctx.beginPath();
        ctx.moveTo(px(slot.x - reach), py(y));
        ctx.lineTo(px(slot.x + reach), py(y));
        ctx.stroke();
      }
    }

    // The disc
    ctx.fillStyle = DISC_COLOR;
    ctx.beginPath();
    ctx.ellipse(
      px(slot.x),
      py(slot.y),
      (slot.width / 2) * dpr,
      (slot.height / 2) * dpr,
      DISC_TILT_RADIANS,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    // The accidental: the real font glyph, scaled from font units (y up) to the staff space
    if (placement.showAccidental && slot.accidentalX !== null && glyphs) {
      const path = placement.alter > 0 ? glyphs.sharp : placement.alter < 0 ? glyphs.flat : glyphs.natural;
      const k = (space / glyphs.unitsPerSpace) * dpr;
      ctx.save();
      ctx.translate(px(slot.accidentalX), py(slot.y));
      ctx.scale(k, -k);
      ctx.fillStyle = DISC_COLOR;
      ctx.fill(path);
      ctx.restore();
    }

    // The ottava label, when the disc was drawn closer to the staff than its pitch
    const label = OTTAVA_LABEL[placement.ottava];
    if (label) {
      ctx.fillStyle = DISC_COLOR;
      ctx.font = `italic ${LABEL_SIZE_SPACES * space * dpr}px serif`;
      ctx.textBaseline = 'middle';
      ctx.fillText(label, px(slot.x + slot.width / 2 + LABEL_OFFSET_SPACES * space), py(slot.y));
    }
  }
}

/** The box a held-over chevron occupies above a notehead box (what `drawStateChevron` draws), for keeping other marks
 *  clear of it. */
export function chevronBox(noteheadRect: DOMRect): { left: number; right: number; top: number; bottom: number } {
  const w = noteheadRect.width;
  const h = noteheadRect.height;
  const cx = (noteheadRect.left + noteheadRect.right) / 2;
  const base = noteheadRect.top - 0.15 * h;
  return { left: cx - 0.45 * w, right: cx + 0.45 * w, top: base - 0.6 * h, bottom: base };
}

interface StateChevronBase {
  ctx: CanvasRenderingContext2D;
  dpr: number;
  containerRect: DOMRect;
}
export type StateChevronOptions =
  | (StateChevronBase & {
      kind: 'heldOver';
      /** The box of the note's `g.notehead` (not the whole note: a stem must not push the chevron away). */
      noteheadRect: DOMRect;
    })
  | (StateChevronBase & {
      kind: 'skipped';
      /** Where the skip icon goes: `skipIconBox` of the column's heads (009 R-13), so it never covers a head. */
      box: Box;
    });

/** Where the skip icon's triangle ends and its bar begins, as a fraction of the box's width. */
const SKIP_ICON_TIP = 0.7;

/**
 * The marker that tells a held-over or skipped/missed note apart without colour (feature 008, research R-03; 009 FR-016).
 * Held-over: a small solid upward chevron above the notehead ("lift the key"), sized from the notehead box, entirely
 * outside it and within one staff space of it. Skipped (Practice) and missed (a Grade): the skip icon - a solid
 * right-pointing triangle with a bar at its tip, like a media "skip" sign, which cannot be read as an accent - filled into
 * `box` (`skipIconBox` of the column's heads), so it never covers a head or an accidental.
 */
export function drawStateChevron(options: StateChevronOptions): void {
  const { ctx, dpr, containerRect } = options;
  const px = (x: number) => (x - containerRect.left) * dpr;
  const py = (y: number) => (y - containerRect.top) * dpr;

  if (options.kind === 'skipped') {
    const { box } = options;
    const tipX = box.left + SKIP_ICON_TIP * (box.right - box.left);
    ctx.fillStyle = SKIPPED_COLOR;
    ctx.beginPath();
    ctx.moveTo(px(box.left), py(box.top));
    ctx.lineTo(px(tipX), py((box.top + box.bottom) / 2));
    ctx.lineTo(px(box.left), py(box.bottom));
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(px(tipX), py(box.top), (box.right - tipX) * dpr, (box.bottom - box.top) * dpr);
    return;
  }

  const box = chevronBox(options.noteheadRect);
  const cx = (options.noteheadRect.left + options.noteheadRect.right) / 2;
  ctx.strokeStyle = HELD_OVER_COLOR;
  ctx.lineWidth = 2 * dpr;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(px(box.left), py(box.bottom));
  ctx.lineTo(px(cx), py(box.top));
  ctx.lineTo(px(box.right), py(box.bottom));
  ctx.stroke();
}
