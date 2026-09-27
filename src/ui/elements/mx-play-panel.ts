import type { RunSettings } from '../../core/play/types.js';
import type { HandSelection, LoopRange } from '../../core/practice/types.js';
import { en } from '../i18n/en.js';
import { type PlaySetup, playState } from '../state/playState.js';
import { practiceState } from '../state/practiceState.js';
import './mx-tempo-field.js';
import type { TempoChangeDetail, TempoFieldModel } from './mx-tempo-field.js';

/** What the panel emits when the musician changes a setting (FR-036 to FR-039). */
export interface PlaySetupChange {
  partIndex?: number;
  selection?: HandSelection;
  range?: LoopRange | null;
  tempoPercent?: number;
  strictness?: RunSettings['strictness'];
  countInMeasures?: number;
  metronomeMuted?: boolean;
  accompaniment?: boolean;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function handLabel(hand: HandSelection, all: readonly HandSelection[]): string {
  const s = en.play.setup;
  const twoStaves = all.length === 3;
  if (hand.preset === 'both') return twoStaves ? s.both : s.allStaves;
  if (hand.preset === 'right') return s.right;
  if (hand.preset === 'left') return s.left;
  return s.staff.replace('{n}', String(hand.staves.join(', ')));
}

function sameStaves(a: HandSelection | null, b: HandSelection): boolean {
  return !!a && a.partIndex === b.partIndex && a.staves.join(',') === b.staves.join(',');
}

/** Part, hand and run-settings choices for Play mode (T066). A pure view of `playState`: it renders what it is
 *  given and reports choices as `playsetup` events; it decides nothing (Constitution V). */
export class MxPlayPanel extends HTMLElement {
  private unsubscribe?: () => void;
  private unsubscribeMode?: () => void;

  connectedCallback() {
    this.unsubscribe = playState.subscribe(() => this.render());
    // Visibility depends on practiceState.mode (line ~58), not just playState - without this the panel stayed
    // hidden after switching to Play mode on an already-loaded Score, since that switch touches no PlayState.
    this.unsubscribeMode = practiceState.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
    this.unsubscribeMode?.();
  }

  private emit(change: PlaySetupChange) {
    this.dispatchEvent(new CustomEvent<PlaySetupChange>('playsetup', { detail: change, bubbles: true }));
  }

  private render() {
    const mode = practiceState.get().mode;
    const setup = playState.get().setup;
    this.hidden = mode !== 'play' || setup === null;
    if (this.hidden || !setup) {
      this.innerHTML = '';
      return;
    }

    const focusedId = (document.activeElement as HTMLElement | null)?.dataset?.id;
    this.innerHTML = this.template(setup);
    this.wire(setup);
    if (focusedId) (this.querySelector(`[data-id="${CSS.escape(focusedId)}"]`) as HTMLElement | null)?.focus();
  }

  private template(setup: PlaySetup): string {
    const s = en.play.setup;
    const { settings, parts, hands, measureCount } = setup;

    const partsHtml =
      parts.length > 1
        ? `<label class="play-part">${s.part}
            <select data-id="part">${parts
              .map(
                (part) =>
                  `<option value="${part.partIndex}" ${part.partIndex === settings.selection.partIndex ? 'selected' : ''}>${escapeHtml(part.name)}</option>`,
              )
              .join('')}</select>
          </label>`
        : '';

    const handsHtml =
      hands.length > 1
        ? `<fieldset class="play-hands"><legend>${s.hands}</legend>${hands
            .map(
              (hand, i) =>
                `<label><input type="radio" name="play-hands" data-id="hand-${i}" value="${i}" ${sameStaves(settings.selection, hand) ? 'checked' : ''} /> ${handLabel(hand, hands)}</label>`,
            )
            .join('')}</fieldset>`
        : '';

    const accompanimentHtml =
      hands.length > 1 || parts.length > 1
        ? `<label class="play-accompaniment"><input type="checkbox" name="play-accompaniment" data-id="accompaniment" ${settings.accompaniment ? 'checked' : ''} /> ${s.accompaniment}</label>`
        : '';

    const range = settings.range;
    const rangeValue = (index: number | undefined) => (index === undefined ? '' : String(index + 1));
    const rangeField = (id: string, label: string, index: number | undefined) =>
      `<label>${label} <input type="number" data-id="${id}" min="1" max="${measureCount}" step="1" value="${rangeValue(index)}" /></label>`;
    const rangeStatus = range
      ? `<p class="play-range-status">${s.rangeStatus
          .replace('{from}', String(Math.min(range.fromMeasureIndex, range.toMeasureIndex) + 1))
          .replace('{to}', String(Math.max(range.fromMeasureIndex, range.toMeasureIndex) + 1))}</p>`
      : '';
    const rangeHtml = `<fieldset class="play-range"><legend>${s.range}</legend>
        ${rangeField('range-from', s.rangeFrom, range?.fromMeasureIndex)}
        ${rangeField('range-to', s.rangeTo, range?.toMeasureIndex)}
        <button type="button" data-id="range-clear" ${range ? '' : 'disabled'}>${s.rangeClear}</button>
        ${rangeStatus}
      </fieldset>`;

    // FR-018: the same tempo field as the transport, editing the Play setup instead of the transport factor
    // (feature 012, US3) - replaces the percentage <select>.
    const tempoHtml = `<div class="play-tempo"><mx-tempo-field></mx-tempo-field></div>`;

    const strictnessOptions: RunSettings['strictness'][] = ['beginner', 'standard', 'strict'];
    const strictnessLabels: Record<string, string> = {
      beginner: s.strictnessBeginner,
      standard: s.strictnessStandard,
      strict: s.strictnessStrict,
    };
    const strictnessHtml = `<label class="play-strictness">${s.strictness}
        <select data-id="strictness">${strictnessOptions
          .map(
            (level) =>
              `<option value="${level}" ${level === settings.strictness ? 'selected' : ''}>${strictnessLabels[level]}</option>`,
          )
          .join('')}
        </select>
      </label>`;

    const n = settings.countInMeasures;
    const countInLabel = (n === 1 ? s.countInMeasures : s.countInMeasuresPlural).replace('{n}', String(n));
    const countInHtml = `<label class="play-count-in">${s.countIn}
        <input type="number" data-id="count-in" min="1" max="8" step="1" value="${n}" title="${countInLabel}" />
      </label>`;

    const metronomeHtml = `<label class="play-metronome"><input type="checkbox" name="play-metronome-muted" data-id="metronome-muted" ${settings.metronomeMuted ? 'checked' : ''} /> ${s.metronomeMuted}</label>`;

    return `<h2 class="play-heading">${s.heading}</h2>
      ${partsHtml}${handsHtml}${accompanimentHtml}${rangeHtml}${tempoHtml}${strictnessHtml}${countInHtml}${metronomeHtml}`;
  }

  private wire(setup: PlaySetup) {
    this.querySelector('select[data-id="part"]')?.addEventListener('change', (event) => {
      this.emit({ partIndex: Number((event.target as HTMLSelectElement).value) });
    });

    for (const radio of this.querySelectorAll<HTMLInputElement>('input[name="play-hands"]')) {
      radio.addEventListener('change', () => {
        const hand = setup.hands[Number(radio.value)];
        if (hand && radio.checked) this.emit({ selection: hand });
      });
    }

    this.querySelector<HTMLInputElement>('[data-id="accompaniment"]')?.addEventListener('change', (event) => {
      this.emit({ accompaniment: (event.target as HTMLInputElement).checked });
    });

    const from = this.querySelector<HTMLInputElement>('[data-id="range-from"]');
    const to = this.querySelector<HTMLInputElement>('[data-id="range-to"]');
    const onRangeField = () => {
      const start = this.measureIndexOf(from, setup.measureCount);
      const end = this.measureIndexOf(to, setup.measureCount);
      if (start === null || end === null) return;
      this.emit({ range: { fromMeasureIndex: start, toMeasureIndex: end } });
      this.render();
    };
    from?.addEventListener('change', onRangeField);
    to?.addEventListener('change', onRangeField);
    this.querySelector('[data-id="range-clear"]')?.addEventListener('click', () => this.emit({ range: null }));

    const tempoField = this.querySelector('mx-tempo-field') as HTMLElement & { model: TempoFieldModel };
    tempoField.model = this.tempoModel(setup);
    tempoField.addEventListener('tempochange', (event) => {
      this.emit({ tempoPercent: (event as CustomEvent<TempoChangeDetail>).detail.percent });
    });

    this.querySelector<HTMLSelectElement>('[data-id="strictness"]')?.addEventListener('change', (event) => {
      this.emit({ strictness: (event.target as HTMLSelectElement).value as RunSettings['strictness'] });
    });

    this.querySelector<HTMLInputElement>('[data-id="count-in"]')?.addEventListener('change', (event) => {
      const v = Number((event.target as HTMLInputElement).value);
      if (Number.isInteger(v) && v >= 1 && v <= 8) this.emit({ countInMeasures: v });
    });

    this.querySelector<HTMLInputElement>('[data-id="metronome-muted"]')?.addEventListener('change', (event) => {
      this.emit({ metronomeMuted: (event.target as HTMLInputElement).checked });
    });
  }

  /** The Play setup's tempo field model (FR-017): the session-computed range-start segment and factor, read-only
   *  during a run's count-in or while it is running (the same lock as the transport's own field in Play mode). */
  private tempoModel(setup: PlaySetup): TempoFieldModel {
    const phase = playState.get().run?.phase;
    return {
      segment: setup.tempoSegment,
      percent: setup.settings.tempoPercent,
      locked: phase === 'countIn' || phase === 'running',
      glyphs: setup.glyphs,
    };
  }

  private measureIndexOf(input: HTMLInputElement | null, measureCount: number): number | null {
    const text = input?.value.trim() ?? '';
    if (text === '') return null;
    const number = Number(text);
    if (!Number.isFinite(number)) return null;
    return Math.min(Math.max(Math.round(number), 1), Math.max(measureCount, 1)) - 1;
  }
}
customElements.define('mx-play-panel', MxPlayPanel);
