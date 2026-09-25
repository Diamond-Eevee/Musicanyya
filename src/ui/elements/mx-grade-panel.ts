import type { GradeMarkRef, GradeMarkSet } from '../../core/grade/marks.js';
import type { Grade } from '../../core/grade/types.js';
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

/**
 * The plain-words lines for what is selected (FR-030; 009 FR-022, FR-024): a graded note explained once for every pass it
 * was played, the pass named when there is more than one; an extra key by its own reason; a red disc as everything it stands
 * for. The mark set (from the core) says which results a note has and what their wording needs to know (FR-022a); without one
 * (a Score that is not open) the results themselves are searched.
 */
function explain(grade: Grade, marks: GradeMarkSet | null, ref: GradeMarkRef): string[] {
  if (ref.kind === 'extra') {
    const extra = grade.extras[ref.index];
    return extra ? [reasonText(extra.reason)] : [];
  }
  if (ref.kind === 'disc') {
    const disc = marks?.discs[ref.index];
    return disc ? disc.refs.flatMap((inner) => explain(grade, marks, inner)) : [];
  }
  const indexes =
    marks?.notes.get(ref.noteId)?.results ??
    grade.results.flatMap((result, index) => (result.noteIds.includes(ref.noteId) ? [index] : []));
  const lines = indexes.flatMap((index) => {
    const result = grade.results[index];
    return result ? [reasonText(result.reason, marks?.contexts.get(index))] : [];
  });
  return lines.length > 1
    ? lines.map((line, i) => en.play.panel.passLine.replace('{ordinal}', ordinal(i + 1)).replace('{reason}', line))
    : lines;
}

/**
 * The two figures, the six plain counts and a plain-words reason for whatever mark the musician selected on the
 * Score (FR-028, FR-030). A pure view of `playState`/`practiceState`: it renders what it is given and decides
 * nothing (Constitution V), same treatment as `mx-practice-panel`. What is selected is a mark reference (009): a graded
 * note, an extra key (reached through the mistake stepper) or a red disc; each is explained from the mark set.
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
    const { grade, marks, selectedMark } = playState.get();
    this.hidden = mode !== 'play' || grade === null;
    if (this.hidden || !grade) {
      this.innerHTML = '';
      return;
    }

    const p = en.play.panel;
    const { summary } = grade;
    const incomplete = grade.complete ? '' : `<p class="grade-incomplete">${p.incomplete}</p>`;
    const reason = (selectedMark ? explain(grade, marks, selectedMark) : [])
      .map((line) => `<p class="grade-reason">${escapeHtml(line)}</p>`)
      .join('');

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
      const ref = mistakeStepper.get().current;
      if (ref) playState.selectMark(ref);
    });
    this.querySelector('[data-id="stepper-next"]')?.addEventListener('click', () => {
      mistakeStepper.next();
      const ref = mistakeStepper.get().current;
      if (ref) playState.selectMark(ref);
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
