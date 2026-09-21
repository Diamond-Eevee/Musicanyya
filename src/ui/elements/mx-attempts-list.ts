import { PERFORMANCES_PER_SCORE_MAX } from '../../engine/config.js';
import type { StoredPerformanceSummary } from '../../engine/ports.js';
import { en } from '../i18n/en.js';
import { playState } from '../state/playState.js';
import { practiceState } from '../state/practiceState.js';

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

function figure(template: string, count: number, total: number): string {
  return template.replace('{count}', String(count)).replace('{total}', String(total));
}

/**
 * Kept attempts for the open Score (US4, T076): date, settings and summary, with replay/re-grade/delete actions.
 * A pure view of `playState.attempts` - it renders what it is given and reports the musician's choice as
 * `attemptreplay` / `attemptregrade` / `attemptdelete` events; it decides nothing (Constitution V), same
 * treatment as `mx-play-panel`.
 */
export class MxAttemptsList extends HTMLElement {
  private unsubscribe?: () => void;
  private unsubscribeMode?: () => void;

  connectedCallback() {
    this.unsubscribe = playState.subscribe(() => this.render());
    this.unsubscribeMode = practiceState.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
    this.unsubscribeMode?.();
  }

  private emit(type: 'attemptreplay' | 'attemptregrade' | 'attemptdelete', runId: string) {
    this.dispatchEvent(new CustomEvent<{ runId: string }>(type, { detail: { runId }, bubbles: true }));
  }

  private render() {
    const mode = practiceState.get().mode;
    const { attempts } = playState.get();
    this.hidden = mode !== 'play';
    if (this.hidden) {
      this.innerHTML = '';
      return;
    }

    const s = en.play.attempts;
    if (attempts.length === 0) {
      this.innerHTML = `<h2 class="attempts-heading">${s.heading}</h2><p class="attempts-empty">${s.empty}</p>`;
      return;
    }

    const items = attempts.map((attempt) => this.itemHtml(attempt)).join('');
    this.innerHTML = `
      <h2 class="attempts-heading">${s.heading}</h2>
      <p class="attempts-kept">${s.kept.replace('{n}', String(PERFORMANCES_PER_SCORE_MAX))}</p>
      <ul class="attempts-list">${items}</ul>
    `;
    this.wire();
  }

  private static readonly STRICTNESS_LABEL = {
    beginner: 'strictnessBeginner',
    standard: 'strictnessStandard',
    strict: 'strictnessStrict',
  } as const;

  private itemHtml(attempt: StoredPerformanceSummary): string {
    const s = en.play.attempts;
    const setup = en.play.setup;
    const { summary, settings } = attempt;
    const strictnessLabel = setup[MxAttemptsList.STRICTNESS_LABEL[settings.strictness]];
    return `
      <li data-id="${attempt.runId}" class="attempts-item">
        <div class="attempts-date">${escapeHtml(formatDate(attempt.finishedAt))}</div>
        <div class="attempts-settings">${setup.tempoPercent.replace('{n}', String(settings.tempoPercent))} · ${strictnessLabel}</div>
        <div class="attempts-summary">
          ${figure(s.notesCorrect, summary.notesCorrect.count, summary.notesCorrect.total)} ·
          ${figure(s.notesOnTime, summary.notesOnTime.count, summary.notesOnTime.total)}
        </div>
        <div class="attempts-actions">
          <button type="button" class="attempts-replay" data-id="${attempt.runId}">${s.replay}</button>
          <button type="button" class="attempts-regrade" data-id="${attempt.runId}">${s.regrade}</button>
          <button type="button" class="attempts-delete" data-id="${attempt.runId}">${s.delete}</button>
        </div>
      </li>`;
  }

  private wire() {
    this.querySelectorAll<HTMLButtonElement>('.attempts-replay').forEach((button) => {
      button.addEventListener('click', () => this.emit('attemptreplay', button.dataset.id ?? ''));
    });
    this.querySelectorAll<HTMLButtonElement>('.attempts-regrade').forEach((button) => {
      button.addEventListener('click', () => this.emit('attemptregrade', button.dataset.id ?? ''));
    });
    this.querySelectorAll<HTMLButtonElement>('.attempts-delete').forEach((button) => {
      button.addEventListener('click', () => {
        const runId = button.dataset.id;
        if (runId && window.confirm(en.play.attempts.deleteConfirm)) this.emit('attemptdelete', runId);
      });
    });
  }
}
customElements.define('mx-attempts-list', MxAttemptsList);
