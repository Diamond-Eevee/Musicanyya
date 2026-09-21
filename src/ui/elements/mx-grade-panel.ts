import type { Grade, NoteResult } from '../../core/grade/types.js';
import { reasonText } from '../format/reason-text.js';
import { en } from '../i18n/en.js';
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

  connectedCallback() {
    this.unsubscribePlay = playState.subscribe(() => this.render());
    this.unsubscribePractice = practiceState.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribePlay?.();
    this.unsubscribePractice?.();
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
    `;
  }
}
customElements.define('mx-grade-panel', MxGradePanel);
