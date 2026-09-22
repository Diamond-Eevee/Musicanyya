import { filterItems } from '../../core/library/filter.js';
import type { LibraryFilter, LibraryIndex, LibraryItem, LibrarySection, SkillTag } from '../../core/library/types.js';
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
    const sections = [...index.sections].sort((a, b) => a.order - b.order);
    const isFiltered = filter.level !== null || filter.key !== null || filter.tag !== null || filter.text !== '';

    const sectionsHtml =
      filtered.length === 0 && isFiltered
        ? `<p class="library-no-results">${escapeHtml(s.filters.noResults)}</p>`
        : sections
            .map((section) => this.sectionHtml(section, bySection.get(section.id) ?? []))
            .filter((html) => html !== '')
            .join('');

    // A full innerHTML replacement (contracts/library-port.md §5) would otherwise steal focus and the
    // cursor out of the text box on every keystroke - save and restore them around it.
    const textInput = this.querySelector<HTMLInputElement>('.library-filter-text');
    const hadFocus = document.activeElement === textInput;
    const selectionStart = textInput?.selectionStart ?? null;

    this.innerHTML = `<div class="library">${this.filterBarHtml(index, filter)}${sectionsHtml}</div>`;
    this.wire(filter);

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
    const levelOption = (level: 'beginner' | 'intermediate' | 'advanced') =>
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
            ${levelOption('beginner')}${levelOption('intermediate')}${levelOption('advanced')}
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

  private sectionHtml(section: LibrarySection, items: readonly LibraryItem[]): string {
    if (items.length === 0) return '';
    return `
      <section class="library-section" data-section="${escapeHtml(section.id)}">
        <h3 class="library-section-title">${escapeHtml(section.title)}</h3>
        <ul class="library-items">${items.map((item) => this.itemHtml(item)).join('')}</ul>
      </section>`;
  }

  private itemHtml(item: LibraryItem): string {
    const s = en.library;
    const composer = item.meta.composer ? escapeHtml(item.meta.composer) : '';
    return `
      <li class="library-item">
        <button type="button" class="library-item-open" data-id="${escapeHtml(item.id)}">
          <span class="library-item-title">${escapeHtml(item.meta.title)}</span>
          ${composer ? `<span class="library-item-composer">${composer}</span>` : ''}
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
    if (facts.tempoBpm !== null) parts.push(`${s.detail.tempo}: ${Math.round(facts.tempoBpm)}`);
    parts.push(`${s.detail.measures}: ${facts.measures}`);
    parts.push(`${s.detail.duration}: ${formatDuration(facts.durationSeconds)}`);
    if (meta.hands) parts.push(`${s.detail.hands}: ${escapeHtml(meta.hands)}`);
    const tags = meta.tags.map((tag) => escapeHtml(s.tags[tag] ?? tag)).join(', ');
    if (tags) parts.push(`${s.filters.tag}: ${tags}`);
    return `<span class="library-item-detail">${parts.join(' · ')}</span>`;
  }

  private wire(filter: LibraryFilter) {
    this.querySelectorAll<HTMLButtonElement>('.library-item-open').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.dataset.id;
        if (id) this.dispatchEvent(new CustomEvent('openlibraryitem', { detail: { id }, bubbles: true }));
      });
    });

    const levelSelect = this.querySelector<HTMLSelectElement>('.library-filter-level');
    levelSelect?.addEventListener('change', () => {
      const value = levelSelect.value as '' | 'beginner' | 'intermediate' | 'advanced';
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
