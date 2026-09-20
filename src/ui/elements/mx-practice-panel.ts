import type { HandSelection, LoopRange, ResolvedLoop } from '../../core/practice/types.js';
import { en, ordinal } from '../i18n/en.js';
import { type PracticeSetup, practiceState } from '../state/practiceState.js';

/** What the panel reports when the musician chooses something; session.ts applies it (FR-013, FR-025a, FR-032).
 *  `loop` is a range as typed - possibly reversed - and `null` clears the loop (FR-016, AS-3.3, AS-3.4). */
export interface PracticeSetupChange {
  partIndex?: number;
  selection?: HandSelection;
  accompaniment?: boolean;
  loop?: LoopRange | null;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Which hand a selection is called (FR-034): "right" and "left" are presets over the staves of a two-staff part,
 *  and a part with more staves is spoken of as staves, never as hands. */
function handLabel(hand: HandSelection, all: readonly HandSelection[]): string {
  const p = en.practice.panel;
  const twoStaves = all.length === 3;
  if (hand.preset === 'both') return twoStaves ? p.both : p.allStaves;
  if (hand.preset === 'right') return p.right;
  if (hand.preset === 'left') return p.left;
  return p.staff.replace('{n}', String(hand.staves.join(', ')));
}

function sameStaves(a: HandSelection | null, b: HandSelection): boolean {
  return !!a && a.partIndex === b.partIndex && a.staves.join(',') === b.staves.join(',');
}

/** Part, hand and accompaniment choices for Practice mode. A pure view of `practiceState`: it renders what it is
 *  given and reports choices as `practicesetup` events; it decides nothing (Constitution V). */
export class MxPracticePanel extends HTMLElement {
  private unsubscribe?: () => void;

  connectedCallback() {
    this.unsubscribe = practiceState.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
  }

  private emit(change: PracticeSetupChange) {
    this.dispatchEvent(new CustomEvent<PracticeSetupChange>('practicesetup', { detail: change, bubbles: true }));
  }

  private render() {
    const { mode, setup, startMeasureIndex, session } = practiceState.get();
    this.hidden = mode !== 'practice' || setup === null;
    if (this.hidden || !setup) {
      this.innerHTML = '';
      return;
    }

    // Keep keyboard focus on the same control across the re-render that follows a choice.
    const focusedId = (document.activeElement as HTMLElement | null)?.dataset?.id;
    this.innerHTML = this.template(setup, startMeasureIndex, session?.loop ?? null);
    this.wire(setup);
    if (focusedId) (this.querySelector(`[data-id="${CSS.escape(focusedId)}"]`) as HTMLElement | null)?.focus();
  }

  private template(setup: PracticeSetup, startMeasureIndex: number | null, running: ResolvedLoop | null): string {
    const p = en.practice.panel;
    if (setup.selection === null) {
      return `<h2 class="practice-heading">${p.heading}</h2><p class="practice-empty">${p.nothingToPractise}</p>`;
    }

    const selection = setup.selection;
    const parts =
      setup.parts.length > 1
        ? `<label class="practice-part">${p.part}
            <select data-id="part">${setup.parts
              .map(
                (part) =>
                  `<option value="${part.partIndex}" ${part.partIndex === selection.partIndex ? 'selected' : ''}>${escapeHtml(part.name)}</option>`,
              )
              .join('')}</select>
          </label>`
        : '';

    const hands =
      setup.hands.length > 1
        ? `<fieldset class="practice-hands"><legend>${p.hands}</legend>${setup.hands
            .map(
              (hand, i) =>
                `<label><input type="radio" name="hands" data-id="hand-${i}" value="${i}" ${sameStaves(selection, hand) ? 'checked' : ''} /> ${handLabel(hand, setup.hands)}</label>`,
            )
            .join('')}</fieldset>`
        : '';

    const hearRest =
      setup.hands.length > 1 || setup.parts.length > 1
        ? `<label class="practice-accompaniment"><input type="checkbox" name="accompaniment" data-id="accompaniment" ${setup.accompaniment ? 'checked' : ''} /> ${p.accompaniment}</label>`
        : '';

    const start =
      startMeasureIndex !== null
        ? `<p class="practice-start">${p.startsAtMeasure.replace('{n}', String(startMeasureIndex + 1))}</p>`
        : '';

    return `<h2 class="practice-heading">${p.heading}</h2>${parts}${hands}${hearRest}${this.loopTemplate(setup, running)}${start}`;
  }

  /** Two measure fields (numbered from 1, as printed) and a clear control; empty fields mean no loop (FR-016). */
  private loopTemplate(setup: PracticeSetup, running: ResolvedLoop | null): string {
    const p = en.practice.panel;
    const { loop, measureCount } = setup;
    const value = (index: number | undefined) => (index === undefined ? '' : String(index + 1));
    const field = (id: string, label: string, index: number | undefined) =>
      `<label>${label} <input type="number" data-id="${id}" min="1" max="${measureCount}" step="1" value="${value(index)}" /></label>`;

    const occurrence = running?.occurrence
      ? ` (${p.loopOccurrence.replace('{ordinal}', ordinal(running.occurrence.index))})`
      : '';
    const status = loop
      ? `<p class="practice-loop-status">${p.loopStatus
          .replace('{from}', String(Math.min(loop.fromMeasureIndex, loop.toMeasureIndex) + 1))
          .replace('{to}', String(Math.max(loop.fromMeasureIndex, loop.toMeasureIndex) + 1))}${occurrence}</p>`
      : '';

    return `<fieldset class="practice-loop"><legend>${p.loop}</legend>
        ${field('loop-from', p.loopFrom, loop?.fromMeasureIndex)}
        ${field('loop-to', p.loopTo, loop?.toMeasureIndex)}
        <button type="button" data-id="loop-clear" ${loop ? '' : 'disabled'}>${p.loopClear}</button>
        ${status}
      </fieldset>`;
  }

  private wire(setup: PracticeSetup) {
    this.querySelector('select')?.addEventListener('change', (event) => {
      this.emit({ partIndex: Number((event.target as HTMLSelectElement).value) });
    });
    for (const radio of this.querySelectorAll<HTMLInputElement>('input[name="hands"]')) {
      radio.addEventListener('change', () => {
        const hand = setup.hands[Number(radio.value)];
        if (hand && radio.checked) this.emit({ selection: hand });
      });
    }
    this.querySelector<HTMLInputElement>('input[name="accompaniment"]')?.addEventListener('change', (event) => {
      this.emit({ accompaniment: (event.target as HTMLInputElement).checked });
    });

    const from = this.querySelector<HTMLInputElement>('[data-id="loop-from"]');
    const to = this.querySelector<HTMLInputElement>('[data-id="loop-to"]');
    const onLoopField = () => {
      const start = this.measureIndexOf(from, setup.measureCount);
      const end = this.measureIndexOf(to, setup.measureCount);
      if (start === null || end === null) return; // one field is not a range yet: wait for the other
      this.emit({ loop: { fromMeasureIndex: start, toMeasureIndex: end } });
      // Show what the app made of it: a reversed range corrected, or a loop it declined, replaces what was typed.
      this.render();
    };
    from?.addEventListener('change', onLoopField);
    to?.addEventListener('change', onLoopField);
    this.querySelector('[data-id="loop-clear"]')?.addEventListener('click', () => this.emit({ loop: null }));
  }

  /** The zero-based measure a field holds, kept inside the Score; null when it is empty or not a number. */
  private measureIndexOf(input: HTMLInputElement | null, measureCount: number): number | null {
    const text = input?.value.trim() ?? '';
    if (text === '') return null;
    const number = Number(text);
    if (!Number.isFinite(number)) return null;
    return Math.min(Math.max(Math.round(number), 1), Math.max(measureCount, 1)) - 1;
  }
}
customElements.define('mx-practice-panel', MxPracticePanel);
