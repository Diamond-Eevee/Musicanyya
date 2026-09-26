import { bpmLimits, shownBpm, type TempoBeat, type TempoDisplaySegment } from '../../core/tempo/tempo-display.js';
import { en } from '../i18n/en.js';
import type { MusicGlyphData } from '../score/verovio-client.js';

// contracts/tempo-field.md 1.0.0 (feature 012). Display part (US1); editing added in US2 (T034).

export interface TempoFieldModel {
  segment: TempoDisplaySegment | null;
  percent: number;
  locked: boolean;
  glyphs: MusicGlyphData | null;
}

/** Beats drawable as a real glyph (R-7): eighth, quarter, half, whole, with 0 or 1 dot. Anything else is a text label. */
const DRAWABLE_TYPES = new Set(['eighth', 'quarter', 'half', 'whole']);

/** English fallback matching src/core/tempo/beat-unit.ts's `beatLabel`, built from i18n keys for localisation. */
function localizedBeatLabel(beat: TempoBeat): string {
  const prefix = en.transport.beatDotPrefixes[beat.dots] ?? '';
  const name = en.transport.beatNames[beat.type] ?? beat.type;
  return `${prefix}${name}`;
}

function beatSymbolSvg(beat: TempoBeat, glyphs: MusicGlyphData): string {
  const unit = glyphs.unitsPerEm;
  const noteheadPath =
    beat.type === 'whole' ? glyphs.noteheadWhole : beat.type === 'half' ? glyphs.noteheadHalf : glyphs.notehead;
  const hasStem = beat.type !== 'whole';
  const hasFlag = beat.type === 'eighth';
  const width = unit * 1.6;
  const height = unit * 3;
  const noteheadY = height - unit * 0.5;
  const stemX = unit * 0.95;
  const stemTopY = noteheadY - unit * 2.2;
  const dotCx = unit * 1.35;
  return (
    `<svg data-id="tempo-beat" aria-hidden="true" class="tempo-beat-symbol" viewBox="0 0 ${width} ${height}">` +
    `<g transform="translate(${unit * 0.1}, ${noteheadY}) scale(1,-1)"><path d="${noteheadPath}"/></g>` +
    (hasStem ? `<rect x="${stemX}" y="${stemTopY}" width="${unit * 0.08}" height="${noteheadY - stemTopY}"/>` : '') +
    (hasFlag ? `<g transform="translate(${stemX}, ${stemTopY}) scale(1,-1)"><path d="${glyphs.flag8thUp}"/></g>` : '') +
    (beat.dots >= 1 ? `<circle cx="${dotCx}" cy="${noteheadY}" r="${unit * 0.07}"/>` : '') +
    '</svg>'
  );
}

/** null (no visible symbol) for a plain quarter beat, else an SVG string or a text-label span (data-id="tempo-beat"). */
function beatSymbolHtml(beat: TempoBeat, glyphs: MusicGlyphData | null): string {
  if (beat.type === 'quarter' && beat.dots === 0) return '';
  const label = localizedBeatLabel(beat);
  const drawable = glyphs !== null && DRAWABLE_TYPES.has(beat.type) && beat.dots <= 1;
  if (drawable) return beatSymbolSvg(beat, glyphs as MusicGlyphData);
  return `<span data-id="tempo-beat">${label}</span>`;
}

export class MxTempoField extends HTMLElement {
  private modelValue: TempoFieldModel = { segment: null, percent: 100, locked: false, glyphs: null };
  private built = false;

  set model(value: TempoFieldModel) {
    this.modelValue = value;
    if (!this.built) this.build();
    this.renderFromModel();
  }

  get model(): TempoFieldModel {
    return this.modelValue;
  }

  connectedCallback() {
    if (!this.built) this.build();
    this.renderFromModel();
  }

  private build(): void {
    this.built = true;
    this.innerHTML = `
      <span data-id="tempo-label">${en.transport.tempo}</span>
      <button type="button" data-id="tempo-down" aria-label="${en.transport.tempoDown}">−</button>
      <input data-id="tempo-bpm" type="text" inputmode="numeric" autocomplete="off" role="spinbutton" />
      <span data-id="tempo-unit">${en.transport.bpm}</span>
      <span class="tempo-beat-slot"></span>
      <button type="button" data-id="tempo-up" aria-label="${en.transport.tempoUp}">+</button>
      <button type="button" data-id="tempo-reset" aria-label="${en.transport.tempoReset}">↺</button>
      <span data-id="tempo-written"></span>
    `;
  }

  private renderFromModel(): void {
    const { segment, percent, locked, glyphs } = this.modelValue;
    this.hidden = segment === null;
    if (!segment) return;

    this.toggleAttribute('data-default', segment.isDefault);

    const shown = shownBpm(segment, percent);
    const { min, max } = bpmLimits(segment);
    const label = localizedBeatLabel(segment.beat);

    const input = this.querySelector('[data-id="tempo-bpm"]') as HTMLInputElement;
    const focused = this.ownerDocument.activeElement === input;
    if (!focused) input.value = String(shown);
    input.readOnly = locked;
    input.setAttribute('aria-valuenow', String(shown));
    input.setAttribute('aria-valuemin', String(min));
    input.setAttribute('aria-valuemax', String(max));
    input.setAttribute(
      'aria-valuetext',
      `${shown} ${en.transport.tempoValueUnit}, ${label} ${en.transport.tempoValueNote}`,
    );

    const beatSlot = this.querySelector('.tempo-beat-slot') as HTMLElement;
    beatSlot.innerHTML = beatSymbolHtml(segment.beat, glyphs);

    const written = this.querySelector('[data-id="tempo-written"]') as HTMLElement;
    if (segment.isDefault) {
      written.hidden = false;
      written.textContent = en.transport.defaultTempo;
    } else {
      const shownAtWritten = shownBpm(segment, 100);
      const differs = shown !== shownAtWritten;
      written.hidden = !differs;
      written.textContent = differs ? `${en.transport.writtenTempo} ${shownAtWritten}` : '';
    }

    const downBtn = this.querySelector('[data-id="tempo-down"]') as HTMLButtonElement;
    const upBtn = this.querySelector('[data-id="tempo-up"]') as HTMLButtonElement;
    const resetBtn = this.querySelector('[data-id="tempo-reset"]') as HTMLButtonElement;
    downBtn.disabled = locked || shown <= min;
    upBtn.disabled = locked || shown >= max;
    resetBtn.disabled = locked || percent === 100;
  }
}
customElements.define('mx-tempo-field', MxTempoField);
