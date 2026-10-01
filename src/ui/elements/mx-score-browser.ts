import { filterOptions } from '../../core/browser/filter-options.js';
import { buildBrowserItems } from '../../core/browser/items.js';
import { effectiveFolder, queryBrowser, showsContinue } from '../../core/browser/query.js';
import type { BrowserItem, BrowserViewState, FolderSel, StatusFilter } from '../../core/browser/types.js';
import type { Level, LibraryIndex, SkillTag } from '../../core/library/types.js';
import { DEFAULT_MASTERY_THRESHOLDS, itemRefKey } from '../../core/progress/types.js';
import { BROWSER_ANNOUNCE_DEBOUNCE_MS, UNDO_WINDOW_MS } from '../../engine/config.js';
import { en } from '../i18n/en.js';
import { restoreInvokerFocus } from '../layout/invoker.js';
import { type BrowserData, type BrowserPhase, browserState, type PendingAction } from '../state/browserState.js';
import { escapeHtml } from '../util/escape-html.js';
import { SCORE_FILE_ACCEPT } from './mx-open-button.js';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

/** `LoadErrorCode` values and the browser's own message codes (`fileNotStored`, `libraryUnavailable`,
 *  `libraryItemMissing`, ...) all live in `en.notices` already (mx-notice-tray.ts uses the same map); a code with
 *  no entry there falls back to itself, same as the notice tray does. */
function messageText(message: { code: string; fileName?: string }): string {
  const text = en.notices[message.code] ?? message.code;
  return message.fileName ? `${message.fileName}: ${text}` : text;
}

function folderLabel(folder: FolderSel, index: LibraryIndex | null): string {
  switch (folder.kind) {
    case 'continue':
      return en.browser.folders.continue;
    case 'all':
      return en.browser.folders.all;
    case 'myFiles':
      return en.browser.folders.myFiles;
    case 'section':
      return index?.sections.find((s) => s.id === folder.id)?.title ?? en.browser.folders.all;
  }
}

type Filters = BrowserViewState['filters'];
type FilterName = keyof Filters;
type Sort = BrowserViewState['sort'];

const FILTER_NAMES: readonly FilterName[] = ['level', 'key', 'tag', 'status'];
const LEVELS: readonly Level[] = ['introduction', 'beginner', 'intermediate', 'advanced'];
const STATUS_FILTERS: readonly StatusFilter[] = [
  'new',
  'practised',
  'played',
  'mastered',
  'notMastered',
  'playedNotMastered',
];

/** FR-027: every sort in both directions. The value is `by:dir`. "Best result, lowest first" is the "needs work"
 *  order of the US5 Independent Test; "newest first" is the natural direction of the last-played sort. */
const SORTS: readonly { sort: Sort; label: string }[] = [
  { sort: { by: 'library', dir: 'asc' }, label: en.browser.sorts.libraryAsc },
  { sort: { by: 'library', dir: 'desc' }, label: en.browser.sorts.libraryDesc },
  { sort: { by: 'title', dir: 'asc' }, label: en.browser.sorts.titleAsc },
  { sort: { by: 'title', dir: 'desc' }, label: en.browser.sorts.titleDesc },
  { sort: { by: 'lastPlayed', dir: 'desc' }, label: en.browser.sorts.lastPlayedDesc },
  { sort: { by: 'lastPlayed', dir: 'asc' }, label: en.browser.sorts.lastPlayedAsc },
  { sort: { by: 'best', dir: 'desc' }, label: en.browser.sorts.bestDesc },
  { sort: { by: 'best', dir: 'asc' }, label: en.browser.sorts.bestAsc },
];

const NO_FILTERS: Filters = { level: null, key: null, tag: null, status: null };

const sortValue = (sort: Sort): string => `${sort.by}:${sort.dir}`;

function hasFilters(filters: Filters): boolean {
  return FILTER_NAMES.some((name) => filters[name] !== null);
}

/** The heading a filter goes by, in its control's label and in its chip. */
function filterTitle(name: FilterName): string {
  switch (name) {
    case 'level':
      return en.library.filters.level;
    case 'key':
      return en.library.filters.key;
    case 'tag':
      return en.library.filters.tag;
    case 'status':
      return en.browser.filterBar.status;
  }
}

function filterValueLabel(name: FilterName, value: string): string {
  switch (name) {
    case 'level':
      return en.library.levels[value as Level] ?? value;
    case 'key':
      return value;
    case 'tag':
      return en.library.tags[value as SkillTag] ?? value;
    case 'status':
      return en.browser.status[value as StatusFilter] ?? value;
  }
}

const option = (value: string, label: string, selected: boolean): string =>
  `<option value="${escapeHtml(value)}"${selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;

function anyLabel(name: FilterName): string {
  switch (name) {
    case 'level':
      return en.library.filters.anyLevel;
    case 'key':
      return en.library.filters.anyKey;
    case 'tag':
      return en.library.filters.anyTag;
    case 'status':
      return en.browser.filterBar.anyStatus;
  }
}

function optionsHtml(name: FilterName, values: readonly string[], current: string | null): string {
  // A stored filter whose value no item has (a key from an older library) is still shown, so the control never
  // disagrees with the chip beside it.
  const all = current !== null && !values.includes(current) ? [...values, current] : values;
  return (
    option('', anyLabel(name), current === null) +
    all.map((v) => option(v, filterValueLabel(name, v), v === current)).join('')
  );
}

/** The filters with one changed. `value` comes from a control whose options this element built from valid
 *  values, or is null, so it is a valid value of that filter. */
function withFilter(filters: Filters, name: FilterName, value: string | null): Filters {
  return { ...filters, [name]: value } as Filters;
}

/** A text field, a select or a text area takes `/` as an ordinary character (contracts/score-browser.md §4). */
function takesTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement)
    return !['button', 'checkbox', 'radio', 'submit', 'reset'].includes(target.type);
  return target.isContentEditable === true;
}

/**
 * The modal window that replaces the old *Scores* panel and recent-scores list as the one place to find a Score
 * (contracts/score-browser.md §1, R-1, R-20). A native `<dialog>` opened with `showModal()`: focus containment, an
 * inert background and `::backdrop` stacking all come from the platform, so nothing here re-implements a focus trap.
 * This element renders the dialog's chrome (header, the filter/sort toolbar with its chips, the empty state, the
 * status/message lines); the rail, list and detail panes are separate elements mounted into `.browser-body` by
 * `session.ts` (T027/T028). The close button is the last thing in the DOM (and sits top right by CSS) so that Tab
 * runs search, filters, sort, rail, list, detail, close, as the contract says (FR-028).
 */
export class MxScoreBrowser extends HTMLElement {
  private dialog!: HTMLDialogElement;
  private searchInput!: HTMLInputElement;
  private fileInput!: HTMLInputElement;
  private closeButton!: HTMLButtonElement;
  private statusLine!: HTMLElement;
  private unsubscribe?: () => void;
  /** What the last render set the dialog to, so a `browserState` change that does not cross the closed/open
   *  boundary (e.g. `ready` -> `opening`) never calls `showModal()`/`close()` a second time. */
  private shownOpen: boolean | null = null;
  /** contracts/score-browser.md §3: "opens the file chooser" - tracked so this only fires once per new
   *  `fileNotStored` message, not on every otherwise-unrelated `browserState` change while it is still showing. */
  private lastMessageCode: string | null = null;

  /** The rows of the data the browser last got, built once per load so a keystroke only re-queries them. */
  private items: BrowserItem[] = [];
  private itemsData: BrowserData | null = null;
  private options: { keys: string[]; tags: SkillTag[] } = { keys: [], tags: [] };
  private optionsSignature = '';
  private chipsSignature = '';
  private announceSignature: string | null = null;
  private announceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPending: PendingAction | null = null;

  connectedCallback() {
    this.innerHTML = `
      <dialog class="browser" data-testid="browser" aria-labelledby="browser-title">
        <header class="browser-header">
          <h2 id="browser-title">${escapeHtml(en.browser.title)}</h2>
          <input
            type="search"
            class="browser-search"
            data-testid="browser-search"
            aria-label="${escapeHtml(en.browser.searchLabel)}"
          />
          <button type="button" class="browser-open-file" data-testid="browser-open-file">
            ${escapeHtml(en.browser.openFile)}
          </button>
          <input type="file" class="browser-open-file-input" accept="${SCORE_FILE_ACCEPT}" hidden />
        </header>
        <div class="browser-toolbar">
          <button type="button" class="browser-folder-picker">${escapeHtml(en.browser.folderPicker)}</button>
          <span class="browser-breadcrumb"></span>
          <button type="button" class="browser-back">${escapeHtml(en.browser.back)}</button>
          <div class="browser-filters" role="group" aria-label="${escapeHtml(en.browser.filterBar.group)}">
            ${FILTER_NAMES.map(
              (name) => `<label class="browser-filter"><span>${escapeHtml(filterTitle(name))}</span>
                <select data-filter="${name}"></select></label>`,
            ).join('')}
          </div>
          <label class="browser-filter browser-sort"><span>${escapeHtml(en.browser.filterBar.sort)}</span>
            <select data-sort>${SORTS.map(({ sort, label }) => option(sortValue(sort), label, false)).join('')}</select>
          </label>
          <div class="browser-chips"></div>
          <p class="browser-level-description"></p>
        </div>
        <div class="browser-error" hidden>
          <p class="browser-error-message">${escapeHtml(en.browser.libraryUnavailable)}</p>
          <button type="button" class="browser-retry">${escapeHtml(en.browser.retry)}</button>
        </div>
        <div class="browser-empty" hidden></div>
        <div class="browser-body"></div>
        <p class="browser-status" aria-live="polite"></p>
        <p class="browser-message" role="alert"></p>
        <button type="button" class="browser-close" aria-label="${escapeHtml(en.browser.close)}">&times;</button>
      </dialog>
    `;
    this.dialog = this.querySelector('dialog') as HTMLDialogElement;
    this.searchInput = this.querySelector('.browser-search') as HTMLInputElement;
    this.fileInput = this.querySelector('.browser-open-file-input') as HTMLInputElement;
    this.closeButton = this.querySelector('.browser-close') as HTMLButtonElement;
    this.statusLine = this.querySelector('.browser-status') as HTMLElement;

    this.closeButton.addEventListener('click', () => this.requestClose());
    this.dialog.addEventListener('cancel', this.onCancel);
    this.dialog.addEventListener('click', this.onDialogClick);
    this.dialog.addEventListener('keydown', this.onKeydown);
    this.searchInput.addEventListener('input', () => {
      browserState.setView({ search: this.searchInput.value });
    });

    // US5: the filter and sort controls change the persisted view like the rail and the list do (contracts §3).
    for (const name of FILTER_NAMES) {
      const control = this.filterControl(name);
      control.addEventListener('change', () =>
        this.applyFilters(
          withFilter(browserState.get().view.filters, name, control.value === '' ? null : control.value),
        ),
      );
    }
    this.sortControl().addEventListener('change', () => {
      const chosen = SORTS.find(({ sort }) => sortValue(sort) === this.sortControl().value);
      if (chosen) this.applyView({ sort: chosen.sort });
    });

    // US3: *Open file...* and a drop onto the dialog take the same `browseropenfile` path (contracts §3).
    this.querySelector('.browser-open-file')?.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', () => {
      const file = this.fileInput.files?.[0] ?? null;
      this.fileInput.value = '';
      if (file) this.dispatchEvent(new CustomEvent('browseropenfile', { detail: { file }, bubbles: true }));
    });
    this.dialog.addEventListener('dragover', this.onDragOver);
    this.dialog.addEventListener('dragleave', this.onDragLeave);
    this.dialog.addEventListener('drop', this.onDrop);

    // 768-1023px: the rail is a folder-picker overlay (contracts/score-browser.md §1) - opened by this button,
    // closed again by choosing a folder (below) or picking a row (T027/T028 already select on click).
    this.querySelector('.browser-folder-picker')?.addEventListener('click', () => {
      this.querySelector('mx-browser-rail')?.classList.toggle('browser-rail-overlay-open');
    });
    // Below 768px: the detail pane is a panel over the list (contracts §1) - Back only hides the overlay, it
    // never changes the selection, so reopening the same row shows it again without re-querying anything.
    this.querySelector('.browser-back')?.addEventListener('click', () => {
      this.querySelector('mx-browser-detail')?.classList.remove('browser-detail-overlay-open');
    });
    this.addEventListener('browserviewchange', (event) => {
      const view = (event as CustomEvent<{ view?: Partial<{ selected: unknown }> }>).detail?.view;
      // 018: a disclosure toggle in the overlay changes only `expanded` and must not close it (a folder change does).
      const toggleOnly = view !== undefined && Object.keys(view).every((k) => k === 'expanded');
      if (!toggleOnly) this.querySelector('mx-browser-rail')?.classList.remove('browser-rail-overlay-open');
      if (view && 'selected' in view && view.selected) {
        this.querySelector('mx-browser-detail')?.classList.add('browser-detail-overlay-open');
      }
    });

    this.querySelector('.browser-retry')?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('browserretrylibrary', { bubbles: true }));
    });
    // The empty state's *Clear filters* is created by `syncEmpty`, so its click is caught here, once.
    this.querySelector('.browser-empty')?.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).closest('.browser-clear-filters')) this.clearFilters();
    });
    this.querySelector('.browser-chips')?.addEventListener('click', (event) => {
      const chip = (event.target as HTMLElement).closest<HTMLElement>('.browser-chip');
      if (chip?.dataset.filter) this.removeFilter(chip.dataset.filter as FilterName);
      else if ((event.target as HTMLElement).closest('.browser-clear-all')) this.clearFilters();
    });

    this.unsubscribe = browserState.subscribe(() => this.sync());
    this.sync();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
    if (this.announceTimer !== null) clearTimeout(this.announceTimer);
    this.dialog.removeEventListener('cancel', this.onCancel);
    this.dialog.removeEventListener('click', this.onDialogClick);
    this.dialog.removeEventListener('keydown', this.onKeydown);
    this.dialog.removeEventListener('dragover', this.onDragOver);
    this.dialog.removeEventListener('dragleave', this.onDragLeave);
    this.dialog.removeEventListener('drop', this.onDrop);
  }

  private filterControl(name: FilterName): HTMLSelectElement {
    return this.querySelector(`select[data-filter="${name}"]`) as HTMLSelectElement;
  }

  private sortControl(): HTMLSelectElement {
    return this.querySelector('select[data-sort]') as HTMLSelectElement;
  }

  private applyView(change: Partial<BrowserViewState>): void {
    browserState.setView(change);
    this.dispatchEvent(new CustomEvent('browserviewchange', { detail: { view: change }, bubbles: true }));
  }

  private applyFilters(filters: Filters): void {
    this.applyView({ filters });
  }

  /** A chip is gone once pressed, so focus goes to the control it stood for rather than falling to the page. */
  private removeFilter(name: FilterName): void {
    this.applyFilters(withFilter(browserState.get().view.filters, name, null));
    this.filterControl(name).focus();
  }

  private clearFilters(): void {
    this.applyFilters({ ...NO_FILTERS });
    this.filterControl('level').focus();
  }

  private readonly onDragOver = (event: Event): void => {
    event.preventDefault();
    this.dialog.classList.add('browser-drag-active');
  };

  private readonly onDragLeave = (): void => {
    this.dialog.classList.remove('browser-drag-active');
  };

  private readonly onDrop = (event: Event): void => {
    event.preventDefault();
    this.dialog.classList.remove('browser-drag-active');
    const file = (event as DragEvent).dataTransfer?.files?.[0] ?? null;
    if (file) this.dispatchEvent(new CustomEvent('browseropenfile', { detail: { file }, bubbles: true }));
  };

  /** Escape: clears a non-empty search first (contract §4); otherwise closes. Handled ourselves (not the dialog's
   *  default behaviour) so the two-step Escape works. */
  private readonly onCancel = (event: Event): void => {
    event.preventDefault();
    if (browserState.get().view.search !== '') {
      browserState.setView({ search: '' });
      return;
    }
    this.requestClose();
  };

  /** FR-028 (contracts/score-browser.md §4): `/` focuses search unless the musician is typing somewhere; Tab wraps
   *  from the last control (close) to the first (search) and Shift+Tab back, because with everything behind the modal
   *  dialog inert the browser would otherwise send focus out to its own toolbar instead of round again. */
  private readonly onKeydown = (event: KeyboardEvent): void => {
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !takesTyping(event.target)) {
      event.preventDefault();
      this.searchInput.focus();
    } else if (event.key === 'Tab' && !event.shiftKey && event.target === this.closeButton) {
      event.preventDefault();
      this.searchInput.focus();
    } else if (event.key === 'Tab' && event.shiftKey && event.target === this.searchInput) {
      event.preventDefault();
      this.closeButton.focus();
    }
  };

  /** A click whose target is the `<dialog>` element itself is the backdrop area (contract §1/R-1) - anything
   *  inside the header/toolbar/body stops propagation before it reaches here in the normal case, but the check
   *  below is the actual guard: only the dialog element's own click (not a descendant's) closes it. */
  private readonly onDialogClick = (event: Event): void => {
    if (event.target === this.dialog) this.requestClose();
  };

  private requestClose(): void {
    browserState.close();
    this.dispatchEvent(new CustomEvent('browserclose', { bubbles: true }));
  }

  /** Rebuilds the rows only when the data itself changed; every keystroke after that only queries them. */
  private refreshItems(data: BrowserData): void {
    if (data === this.itemsData) return;
    this.itemsData = data;
    this.items = buildBrowserItems(data.index, data.files, data.records, DEFAULT_MASTERY_THRESHOLDS, collator.compare);
    this.options = filterOptions(this.items, collator.compare);
  }

  private syncToolbar(view: BrowserViewState): void {
    const { filters } = view;
    const optionsSignature = JSON.stringify([this.options, filters.key, filters.tag]);
    if (optionsSignature !== this.optionsSignature) {
      this.optionsSignature = optionsSignature;
      this.filterControl('level').innerHTML = optionsHtml('level', LEVELS, filters.level);
      this.filterControl('key').innerHTML = optionsHtml('key', this.options.keys, filters.key);
      this.filterControl('tag').innerHTML = optionsHtml('tag', this.options.tags, filters.tag);
      this.filterControl('status').innerHTML = optionsHtml('status', STATUS_FILTERS, filters.status);
    }
    for (const name of FILTER_NAMES) this.filterControl(name).value = filters[name] ?? '';
    // 005 FR-009: a chosen level says in plain words what it means, so the musician can judge the fit.
    (this.querySelector('.browser-level-description') as HTMLElement).textContent = filters.level
      ? en.library.levelDescriptions[filters.level]
      : '';
    this.sortControl().value = sortValue(view.sort);

    const chipsSignature = JSON.stringify(filters);
    if (chipsSignature === this.chipsSignature) return;
    this.chipsSignature = chipsSignature;
    const chips = FILTER_NAMES.flatMap((name) => {
      const value = filters[name];
      if (value === null) return [];
      const text = `${filterTitle(name)}: ${filterValueLabel(name, value)}`;
      const remove = en.browser.filterBar.removeFilter.replace('{filter}', text);
      return [
        `<button type="button" class="browser-chip" data-filter="${name}" aria-label="${escapeHtml(remove)}">${escapeHtml(text)} <span aria-hidden="true">&times;</span></button>`,
      ];
    });
    const clearAll = hasFilters(filters)
      ? `<button type="button" class="browser-clear-all">${escapeHtml(en.browser.filterBar.clearAll)}</button>`
      : '';
    (this.querySelector('.browser-chips') as HTMLElement).innerHTML = chips.join('') + clearAll;
  }

  /** US5 #2: no match says so and, when filters are what emptied it, offers *Clear filters*. */
  private syncEmpty(phase: BrowserPhase, view: BrowserViewState): void {
    const empty = this.querySelector('.browser-empty') as HTMLElement;
    const narrowed = hasFilters(view.filters) || view.search.trim() !== '';
    const show =
      (phase === 'ready' || phase === 'opening') &&
      narrowed &&
      !showsContinue(view) &&
      queryBrowser(this.items, view, collator.compare).total === 0;
    if (!show) {
      empty.hidden = true;
      empty.innerHTML = '';
      return;
    }
    // *Clear filters* is there only while filters are part of the reason; nothing else re-renders it, so a focused
    // button is not torn down by an unrelated state change.
    const filtered = String(hasFilters(view.filters));
    if (!empty.hidden && empty.dataset.filtered === filtered) return;
    empty.hidden = false;
    empty.dataset.filtered = filtered;
    empty.innerHTML = `<p>${escapeHtml(en.browser.noResults)}</p>${
      hasFilters(view.filters)
        ? `<button type="button" class="browser-clear-filters">${escapeHtml(en.browser.clearFilters)}</button>`
        : ''
    }`;
  }

  /** Edge Cases (library unavailable): the library's folders say so, with *Retry*; *Continue* and *My files* keep
   *  working without it. It sits beside the list, not in it - a listbox holds options only (T089). */
  private syncLibraryError(phase: BrowserPhase, view: BrowserViewState, data: BrowserData): void {
    const kind = effectiveFolder(view).kind;
    const show = phase !== 'closed' && data.indexError !== null && kind !== 'continue' && kind !== 'myFiles';
    (this.querySelector('.browser-error') as HTMLElement).hidden = !show;
  }

  private titleOf(ref: Parameters<typeof itemRefKey>[0]): string {
    const key = itemRefKey(ref);
    const found = this.items.find((item) => itemRefKey(item.ref) === key);
    return found?.title ?? (ref.kind === 'library' ? ref.id : ref.fileKey);
  }

  private pendingText(pending: PendingAction): string {
    if (pending.kind === 'removeFile') {
      return en.browser.announceRemoved
        .replace('{title}', this.titleOf({ kind: 'file', fileKey: pending.fileKey }))
        .replace('{seconds}', String(Math.round(UNDO_WINDOW_MS / 1000)));
    }
    return en.browser.announceReset.replace('{title}', this.titleOf(pending.ref));
  }

  /** FR-028 (contracts §6): a removal or reset is announced at once; the item count only after the folder, search
   *  or filters have stopped changing for `BROWSER_ANNOUNCE_DEBOUNCE_MS`, so typing does not talk over itself. */
  private syncAnnouncements(phase: BrowserPhase, view: BrowserViewState, pending: PendingAction | null): void {
    if (pending !== this.lastPending) {
      this.lastPending = pending;
      if (pending !== null) this.statusLine.textContent = this.pendingText(pending);
    }
    if (phase === 'closed') {
      this.announceSignature = null;
      if (this.announceTimer !== null) clearTimeout(this.announceTimer);
      this.announceTimer = null;
      return;
    }
    const signature = JSON.stringify([phase === 'loading', effectiveFolder(view), view.search, view.filters]);
    if (signature === this.announceSignature) return;
    this.announceSignature = signature;
    if (this.announceTimer !== null) clearTimeout(this.announceTimer);
    this.announceTimer = null;
    if (phase === 'loading' || showsContinue(view)) return; // nothing to count yet, or cards instead of a list
    this.announceTimer = setTimeout(() => {
      this.announceTimer = null;
      this.announceCount();
    }, BROWSER_ANNOUNCE_DEBOUNCE_MS);
  }

  /** Contracts §6: "New best for {title}", once, when the browser is next open with its data (a run ended while it was
   *  closed, or the browser is open behind a finished run's Grade). A hash that names nothing listed is dropped. */
  private announceNewBest(phase: BrowserPhase, scoreKey: string | null): void {
    if (scoreKey === null || (phase !== 'ready' && phase !== 'opening')) return;
    const item = this.items.find((i) => i.scoreKey === scoreKey);
    if (item) this.statusLine.textContent = en.browser.announceNewBest.replace('{title}', item.title);
    browserState.clearNewBest();
  }

  private announceCount(): void {
    const { phase, view } = browserState.get();
    if (phase === 'closed' || showsContinue(view)) return;
    const { total } = queryBrowser(this.items, view, collator.compare);
    const narrowed = hasFilters(view.filters) || view.search.trim() !== '';
    this.statusLine.textContent =
      total === 0 && narrowed
        ? en.browser.noResults
        : (total === 1 ? en.browser.itemCount : en.browser.itemCountPlural).replace('{n}', String(total));
  }

  private sync(): void {
    const { phase, view, data, message, pending, newBestScoreKey } = browserState.get();
    const breadcrumb = this.querySelector('.browser-breadcrumb');
    if (breadcrumb) breadcrumb.textContent = folderLabel(view.folder, data.index);

    // Escape (and anything else that changes the stored search) must show in the field too; while typing the two
    // are already equal, so the caret is never disturbed.
    if (this.searchInput.value !== view.search) this.searchInput.value = view.search;

    this.refreshItems(data);
    this.syncToolbar(view);
    this.syncEmpty(phase, view);
    this.syncLibraryError(phase, view, data);
    this.syncAnnouncements(phase, view, pending);
    this.announceNewBest(phase, newBestScoreKey);

    const messageLine = this.querySelector('.browser-message');
    if (messageLine) messageLine.textContent = message ? messageText(message) : '';
    // contracts/score-browser.md §3: a *My files* entry with no stored copy opens the chooser - once per new
    // message, not on every otherwise-unrelated re-render while it is still showing.
    if (message?.code === 'fileNotStored' && this.lastMessageCode !== 'fileNotStored') this.fileInput.click();
    this.lastMessageCode = message?.code ?? null;

    const open = phase !== 'closed';
    if (open === this.shownOpen) return;
    // Only a real open->closed transition hands focus back (mx-panel's own `wasOpen` pattern) - otherwise the
    // very first render, which starts from `shownOpen === null`, would consume the remembered invoker before the
    // dialog ever opened.
    const wasOpen = this.shownOpen === true;
    this.shownOpen = open;
    if (open) {
      if (!this.dialog.open) this.dialog.showModal();
      this.searchInput.value = browserState.get().view.search;
      this.searchInput.focus();
    } else if (wasOpen) {
      if (this.dialog.open) this.dialog.close();
      restoreInvokerFocus();
    }
  }
}
customElements.define('mx-score-browser', MxScoreBrowser);
