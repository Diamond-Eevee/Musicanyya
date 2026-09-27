import { filterItems } from '../../core/library/filter.js';
import { buildSectionTree, type SectionNode } from '../../core/library/tree.js';
import type { Level, LibraryFilter, LibraryIndex, LibraryItem, SkillTag } from '../../core/library/types.js';
import type { CatalogError } from '../../engine/ports.js';
import { en } from '../i18n/en.js';
import { libraryState } from '../state/libraryState.js';
import { escapeHtml } from '../util/escape-html.js';

const INDEX_ERROR_NOTICE: Record<CatalogError, string> = {
  unavailable: 'libraryUnavailable',
  notFound: 'libraryIndexMissing',
  malformedIndex: 'libraryIndexMalformed',
  tooLarge: 'libraryUnavailable',
};

const NO_FILTER: LibraryFilter = { sectionId: null, level: null, key: null, tag: null, text: '' };

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

function itemsBySection(items: readonly LibraryItem[]): Map<string, LibraryItem[]> {
  const map = new Map<string, LibraryItem[]>();
  for (const item of items) {
    const list = map.get(item.section) ?? [];
    list.push(item);
    map.set(item.section, list);
  }
  return map;
}

function availableKeys(items: readonly LibraryItem[]): string[] {
  const keys = new Set<string>();
  for (const item of items) for (const key of item.facts.keys) keys.add(key);
  return Array.from(keys).sort(collator.compare);
}

function availableTags(items: readonly LibraryItem[]): SkillTag[] {
  const tags = new Set<SkillTag>();
  for (const item of items) for (const tag of item.meta.tags) tags.add(tag);
  return Array.from(tags).sort(collator.compare);
}

function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * The shelf inside the existing *Scores* panel (contracts/library-port.md §4, research R-10): every
 * non-empty section with its items, always expanded - browsing to a specific item never costs more
 * than the one click that opens it (SC-001). Filter chips (level/key/tag/text, US3, FR-012) narrow
 * which items show within those sections; the section headings themselves stay a fixed, non-clickable
 * tree so a filter never adds a second click before opening. A pure view of `libraryState`
 * (Constitution V): it renders what it is given and asks for what it wants via bubbling events -
 * `session.ts` does the actual fetching, and filter changes are applied to `libraryState` directly
 * (contracts/library-port.md §2 - both `mx-library` and `libraryState` already live in the UI layer).
 */
export class MxLibrary extends HTMLElement {
  /** What the last render set each folder to; a `toggle` that differs from it is the user's doing, not the render's. */
  private renderedOpen = new Map<string, boolean>();
  private unsubscribeStatus?: () => void;
  private unsubscribeFilter?: () => void;

  connectedCallback() {
    this.unsubscribeStatus = libraryState.subscribe(() => this.render());
    this.unsubscribeFilter = libraryState.subscribeFilter(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribeStatus?.();
    this.unsubscribeFilter?.();
  }

  private render() {
    const status = libraryState.getStatus();
    const s = en.library;

    if (status.kind === 'idle' || status.kind === 'loadingIndex') {
      this.innerHTML = `<p class="library-loading">${escapeHtml(s.loading)}</p>`;
      return;
    }

    if (status.kind === 'indexError') {
      const message = en.notices[INDEX_ERROR_NOTICE[status.error]] ?? en.notices.libraryUnavailable ?? '';
      this.innerHTML = `
        <div class="library-error">
          <p class="library-error-message">${escapeHtml(message)}</p>
          <button type="button" class="library-retry">${escapeHtml(s.retry)}</button>
        </div>`;
      this.querySelector('.library-retry')?.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('libraryretry', { bubbles: true }));
      });
      return;
    }

    const index = status.index;
    if (index.items.length === 0) {
      this.innerHTML = `<p class="library-empty">${escapeHtml(s.empty)}</p>`;
      return;
    }

    const filter = libraryState.getFilter();
    const filtered = filterItems(index.items, index.sections, filter, collator.compare);
    const bySection = itemsBySection(filtered);
    const isFiltered =
      filter.sectionId !== null ||
      filter.level !== null ||
      filter.key !== null ||
      filter.tag !== null ||
      filter.text !== '';
    // With a filter active every folder that holds a match is open and the rest are left out (the tree is built from the
    // matches); otherwise the user's own choices decide, starting from the default (library-port 1.2.0 §2).
    const tree = buildSectionTree(index.sections, filtered);
    const openByUser = libraryState.getOpenFolders();
    const isOpen = (id: string) => isFiltered || openByUser.has(id);
    this.renderedOpen = new Map();

    const sectionsHtml =
      filtered.length === 0 && isFiltered
        ? `<p class="library-no-results">${escapeHtml(s.filters.noResults)}</p>`
        : tree.map((node) => this.nodeHtml(node, bySection, isOpen)).join('');

    // A full innerHTML replacement (contracts/library-port.md §5) would otherwise steal focus and the
    // cursor out of the text box on every keystroke - save and restore them around it.
    const textInput = this.querySelector<HTMLInputElement>('.library-filter-text');
    const hadFocus = document.activeElement === textInput;
    const selectionStart = textInput?.selectionStart ?? null;

    this.innerHTML = `<div class="library">${this.filterBarHtml(index, filter)}${sectionsHtml}</div>`;
    this.wire(filter, isFiltered);

    if (hadFocus) {
      const restored = this.querySelector<HTMLInputElement>('.library-filter-text');
      restored?.focus();
      if (restored && selectionStart !== null) restored.setSelectionRange(selectionStart, selectionStart);
    }
  }

  private filterBarHtml(index: LibraryIndex, filter: LibraryFilter): string {
    const s = en.library;
    const keys = availableKeys(index.items);
    const tags = availableTags(index.items);
    const levelOption = (level: Level) =>
      `<option value="${level}" ${filter.level === level ? 'selected' : ''}>${escapeHtml(s.levels[level])}</option>`;
    const keyOption = (key: string) =>
      `<option value="${escapeHtml(key)}" ${filter.key === key ? 'selected' : ''}>${escapeHtml(key)}</option>`;
    const tagOption = (tag: SkillTag) =>
      `<option value="${tag}" ${filter.tag === tag ? 'selected' : ''}>${escapeHtml(s.tags[tag] ?? tag)}</option>`;

    const description = filter.level
      ? `<p class="library-level-description">${escapeHtml(s.levelDescriptions[filter.level])}</p>`
      : '';

    return `
      <div class="library-filters">
        <label class="library-filter">
          <span>${escapeHtml(s.filters.level)}</span>
          <select class="library-filter-level">
            <option value="" ${filter.level === null ? 'selected' : ''}>${escapeHtml(s.filters.anyLevel)}</option>
            ${levelOption('introduction')}${levelOption('beginner')}${levelOption('intermediate')}${levelOption('advanced')}
          </select>
        </label>
        <label class="library-filter">
          <span>${escapeHtml(s.filters.key)}</span>
          <select class="library-filter-key">
            <option value="" ${filter.key === null ? 'selected' : ''}>${escapeHtml(s.filters.anyKey)}</option>
            ${keys.map(keyOption).join('')}
          </select>
        </label>
        <label class="library-filter">
          <span>${escapeHtml(s.filters.tag)}</span>
          <select class="library-filter-tag">
            <option value="" ${filter.tag === null ? 'selected' : ''}>${escapeHtml(s.filters.anyTag)}</option>
            ${tags.map(tagOption).join('')}
          </select>
        </label>
        <label class="library-filter">
          <span>${escapeHtml(s.filters.text)}</span>
          <input type="text" class="library-filter-text" value="${escapeHtml(filter.text)}" />
        </label>
        <button type="button" class="library-filter-clear">${escapeHtml(s.filters.clear)}</button>
      </div>
      ${description}`;
  }

  /** One folder: a native `<details>` (Enter/Space toggle, keyboard and screen reader for free) with its own items, then its
   *  child folders. Key-change folders also show their relation word in the summary (library-port 1.2.0 §2). */
  private nodeHtml(
    node: SectionNode,
    bySection: ReadonlyMap<string, readonly LibraryItem[]>,
    isOpen: (id: string) => boolean,
  ): string {
    const { section } = node;
    const open = isOpen(section.id);
    this.renderedOpen.set(section.id, open);
    const relation =
      section.id.startsWith('learning/key-changes/') && section.description
        ? ` <span class="library-section-relation">${escapeHtml(section.description)}</span>`
        : '';
    const own = bySection.get(section.id) ?? [];
    const items =
      own.length > 0 ? `<ul class="library-items">${own.map((item) => this.itemHtml(item)).join('')}</ul>` : '';
    const children = node.children.map((child) => this.nodeHtml(child, bySection, isOpen)).join('');
    return `
      <details class="library-section" data-section="${escapeHtml(section.id)}" data-depth="${node.depth}"${open ? ' open' : ''}>
        <summary class="library-section-title">${escapeHtml(section.title)}${relation}</summary>
        ${items}${children}
      </details>`;
  }

  private itemHtml(item: LibraryItem): string {
    const s = en.library;
    const composer = item.meta.composer ? escapeHtml(item.meta.composer) : '';
    const step = item.meta.step ? s.steps[item.meta.step] : '';
    return `
      <li class="library-item">
        <button type="button" class="library-item-open" data-id="${escapeHtml(item.id)}">
          <span class="library-item-title">${escapeHtml(item.meta.title)}</span>
          ${composer ? `<span class="library-item-composer">${composer}</span>` : ''}
          ${step ? `<span class="library-item-step">${escapeHtml(step)}</span>` : ''}
          <span class="library-item-level">${escapeHtml(s.levels[item.meta.level])}</span>
          ${this.itemDetailHtml(item)}
        </button>
      </li>`;
  }

  /** FR-010, FR-012: every item's key, metre, tempo, measure count, duration, hands and tags,
   *  visible without a second click (US3, T047/T051). */
  private itemDetailHtml(item: LibraryItem): string {
    const s = en.library;
    const { facts, meta } = item;
    const parts: string[] = [];
    if (facts.keys.length > 0) parts.push(`${s.detail.key}: ${escapeHtml(facts.keys.join(', '))}`);
    if (facts.metres.length > 0) parts.push(`${s.detail.metre}: ${escapeHtml(facts.metres.join(', '))}`);
    if (facts.tempoBpm !== null) parts.push(`${s.detail.tempo}: ${Math.round(facts.tempoBpm)} ${en.transport.bpm}`);
    parts.push(`${s.detail.measures}: ${facts.measures}`);
    parts.push(`${s.detail.duration}: ${formatDuration(facts.durationSeconds)}`);
    if (meta.hands) parts.push(`${s.detail.hands}: ${escapeHtml(meta.hands)}`);
    const tags = meta.tags.map((tag) => escapeHtml(s.tags[tag] ?? tag)).join(', ');
    if (tags) parts.push(`${s.filters.tag}: ${tags}`);
    return `<span class="library-item-detail">${parts.join(' · ')}</span>`;
  }

  private wire(filter: LibraryFilter, isFiltered: boolean) {
    this.querySelectorAll<HTMLButtonElement>('.library-item-open').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.dataset.id;
        if (id) this.dispatchEvent(new CustomEvent('openlibraryitem', { detail: { id }, bubbles: true }));
      });
    });

    // A folder the user opens or closes is remembered for the session. While a filter is active the panel decides (every
    // folder with a match is open), so those toggles are not the user's choice and are left out of the remembered state.
    this.querySelectorAll<HTMLDetailsElement>('details.library-section').forEach((details) => {
      details.addEventListener('toggle', () => {
        const id = details.dataset.section;
        if (!id || isFiltered || details.open === this.renderedOpen.get(id)) return;
        libraryState.setFolderOpen(id, details.open);
        this.renderedOpen.set(id, details.open);
      });
    });

    const levelSelect = this.querySelector<HTMLSelectElement>('.library-filter-level');
    levelSelect?.addEventListener('change', () => {
      const value = levelSelect.value as '' | Level;
      this.applyFilter({ ...filter, level: value === '' ? null : value });
    });

    const keySelect = this.querySelector<HTMLSelectElement>('.library-filter-key');
    keySelect?.addEventListener('change', () => {
      this.applyFilter({ ...filter, key: keySelect.value === '' ? null : keySelect.value });
    });

    const tagSelect = this.querySelector<HTMLSelectElement>('.library-filter-tag');
    tagSelect?.addEventListener('change', () => {
      this.applyFilter({ ...filter, tag: tagSelect.value === '' ? null : (tagSelect.value as SkillTag) });
    });

    const textInput = this.querySelector<HTMLInputElement>('.library-filter-text');
    textInput?.addEventListener('input', () => {
      this.applyFilter({ ...filter, text: textInput.value });
    });

    this.querySelector('.library-filter-clear')?.addEventListener('click', () => {
      this.applyFilter(NO_FILTER);
    });
  }

  private applyFilter(filter: LibraryFilter) {
    libraryState.setFilter(filter);
    this.dispatchEvent(new CustomEvent('libraryfilterchange', { detail: { filter }, bubbles: true }));
  }
}
customElements.define('mx-library', MxLibrary);
