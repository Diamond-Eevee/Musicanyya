import { buildBrowserItems } from '../../core/browser/items.js';
import { queryBrowser, showsContinue } from '../../core/browser/query.js';
import type { BrowserItem } from '../../core/browser/types.js';
import { resultsDeltaPoints } from '../../core/progress/status.js';
import { DEFAULT_MASTERY_THRESHOLDS, type ItemRef, itemRefKey } from '../../core/progress/types.js';
import { resultFigures, resultTempoSuffix, trendText } from '../format/result-text.js';
import './mx-status-badge.js';
import { BROWSER_DBLCLICK_WINDOW_MS } from '../../engine/config.js';
import { en } from '../i18n/en.js';
import { browserState } from '../state/browserState.js';
import { escapeHtml } from '../util/escape-html.js';
import { patchChildren } from '../util/patch-children.js';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

/** How many rows PageUp/PageDown move: about what a laptop-height list shows at once. A fixed step, not a
 *  measurement, so the keys behave the same in every window and in tests without layout. */
const LIST_PAGE_ROWS = 10;

function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function refEquals(a: ItemRef, b: ItemRef): boolean {
  return itemRefKey(a) === itemRefKey(b);
}

/**
 * The result list (`role="listbox"`, contracts/score-browser.md §1-2): title, subtitle, level, key and length per
 * row. A pure view of `browserState` (Principle V) - it calls the core's `buildBrowserItems`/`queryBrowser` itself
 * with its own `Intl.Collator`, the way the retired panel called `filterItems`. The active row
 * (`aria-activedescendant`) follows the selection and Up/Down move it; the full APG key set (Home/End/PageUp/
 * PageDown) and keyed row reuse for large lists are T084/T082.
 */
export class MxBrowserList extends HTMLElement {
  private unsubscribe?: () => void;
  private activeRef: ItemRef | null = null;
  /** The rows as of the last render, for the delegated listeners (rows are kept across renders, so a listener
   *  cannot close over them). */
  private currentRows: BrowserItem[] = [];
  /** A pending single-click selection, deferred so a following dblclick can cancel it (see `wire()`). */
  private selectTimer: ReturnType<typeof setTimeout> | null = null;

  connectedCallback() {
    this.setAttribute('role', 'listbox');
    this.setAttribute('aria-label', en.browser.title);
    this.tabIndex = 0;
    this.addEventListener('keydown', this.onKeydown);
    this.addEventListener('click', this.onClick);
    this.addEventListener('dblclick', this.onDblclick);
    this.unsubscribe = browserState.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
    this.removeEventListener('keydown', this.onKeydown);
    this.removeEventListener('click', this.onClick);
    this.removeEventListener('dblclick', this.onDblclick);
    if (this.selectTimer !== null) clearTimeout(this.selectTimer);
  }

  private rows(): BrowserItem[] {
    const { data, view } = browserState.get();
    const items = buildBrowserItems(data.index, data.files, data.records, DEFAULT_MASTERY_THRESHOLDS, collator.compare);
    return queryBrowser(items, view, collator.compare).rows;
  }

  private render(): void {
    // *Continue* takes this pane's place for the Continue folder with an empty search (US4, contracts §1).
    this.hidden = showsContinue(browserState.get().view);
    const rows = this.rows();
    const selected = browserState.get().view.selected;
    if (this.activeRef === null || !rows.some((r) => refEquals(r.ref, this.activeRef as ItemRef))) {
      const selectedRow = selected && rows.find((r) => refEquals(r.ref, selected));
      this.activeRef = selectedRow ? selectedRow.ref : (rows[0]?.ref ?? null);
    }
    this.currentRows = rows;
    // Rows whose markup did not change stay the same elements: an update between the two clicks of a double click
    // (or between a press and its release) must not swap the row out from under the pointer.
    patchChildren(this, rows.map((row, index) => this.rowHtml(row, index, selected, this.activeRef)).join(''));
    const activeIndex = this.activeRef ? rows.findIndex((r) => refEquals(r.ref, this.activeRef as ItemRef)) : -1;
    if (activeIndex >= 0) this.setAttribute('aria-activedescendant', `browser-row-${activeIndex}`);
    else this.removeAttribute('aria-activedescendant');
  }

  /** FR-012: for a played item, the best result, the last result and the trend between the last two. */
  private resultHtml(row: BrowserItem): string {
    if (row.progress.attempts === 0) return '';
    const best = row.progress.best;
    const last = row.progress.last;
    const bestText = best
      ? `${en.browser.best}: ${resultFigures(best)}${resultTempoSuffix(best) ? ` ${resultTempoSuffix(best)}` : ''}`
      : '';
    const lastText = last ? `${en.browser.last}: ${resultFigures(last)}` : '';
    const trend = trendText(row.progress.trend, resultsDeltaPoints(row.progress.history));
    return `
      ${bestText ? `<span class="browser-row-result">${escapeHtml(bestText)}</span>` : ''}
      ${lastText ? `<span class="browser-row-result">${escapeHtml(lastText)}</span>` : ''}
      ${trend ? `<span class="browser-row-trend">${escapeHtml(trend)}</span>` : ''}`;
  }

  private rowHtml(row: BrowserItem, index: number, selected: ItemRef | null, active: ItemRef | null): string {
    const isSelected = selected !== null && refEquals(row.ref, selected);
    const isActive = active !== null && refEquals(row.ref, active);
    const length = row.durationSeconds !== null ? formatDuration(row.durationSeconds) : '';
    return `
      <div
        role="option"
        id="browser-row-${index}"
        class="browser-row"
        data-ref="${escapeHtml(itemRefKey(row.ref))}"
        data-index="${index}"
        data-status="${row.progress.status}"
        aria-selected="${isSelected}"
        ${isActive ? 'data-active' : ''}
      >
        <mx-status-badge status="${row.progress.status}"></mx-status-badge>
        <span class="browser-row-title">${escapeHtml(row.title)}</span>
        ${row.subtitle ? `<span class="browser-row-subtitle">${escapeHtml(row.subtitle)}</span>` : ''}
        ${row.step ? `<span class="browser-row-step">${escapeHtml(en.library.steps[row.step])}</span>` : ''}
        ${row.level ? `<span class="browser-row-level">${escapeHtml(en.library.levels[row.level])}</span>` : ''}
        ${row.keys.length > 0 ? `<span class="browser-row-key">${escapeHtml(row.keys.join(', '))}</span>` : ''}
        ${length ? `<span class="browser-row-length">${escapeHtml(length)}</span>` : ''}
        ${this.resultHtml(row)}
        ${row.stored ? '' : `<span class="browser-row-not-stored">${escapeHtml(en.browser.fileNotStoredRow)}</span>`}
      </div>`;
  }

  /** The row a mouse event happened on, as of its own render: its `data-index` is part of the markup, so a kept row
   *  always names its current place, and a replaced one names the new place. */
  private rowFor(event: Event): BrowserItem | null {
    if (!(event.target instanceof Element)) return null;
    const el = event.target.closest<HTMLElement>('.browser-row');
    return el ? (this.currentRows[Number(el.dataset.index)] ?? null) : null;
  }

  // `select()` re-renders synchronously, which used to tear down this very element between the two clicks of a
  // double click - found live (dblclick never opened anything, e2e library.spec.ts). Deferring the single-click
  // selection past the double-click window (Explorer/VS Code's own threshold) lets a real dblclick fire and cancel
  // it. The row is resolved when the click happens, so a list that changes during the window still selects the row
  // that was clicked.
  private readonly onClick = (event: MouseEvent): void => {
    const row = this.rowFor(event);
    if (!row) return;
    if (this.selectTimer !== null) clearTimeout(this.selectTimer);
    this.selectTimer = setTimeout(() => {
      this.selectTimer = null;
      this.select(row);
    }, BROWSER_DBLCLICK_WINDOW_MS);
  };

  private readonly onDblclick = (event: MouseEvent): void => {
    const row = this.rowFor(event);
    if (!row) return;
    if (this.selectTimer !== null) {
      clearTimeout(this.selectTimer);
      this.selectTimer = null;
    }
    this.open(row);
  };

  private select(row: BrowserItem): void {
    this.activeRef = row.ref;
    browserState.setView({ selected: row.ref });
    this.dispatchEvent(
      new CustomEvent('browserviewchange', { detail: { view: { selected: row.ref } }, bubbles: true }),
    );
  }

  private open(row: BrowserItem): void {
    this.dispatchEvent(new CustomEvent('browseropenitem', { detail: { ref: row.ref }, bubbles: true }));
  }

  /** FR-028 (contracts/score-browser.md §4): the active row moves and the selection (so the detail pane) follows;
   *  Enter opens it. The list scrolls to keep the active row in view. */
  private readonly onKeydown = (event: KeyboardEvent): void => {
    const rows = this.rows();
    if (rows.length === 0) return;
    const activeIndex = this.activeRef ? rows.findIndex((r) => refEquals(r.ref, this.activeRef as ItemRef)) : -1;
    const last = rows.length - 1;
    const moveTo = (index: number): void => {
      event.preventDefault();
      const target = rows[Math.max(0, Math.min(last, index))];
      if (target) this.select(target);
      this.querySelector('[data-active]')?.scrollIntoView?.({ block: 'nearest' });
    };
    switch (event.key) {
      case 'ArrowDown':
        moveTo(activeIndex + 1);
        break;
      case 'ArrowUp':
        moveTo(activeIndex - 1);
        break;
      case 'Home':
        moveTo(0);
        break;
      case 'End':
        moveTo(last);
        break;
      case 'PageDown':
        moveTo(activeIndex + LIST_PAGE_ROWS);
        break;
      case 'PageUp':
        moveTo(activeIndex - LIST_PAGE_ROWS);
        break;
      case 'Enter':
        event.preventDefault();
        if (activeIndex >= 0 && rows[activeIndex]) this.open(rows[activeIndex] as BrowserItem);
        break;
    }
  };
}
customElements.define('mx-browser-list', MxBrowserList);
