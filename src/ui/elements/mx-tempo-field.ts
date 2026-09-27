import {
  bpmLimits,
  percentForBpm,
  shownBpm,
  type TempoBeat,
  type TempoDisplaySegment,
} from '../../core/tempo/tempo-display.js';
import { TEMPO_BPM_DIGITS_MAX, TEMPO_BPM_STEP, TEMPO_PERCENT_DEFAULT } from '../../engine/config.js';
import { localizedBeatLabel } from '../format/beat-label.js';
import { en } from '../i18n/en.js';
import type { MusicGlyphData } from '../score/verovio-client.js';

// contracts/tempo-field.md 1.0.0 (feature 012): display (US1) and editing (US2).

export interface TempoFieldModel {
  segment: TempoDisplaySegment | null;
  percent: number;
  locked: boolean;
  glyphs: MusicGlyphData | null;
}

export type TempoChangeSource = 'typed' | 'step' | 'reset';

/** Detail of the bubbling `tempochange` event: `percent` is already clamped, the host just applies it. */
export interface TempoChangeDetail {
  percent: number;
  source: TempoChangeSource;
}

/** The apply rule's text test: 1 to TEMPO_BPM_DIGITS_MAX digits, nothing else (no sign, space or decimal point). */
function isBpmText(text: string): boolean {
  if (text.length === 0 || text.length > TEMPO_BPM_DIGITS_MAX) return false;
  for (const char of text) {
    if (char < '0' || char > '9') return false;
  }
  return true;
}

/** Beats drawable as a real glyph (R-7): eighth, quarter, half, whole, with 0 or 1 dot. Anything else is a text label. */
const DRAWABLE_TYPES = new Set(['eighth', 'quarter', 'half', 'whole']);

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
  /** The input holds text the user typed and has not applied yet: live model updates must not replace it (FR-007).
   *  A focused input that was not edited (after ArrowUp, say) still follows the model. */
  private editing = false;

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
      <input data-id="tempo-bpm" type="text" inputmode="numeric" autocomplete="off" role="spinbutton" aria-label="${en.transport.tempo}" />
      <span data-id="tempo-unit">${en.transport.bpm}</span>
      <span class="tempo-beat-slot"></span>
      <button type="button" data-id="tempo-up" aria-label="${en.transport.tempoUp}">+</button>
      <button type="button" data-id="tempo-reset" aria-label="${en.transport.tempoReset}">↺</button>
      <span data-id="tempo-written"></span>
    `;
    const input = this.bpmInput();
    input.addEventListener('input', () => {
      this.editing = true;
    });
    input.addEventListener('keydown', (event) => this.onKeydown(event));
    input.addEventListener('blur', () => {
      if (this.editing) this.applyTyped();
    });
    this.button('tempo-down').addEventListener('click', () => this.step(-TEMPO_BPM_STEP));
    this.button('tempo-up').addEventListener('click', () => this.step(TEMPO_BPM_STEP));
    this.button('tempo-reset').addEventListener('click', () => this.reset());
  }

  private bpmInput(): HTMLInputElement {
    return this.querySelector('[data-id="tempo-bpm"]') as HTMLInputElement;
  }

  private button(id: string): HTMLButtonElement {
    return this.querySelector(`[data-id="${id}"]`) as HTMLButtonElement;
  }

  private emit(percent: number, source: TempoChangeSource): void {
    this.dispatchEvent(
      new CustomEvent<TempoChangeDetail>('tempochange', { bubbles: true, composed: true, detail: { percent, source } }),
    );
  }

  private onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      // Escape belongs to the field while it is focused: it must not close a panel or stop a run (contract).
      event.stopPropagation();
      this.restore();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.applyTyped();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.step(event.key === 'ArrowUp' ? TEMPO_BPM_STEP : -TEMPO_BPM_STEP);
    }
  }

  /** Puts the shown value back into the input and forgets any typed text; emits nothing. */
  private restore(): void {
    this.editing = false;
    const { segment, percent } = this.modelValue;
    if (segment) this.bpmInput().value = String(shownBpm(segment, percent));
  }

  /** Enter / blur: a valid number becomes the tempo (clamped to the limits, and what plays is what is shown);
   *  anything else, or the value already in force, is restored and nothing is emitted. */
  private applyTyped(): void {
    const { segment, percent, locked } = this.modelValue;
    const text = this.bpmInput().value.trim();
    if (!segment || locked || !isBpmText(text)) {
      this.restore();
      return;
    }
    const next = percentForBpm(segment, Number(text));
    const nextShown = shownBpm(segment, next);
    if (nextShown === shownBpm(segment, percent) && next === percent) {
      this.restore();
      return;
    }
    this.editing = false;
    this.bpmInput().value = String(nextShown);
    this.emit(next, 'typed');
  }

  /** One step control press: one BPM from the shown value, applied at once. */
  private step(delta: number): void {
    const { segment, percent, locked } = this.modelValue;
    if (!segment || locked) return;
    const shown = shownBpm(segment, percent);
    const { min, max } = bpmLimits(segment);
    const target = Math.min(max, Math.max(min, shown + delta));
    if (target === shown) return;
    this.editing = false;
    const next = percentForBpm(segment, target);
    this.bpmInput().value = String(shownBpm(segment, next));
    this.emit(next, 'step');
  }

  private reset(): void {
    const { segment, percent, locked } = this.modelValue;
    if (!segment || locked || percent === TEMPO_PERCENT_DEFAULT) return;
    this.editing = false;
    this.bpmInput().value = String(shownBpm(segment, TEMPO_PERCENT_DEFAULT));
    this.emit(TEMPO_PERCENT_DEFAULT, 'reset');
  }

  private renderFromModel(): void {
    const { segment, percent, locked, glyphs } = this.modelValue;
    this.hidden = segment === null;
    if (!segment) return;

    this.toggleAttribute('data-default', segment.isDefault);

    const shown = shownBpm(segment, percent);
    const { min, max } = bpmLimits(segment);
    const label = localizedBeatLabel(segment.beat);

    if (locked) this.editing = false;
    const input = this.bpmInput();
    if (!this.editing) input.value = String(shown);
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

    this.button('tempo-down').disabled = locked || shown <= min;
    this.button('tempo-up').disabled = locked || shown >= max;
    this.button('tempo-reset').disabled = locked || percent === TEMPO_PERCENT_DEFAULT;
  }
}
customElements.define('mx-tempo-field', MxTempoField);
