import { buildBrowserItems } from '../../core/browser/items.js';
import type { BrowserItem } from '../../core/browser/types.js';
import type { LibraryItem } from '../../core/library/types.js';
import {
  DEFAULT_MASTERY_THRESHOLDS,
  type ItemRef,
  type ProgressResult,
  type UserFileEntry,
} from '../../core/progress/types.js';
import {
  completenessText,
  historyTrendDeltaPoints,
  relativeDate,
  resultFigures,
  resultTempoSuffix,
  scopeText,
  strictnessText,
  trendText,
} from '../format/result-text.js';
import { scoreSourceLines } from '../format/score-source-text.js';
import { en } from '../i18n/en.js';
import { browserState } from '../state/browserState.js';
import { escapeHtml } from '../util/escape-html.js';
import './mx-status-badge.js';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function refEquals(a: ItemRef, b: ItemRef): boolean {
  if (a.kind === 'library' && b.kind === 'library') return a.id === b.id;
  return a.kind === 'file' && b.kind === 'file' && a.fileKey === b.fileKey;
}

/**
 * The detail pane (`role="region"`, contracts/score-browser.md §2): metadata, source/licence text for a library
 * item (FR-013, one shared formatter, `score-source-text.ts`), the progress record and its history, and the *Open*
 * button. The reset/remove actions are T057/T062. A pure view of `browserState` (Principle V): it builds the same
 * `BrowserItem` rows `mx-browser-list` does, for the progress fields only `buildBrowserItems` computes.
 */
export class MxBrowserDetail extends HTMLElement {
  private unsubscribe?: () => void;
  /** OD-3/T057: which item currently shows the inline "Reset progress?" confirmation - transient UI state, reset
   *  whenever the selection changes (never persisted, never in `browserState`). */
  private confirming: ItemRef | null = null;
  /** US3 #4/T062: which *My files* entry currently shows the inline remove choice - the same kind of transient
   *  state as `confirming`, kept separate so the two confirmations never show for the same ref at once. */
  private confirmingRemove: ItemRef | null = null;

  connectedCallback() {
    this.setAttribute('role', 'region');
    this.setAttribute('aria-label', en.browser.title);
    this.unsubscribe = browserState.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
  }

  private render(): void {
    const { data, view, pending } = browserState.get();
    const ref = view.selected;
    if (!ref) {
      this.innerHTML = '';
      return;
    }
    if (this.confirming && !refEquals(this.confirming, ref)) this.confirming = null;
    if (this.confirmingRemove && !refEquals(this.confirmingRemove, ref)) this.confirmingRemove = null;
    const items = buildBrowserItems(data.index, data.files, data.records, DEFAULT_MASTERY_THRESHOLDS, collator.compare);
    const row = items.find((i) => refEquals(i.ref, ref)) ?? null;
    const pendingHere = pending?.kind === 'reset' && refEquals(pending.ref, ref);
    const pendingRemoveHere = ref.kind === 'file' && pending?.kind === 'removeFile' && pending.fileKey === ref.fileKey;
    if (ref.kind === 'library') {
      const item = data.index?.items.find((i) => i.id === ref.id) ?? null;
      const shared = (item?.meta.supersedes?.length ?? 0) > 0;
      this.innerHTML = item && row ? this.libraryHtml(item, row, ref, shared, pendingHere) : '';
    } else {
      const entry = data.files.find((f) => f.fileKey === ref.fileKey) ?? null;
      const shared = (entry?.earlierHashes.length ?? 0) > 0;
      this.innerHTML = entry && row ? this.fileHtml(entry, row, ref, shared, pendingHere, pendingRemoveHere) : '';
    }
    this.querySelector('.browser-detail-open')?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('browseropenitem', { detail: { ref }, bubbles: true }));
    });
    this.wireReset(ref);
    if (ref.kind === 'file') this.wireRemove(ref);
  }

  private wireReset(ref: ItemRef): void {
    this.querySelector('.browser-reset-start')?.addEventListener('click', () => {
      this.confirming = ref;
      this.render();
    });
    this.querySelector('.browser-reset-cancel')?.addEventListener('click', () => {
      this.confirming = null;
      this.render();
    });
    this.querySelector('.browser-reset-confirm')?.addEventListener('click', () => {
      this.confirming = null;
      this.dispatchEvent(new CustomEvent('browserresetprogress', { detail: { ref }, bubbles: true }));
    });
    this.querySelector('.browser-reset-undo')?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('browserundoreset', { bubbles: true }));
    });
  }

  /** US3 #4/OD-3: "Remove from My files" -> two inline choices, never a blocking dialog (R-12). */
  private wireRemove(ref: Extract<ItemRef, { kind: 'file' }>): void {
    this.querySelector('.browser-remove-start')?.addEventListener('click', () => {
      this.confirmingRemove = ref;
      this.confirming = null;
      this.render();
    });
    this.querySelector('.browser-remove-cancel')?.addEventListener('click', () => {
      this.confirmingRemove = null;
      this.render();
    });
    this.querySelector('.browser-remove-keep')?.addEventListener('click', () => {
      this.confirmingRemove = null;
      this.dispatchEvent(
        new CustomEvent('browserremovefile', { detail: { fileKey: ref.fileKey, keepProgress: true }, bubbles: true }),
      );
    });
    this.querySelector('.browser-remove-progress')?.addEventListener('click', () => {
      this.confirmingRemove = null;
      this.dispatchEvent(
        new CustomEvent('browserremovefile', { detail: { fileKey: ref.fileKey, keepProgress: false }, bubbles: true }),
      );
    });
    this.querySelector('.browser-remove-undo')?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('browserundoremovefile', { bubbles: true }));
    });
  }

  /** US3 #4: "Remove from My files", its inline two-choice confirmation, or the undo line for a removal already
   *  pending - available whether or not the entry has any progress (unlike reset, which needs some to reset). */
  private removeControlsHtml(ref: Extract<ItemRef, { kind: 'file' }>, pendingRemoveHere: boolean): string {
    const b = en.browser;
    if (pendingRemoveHere) {
      return `<p class="browser-remove-pending">${escapeHtml(b.removePending)} <button type="button" class="browser-remove-undo">${escapeHtml(b.undo)}</button></p>`;
    }
    if (this.confirmingRemove && refEquals(this.confirmingRemove, ref)) {
      return `<button type="button" class="browser-remove-keep">${escapeHtml(b.removeKeepProgress)}</button>
        <button type="button" class="browser-remove-progress">${escapeHtml(b.removeAndProgress)}</button>
        <button type="button" class="browser-remove-cancel">${escapeHtml(b.resetCancelButton)}</button>`;
    }
    return `<button type="button" class="browser-remove-start">${escapeHtml(b.removeFile)}</button>`;
  }

  /** OD-3: the "Reset progress" button, its inline confirmation, or the undo line for a reset already pending. */
  private resetControlsHtml(ref: ItemRef, hasProgress: boolean, shared: boolean, pendingHere: boolean): string {
    const b = en.browser;
    if (pendingHere) {
      return `<p class="browser-reset-pending">${escapeHtml(b.resetPending)} <button type="button" class="browser-reset-undo">${escapeHtml(b.undo)}</button></p>`;
    }
    if (!hasProgress) return '';
    if (this.confirming && refEquals(this.confirming, ref)) {
      return `<p class="browser-reset-confirm-message">${escapeHtml(shared ? b.resetConfirmShared : b.resetConfirm)}</p>
        <button type="button" class="browser-reset-confirm">${escapeHtml(b.resetConfirmButton)}</button>
        <button type="button" class="browser-reset-cancel">${escapeHtml(b.resetCancelButton)}</button>`;
    }
    return `<button type="button" class="browser-reset-start">${escapeHtml(b.resetProgress)}</button>`;
  }

  /** FR-013: status, attempts, first/last opened, last practised with bars, best/last/previous in full words with
   *  tempo and strictness, and up to `PROGRESS_RESULTS_MAX` history rows with scope and completeness. */
  private progressHtml(row: BrowserItem, ref: ItemRef, shared: boolean, pendingHere: boolean): string {
    const b = en.browser;
    const p = row.progress;
    const [last, previous] = p.history;
    const resultLine = (label: string, result: ProgressResult | undefined) =>
      result
        ? `<p class="browser-detail-result">${escapeHtml(label)}: ${escapeHtml(resultFigures(result))}${
            resultTempoSuffix(result) ? ` ${escapeHtml(resultTempoSuffix(result))}` : ''
          }, ${escapeHtml(strictnessText(result.strictness))}, ${escapeHtml(scopeText(result.scope))}${
            completenessText(result) ? ` (${escapeHtml(completenessText(result))})` : ''
          }</p>`
        : '';
    const trend = trendText(p.trend, historyTrendDeltaPoints(p.history));
    const historyRows = p.history
      .map((r) => {
        const version = r.earlierVersion ? `, ${escapeHtml(b.earlierVersion)}` : '';
        return `<li>${escapeHtml(relativeDate(r.finishedAt))} - ${escapeHtml(resultFigures(r))}${
          resultTempoSuffix(r) ? ` ${escapeHtml(resultTempoSuffix(r))}` : ''
        }, ${escapeHtml(scopeText(r.scope))}${completenessText(r) ? ` (${escapeHtml(completenessText(r))})` : ''}${version}</li>`;
      })
      .join('');
    return `
      <div class="browser-detail-progress">
        <mx-status-badge status="${p.status}"></mx-status-badge>
        ${p.attempts > 0 ? `<p class="browser-detail-attempts">${escapeHtml(b.attempts)}: ${p.attempts}</p>` : ''}
        ${resultLine(b.best, p.best ?? undefined)}
        ${resultLine(b.last, last)}
        ${resultLine(b.previous, previous)}
        ${trend ? `<p class="browser-detail-trend">${escapeHtml(trend)}</p>` : ''}
        ${p.history.length > 0 ? `<h4 class="browser-detail-history-heading">${escapeHtml(b.history)}</h4><ul class="browser-detail-history">${historyRows}</ul>` : ''}
        ${this.resetControlsHtml(ref, p.status !== 'new', shared, pendingHere)}
      </div>`;
  }

  private libraryHtml(
    item: LibraryItem,
    row: BrowserItem,
    ref: ItemRef,
    shared: boolean,
    pendingHere: boolean,
  ): string {
    const s = en.library;
    const composer = item.meta.composer ? escapeHtml(item.meta.composer) : '';
    const arranger = item.meta.arranger ? escapeHtml(item.meta.arranger) : '';
    const sourceLines = scoreSourceLines(item)
      .map((line) => `<p class="score-source-line">${escapeHtml(line)}</p>`)
      .join('');
    return `
      <h3 class="browser-detail-title">${escapeHtml(item.meta.title)}</h3>
      ${composer ? `<p class="browser-detail-composer">${composer}</p>` : ''}
      ${arranger ? `<p class="browser-detail-arranger">${arranger}</p>` : ''}
      <p class="browser-detail-level">${escapeHtml(s.levels[item.meta.level])}</p>
      ${item.facts.keys.length > 0 ? `<p class="browser-detail-keys">${escapeHtml(item.facts.keys.join(', '))}</p>` : ''}
      <p class="browser-detail-measures">${item.facts.measures}</p>
      <p class="browser-detail-duration">${formatDuration(item.facts.durationSeconds)}</p>
      ${item.meta.tags.length > 0 ? `<p class="browser-detail-tags">${item.meta.tags.map((t) => escapeHtml(s.tags[t] ?? t)).join(', ')}</p>` : ''}
      ${this.progressHtml(row, ref, shared, pendingHere)}
      <h4 class="score-source-heading">${escapeHtml(s.source.heading)}</h4>
      ${sourceLines}
      <button type="button" class="browser-detail-open">${escapeHtml(en.browser.open)}</button>`;
  }

  private fileHtml(
    entry: UserFileEntry,
    row: BrowserItem,
    ref: Extract<ItemRef, { kind: 'file' }>,
    shared: boolean,
    pendingHere: boolean,
    pendingRemoveHere: boolean,
  ): string {
    const title = escapeHtml(entry.title ?? entry.fileName);
    const stored = entry.stored
      ? ''
      : `<p class="browser-detail-not-stored">${escapeHtml(en.browser.fileNotStoredRow)}</p>`;
    return `
      <h3 class="browser-detail-title">${title}</h3>
      <p class="browser-detail-filename">${escapeHtml(entry.fileName)}</p>
      ${stored}
      ${this.progressHtml(row, ref, shared, pendingHere)}
      <button type="button" class="browser-detail-open">${escapeHtml(en.browser.open)}</button>
      ${this.removeControlsHtml(ref, pendingRemoveHere)}`;
  }
}
customElements.define('mx-browser-detail', MxBrowserDetail);
