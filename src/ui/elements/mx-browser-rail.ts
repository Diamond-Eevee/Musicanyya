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

interface RailEntry {
  key: string;
  label: string;
  depth: number;
  parent: string | null;
  hasChildren: boolean;
  expanded: boolean;
  progress: string;
  /** Key-change folders only (011): how the second key relates to the first, e.g. "relative minor". */
  relation: string;
}

/**
 * The rail (`role="tree"`, contracts/score-browser.md §1, §4): *Continue*, *All*, the section tree and *My files*.
 * Every folder starts expanded (US1: a key folder is visible without an extra click, SC-001); Left and Right
 * collapse and expand, for the session only. The keyboard follows the WAI-ARIA tree pattern: focus (one roving tab
 * stop) moves with the arrow keys, Home and End, and choosing a folder is a separate act (Enter or Space), so
 * walking the tree does not rebuild the list under the musician. A pure view of `browserState` (Principle V): it
 * renders the index it is given and asks for a folder change via a bubbling event.
 */
export class MxBrowserRail extends HTMLElement {
  private unsubscribe?: () => void;
  /** The folder holding the roving tab stop (and the focus while the rail has it); null = the selected folder. */
  private focusKey: string | null = null;
  /** Folders the musician collapsed (Left), kept while this element lives - never stored (contracts §1). */
  private readonly collapsed = new Set<string>();

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

  /** The visible folders in tree order: a folder hidden by a collapsed ancestor is left out. */
  private entries(): RailEntry[] {
    const { data } = browserState.get();
    const tree = data.index ? buildSectionTree(data.index.sections, data.index.items) : [];
    // FR-014: counted over every row the browser knows, sections and My files alike (folderProgress.js).
    const items = buildBrowserItems(data.index, data.files, data.records, DEFAULT_MASTERY_THRESHOLDS, collator.compare);
    const counts = folderProgress(tree, items);
    const top = (key: string, label: string, progress = ''): RailEntry => ({
      key,
      label,
      depth: 0,
      parent: null,
      hasChildren: false,
      expanded: false,
      progress,
      relation: '',
    });
    const out: RailEntry[] = [top('continue', en.browser.folders.continue), top('all', en.browser.folders.all)];
    const walk = (node: SectionNode, parent: string | null) => {
      const key = `section:${node.section.id}`;
      const hasChildren = node.children.length > 0;
      const expanded = hasChildren && !this.collapsed.has(key);
      out.push({
        key,
        label: node.section.title,
        depth: node.depth,
        parent,
        hasChildren,
        expanded,
        progress: folderProgressText(counts.get(node.section.id)),
        relation: node.section.id.startsWith('learning/key-changes/') ? (node.section.description ?? '') : '',
      });
      if (expanded) for (const child of node.children) walk(child, key);
    };
    for (const node of tree) walk(node, null);
    out.push(top('myFiles', en.browser.folders.myFiles, folderProgressText(counts.get(MY_FILES_FOLDER_KEY))));
    return out;
  }

  /** The folder with the roving tab stop: the one last focused or chosen, else the selected one, else the first. */
  private tabStop(entries: readonly RailEntry[]): string | undefined {
    const wanted = this.focusKey ?? folderKey(browserState.get().view.folder);
    return (entries.find((e) => e.key === wanted) ?? entries[0])?.key;
  }

  private itemFor(key: string | undefined): HTMLElement | null {
    if (key === undefined) return null;
    const items = Array.from(this.querySelectorAll<HTMLElement>('.browser-rail-item'));
    return items.find((el) => el.dataset.key === key) ?? null;
  }

  private render(): void {
    const selectedKey = folderKey(browserState.get().view.folder);
    const entries = this.entries();
    const stop = this.tabStop(entries);
    // Replacing the items would drop focus to the page; the musician keeps their place in the tree.
    const hadFocus = this.contains(document.activeElement);
    this.innerHTML = entries
      .map((entry) => {
        const selected = entry.key === selectedKey;
        return `<div role="treeitem" class="browser-rail-item" data-key="${escapeHtml(entry.key)}"
          data-depth="${entry.depth}" aria-level="${entry.depth + 1}" tabindex="${entry.key === stop ? '0' : '-1'}"
          aria-selected="${selected}" ${entry.hasChildren ? `aria-expanded="${entry.expanded}"` : ''}
          style="--browser-rail-depth:${entry.depth}"
          ><span class="browser-rail-label">${escapeHtml(entry.label)}</span>${
            entry.relation ? `<span class="browser-rail-relation">${escapeHtml(entry.relation)}</span>` : ''
          }${entry.progress ? `<span class="browser-rail-progress">${escapeHtml(entry.progress)}</span>` : ''}</div>`;
      })
      .join('');
    this.wire();
    if (hadFocus) this.itemFor(stop)?.focus();
  }

  private wire(): void {
    this.querySelectorAll<HTMLElement>('.browser-rail-item').forEach((el) => {
      el.addEventListener('click', () => this.select(el.dataset.key ?? ''));
    });
  }

  private select(key: string): void {
    if (key === '') return;
    this.focusKey = key;
    const folder = folderOf(key);
    browserState.setView({ folder });
    this.dispatchEvent(new CustomEvent('browserviewchange', { detail: { view: { folder } }, bubbles: true }));
  }

  /** Moves the roving tab stop and the focus to `key`, without rebuilding the tree or choosing the folder. */
  private focusItem(key: string): void {
    this.focusKey = key;
    this.querySelectorAll<HTMLElement>('.browser-rail-item').forEach((el) => {
      el.tabIndex = el.dataset.key === key ? 0 : -1;
    });
    this.itemFor(key)?.focus();
  }

  private setExpanded(key: string, expanded: boolean): void {
    if (expanded) this.collapsed.delete(key);
    else this.collapsed.add(key);
    this.focusKey = key;
    this.render();
  }

  private readonly onKeydown = (event: KeyboardEvent): void => {
    const entries = this.entries();
    // The folder the key was pressed on; the tab stop only when the event did not come from an item.
    const from = (event.target as HTMLElement).closest<HTMLElement>('.browser-rail-item')?.dataset.key;
    const index = entries.findIndex((e) => e.key === (from ?? this.tabStop(entries)));
    const current = entries[index];
    if (!current) return;
    let handled = true;
    switch (event.key) {
      case 'ArrowDown':
        this.focusItem((entries[Math.min(entries.length - 1, index + 1)] ?? current).key);
        break;
      case 'ArrowUp':
        this.focusItem((entries[Math.max(0, index - 1)] ?? current).key);
        break;
      case 'Home':
        this.focusItem((entries[0] ?? current).key);
        break;
      case 'End':
        this.focusItem((entries[entries.length - 1] ?? current).key);
        break;
      case 'ArrowRight':
        if (current.hasChildren && !current.expanded) this.setExpanded(current.key, true);
        else if (current.hasChildren) this.focusItem((entries[index + 1] ?? current).key); // its first child
        break;
      case 'ArrowLeft':
        if (current.hasChildren && current.expanded) this.setExpanded(current.key, false);
        else if (current.parent !== null) this.focusItem(current.parent);
        break;
      case 'Enter':
      case ' ':
        this.select(current.key);
        break;
      default:
        handled = false;
    }
    if (handled) event.preventDefault();
  };
}
customElements.define('mx-browser-rail', MxBrowserRail);
