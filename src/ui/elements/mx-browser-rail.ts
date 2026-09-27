import { folderProgress, MY_FILES_FOLDER_KEY } from '../../core/browser/folders.js';
import { buildBrowserItems } from '../../core/browser/items.js';
import type { FolderSel } from '../../core/browser/types.js';
import { buildSectionTree, type SectionNode } from '../../core/library/tree.js';
import { DEFAULT_MASTERY_THRESHOLDS } from '../../core/progress/types.js';
import { en } from '../i18n/en.js';
import { browserState } from '../state/browserState.js';
import { escapeHtml } from '../util/escape-html.js';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

function folderProgressText(counts: { played: number; mastered: number; total: number } | undefined): string {
  if (!counts || counts.total === 0) return '';
  return en.browser.folderProgress
    .replace('{played}', String(counts.played))
    .replace('{total}', String(counts.total))
    .replace('{mastered}', String(counts.mastered));
}

function folderKey(folder: FolderSel): string {
  return folder.kind === 'section' ? `section:${folder.id}` : folder.kind;
}

function folderOf(key: string): FolderSel {
  if (key === 'all' || key === 'myFiles' || key === 'continue') return { kind: key };
  return { kind: 'section', id: key.slice('section:'.length) };
}

/**
 * The rail (`role="tree"`, contracts/score-browser.md §1): *Continue*, *All*, the section tree and *My files*.
 * Every folder starts expanded (US1: a key folder is visible without an extra click, SC-001) - collapsing and the
 * full APG key set (Right/Left, Home/End) are T084; this is the basic Up/Down/Enter pass T027 asks for. A pure
 * view of `browserState` (Principle V): it renders the index it is given and asks for a folder change via a
 * bubbling event, the same way `mx-library` asks for a filter change.
 */
export class MxBrowserRail extends HTMLElement {
  private unsubscribe?: () => void;

  connectedCallback() {
    this.setAttribute('role', 'tree');
    this.setAttribute('aria-label', en.browser.title);
    this.classList.add('browser-rail');
    this.addEventListener('keydown', this.onKeydown);
    this.unsubscribe = browserState.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
    this.removeEventListener('keydown', this.onKeydown);
  }

  private entries(): { key: string; label: string; depth: number; hasChildren: boolean; progress: string }[] {
    const { data } = browserState.get();
    const tree = data.index ? buildSectionTree(data.index.sections, data.index.items) : [];
    // FR-014: counted over every row the browser knows, sections and My files alike (folderProgress.js).
    const items = buildBrowserItems(data.index, data.files, data.records, DEFAULT_MASTERY_THRESHOLDS, collator.compare);
    const counts = folderProgress(tree, items);
    const out: { key: string; label: string; depth: number; hasChildren: boolean; progress: string }[] = [
      { key: 'continue', label: en.browser.folders.continue, depth: 0, hasChildren: false, progress: '' },
      { key: 'all', label: en.browser.folders.all, depth: 0, hasChildren: false, progress: '' },
    ];
    const walk = (node: SectionNode) => {
      out.push({
        key: `section:${node.section.id}`,
        label: node.section.title,
        depth: node.depth,
        hasChildren: node.children.length > 0,
        progress: folderProgressText(counts.get(node.section.id)),
      });
      node.children.forEach(walk);
    };
    tree.forEach(walk);
    out.push({
      key: 'myFiles',
      label: en.browser.folders.myFiles,
      depth: 0,
      hasChildren: false,
      progress: folderProgressText(counts.get(MY_FILES_FOLDER_KEY)),
    });
    return out;
  }

  private render(): void {
    const selectedKey = folderKey(browserState.get().view.folder);
    const entries = this.entries();
    this.innerHTML = entries
      .map((entry) => {
        const selected = entry.key === selectedKey;
        return `<div role="treeitem" class="browser-rail-item" data-key="${escapeHtml(entry.key)}"
          data-depth="${entry.depth}" tabindex="${selected ? '0' : '-1'}" aria-selected="${selected}"
          ${entry.hasChildren ? 'aria-expanded="true"' : ''} style="--browser-rail-depth:${entry.depth}"
          ><span class="browser-rail-label">${escapeHtml(entry.label)}</span>${
            entry.progress ? `<span class="browser-rail-progress">${escapeHtml(entry.progress)}</span>` : ''
          }</div>`;
      })
      .join('');
    this.wire();
  }

  private wire(): void {
    this.querySelectorAll<HTMLElement>('.browser-rail-item').forEach((el) => {
      el.addEventListener('click', () => this.select(el.dataset.key ?? ''));
    });
  }

  private select(key: string): void {
    if (key === '') return;
    const folder = folderOf(key);
    browserState.setView({ folder });
    this.dispatchEvent(new CustomEvent('browserviewchange', { detail: { view: { folder } }, bubbles: true }));
  }

  private readonly onKeydown = (event: KeyboardEvent): void => {
    const entries = this.entries();
    const selectedKey = folderKey(browserState.get().view.folder);
    const index = entries.findIndex((e) => e.key === selectedKey);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = entries[Math.min(entries.length - 1, index + 1)];
      if (next) this.select(next.key);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prev = entries[Math.max(0, index - 1)];
      if (prev) this.select(prev.key);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const current = entries[index];
      if (current) this.select(current.key);
    }
  };
}
customElements.define('mx-browser-rail', MxBrowserRail);
