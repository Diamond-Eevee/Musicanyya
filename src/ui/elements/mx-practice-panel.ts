import type { HandSelection } from '../../core/practice/types.js';
import { en } from '../i18n/en.js';
import { type PracticeSetup, practiceState } from '../state/practiceState.js';

/** What the panel reports when the musician chooses something; session.ts applies it (FR-013, FR-025a, FR-032). */
export interface PracticeSetupChange {
  partIndex?: number;
  selection?: HandSelection;
  accompaniment?: boolean;
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
    const { mode, setup, startMeasureIndex } = practiceState.get();
    this.hidden = mode !== 'practice' || setup === null;
    if (this.hidden || !setup) {
      this.innerHTML = '';
      return;
    }

    // Keep keyboard focus on the same control across the re-render that follows a choice.
    const focusedId = (document.activeElement as HTMLElement | null)?.dataset?.id;
    this.innerHTML = this.template(setup, startMeasureIndex);
    this.wire(setup);
    if (focusedId) (this.querySelector(`[data-id="${CSS.escape(focusedId)}"]`) as HTMLElement | null)?.focus();
  }

  private template(setup: PracticeSetup, startMeasureIndex: number | null): string {
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

    return `<h2 class="practice-heading">${p.heading}</h2>${parts}${hands}${hearRest}${start}`;
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
  }
}
customElements.define('mx-practice-panel', MxPracticePanel);
