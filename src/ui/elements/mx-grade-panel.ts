import type { Grade, NoteResult } from '../../core/grade/types.js';
import { reasonText } from '../format/reason-text.js';
import { en, ordinal } from '../i18n/en.js';
import { mistakeStepper } from '../state/mistake-stepper.js';
import { playState } from '../state/playState.js';
import { practiceState } from '../state/practiceState.js';

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function percent(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 100);
}

/** "38 of 44 notes (86%)" (FR-028): always a count out of a total as well as a percentage. */
function figure(count: number, total: number): string {
  return en.play.panel.figure
    .replace('{count}', String(count))
    .replace('{total}', String(total))
    .replace('{percent}', String(percent(count, total)));
}

function findResult(grade: Grade, noteId: string): NoteResult | null {
  return grade.results.find((result) => result.noteIds.includes(noteId)) ?? null;
}

/**
 * The two figures, the six plain counts and a plain-words reason for whatever mark the musician selected on the
 * Score (FR-028, FR-030). A pure view of `playState`/`practiceState`: it renders what it is given and decides
 * nothing (Constitution V), same treatment as `mx-practice-panel`. Extra notes have no notehead of their own to
 * select (R-11, same limitation `practice-marks.ts` already documents) - their reason is not shown here; FR-031's
 * mistake stepper (US2, T051) is the general way to step through every mistake including extras.
 */
export class MxGradePanel extends HTMLElement {
  private unsubscribePlay?: () => void;
  private unsubscribePractice?: () => void;
  private unsubscribeStepper?: () => void;

  connectedCallback() {
    this.unsubscribePlay = playState.subscribe(() => this.render());
    this.unsubscribePractice = practiceState.subscribe(() => this.render());
    this.unsubscribeStepper = mistakeStepper.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribePlay?.();
    this.unsubscribePractice?.();
    this.unsubscribeStepper?.();
  }

  private render() {
    const { mode } = practiceState.get();
    const { grade, selectedNoteId } = playState.get();
    this.hidden = mode !== 'play' || grade === null;
    if (this.hidden || !grade) {
      this.innerHTML = '';
      return;
    }

    const p = en.play.panel;
    const { summary } = grade;
    const incomplete = grade.complete ? '' : `<p class="grade-incomplete">${p.incomplete}</p>`;
    const selected = selectedNoteId ? findResult(grade, selectedNoteId) : null;
    const reason = selected ? `<p class="grade-reason">${escapeHtml(reasonText(selected.reason))}</p>` : '';

    const stepperState = mistakeStepper.get();
    const stepper =
      stepperState.total > 0
        ? `
      <div class="grade-stepper">
        <h3>${p.mistakes} (${stepperState.total})</h3>
        <button type="button" data-id="stepper-previous">${p.previous}</button>
        <button type="button" data-id="stepper-next">${p.next}</button>
      </div>`
        : '';

    const worstPasses = [...grade.measures]
      .filter(
        (m) =>
          m.counts.wrongPitch > 0 ||
          m.counts.missed > 0 ||
          m.counts.extra > 0 ||
          m.counts.early > 0 ||
          m.counts.late > 0,
      )
      .sort((a, b) => b.counts.wrongPitch + b.counts.missed - (a.counts.wrongPitch + a.counts.missed));

    const overview =
      worstPasses.length > 0
        ? `
      <div class="grade-overview">
        <h3>${p.measureOverview}</h3>
        <ul>
          ${worstPasses
            .map(
              (m) => `
            <li>
              ${escapeHtml(p.measurePass.replace('{measure}', String(m.measureIndex + 1)).replace('{ordinal}', ordinal(m.passIndex + 1)))}
              <button type="button" data-id="practise-pass" data-pass="${m.passIndex}">${p.practisePassage}</button>
            </li>
          `,
            )
            .join('')}
        </ul>
      </div>`
        : '';

    this.innerHTML = `
      <h2 class="grade-heading">${p.heading}</h2>
      ${incomplete}
      <p class="grade-figure grade-figure-pitch">${p.notesCorrect}: ${figure(summary.notesCorrect.count, summary.notesCorrect.total)}</p>
      <p class="grade-figure grade-figure-timing">${p.notesOnTime}: ${figure(summary.notesOnTime.count, summary.notesOnTime.total)}</p>
      <ul class="grade-counts">
        <li class="grade-count-correct">${p.correct}: ${summary.counts.correct}</li>
        <li class="grade-count-wrongPitch">${p.wrongPitch}: ${summary.counts.wrongPitch}</li>
        <li class="grade-count-missed">${p.missed}: ${summary.counts.missed}</li>
        <li class="grade-count-extra">${p.extra}: ${summary.counts.extra}</li>
        <li class="grade-count-early">${p.early}: ${summary.counts.early}</li>
        <li class="grade-count-late">${p.late}: ${summary.counts.late}</li>
      </ul>
      ${reason}
      ${stepper}
      ${overview}
    `;

    this.wire();
  }

  private wire() {
    this.querySelector('[data-id="stepper-previous"]')?.addEventListener('click', () => {
      mistakeStepper.previous();
      const id = mistakeStepper.get().currentId;
      if (id) playState.selectNote(id);
    });
    this.querySelector('[data-id="stepper-next"]')?.addEventListener('click', () => {
      mistakeStepper.next();
      const id = mistakeStepper.get().currentId;
      if (id) playState.selectNote(id);
    });
    for (const btn of this.querySelectorAll<HTMLButtonElement>('[data-id="practise-pass"]')) {
      btn.addEventListener('click', () => {
        const pass = Number(btn.dataset.pass);
        this.dispatchEvent(new CustomEvent('practisepass', { detail: { passIndex: pass }, bubbles: true }));
      });
    }
  }
}
customElements.define('mx-grade-panel', MxGradePanel);
