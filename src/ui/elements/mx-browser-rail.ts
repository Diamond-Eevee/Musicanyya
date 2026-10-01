import { folderProgress, MY_FILES_FOLDER_KEY } from '../../core/browser/folders.js';
import { buildBrowserItems } from '../../core/browser/items.js';
import { effectiveFolder } from '../../core/browser/query.js';
import { containsChosen, isExpanded, setExpanded } from '../../core/browser/tree-state.js';
import type { BrowserViewState, FolderSel } from '../../core/browser/types.js';
import { buildSectionTree, type SectionNode } from '../../core/library/tree.js';
import { DEFAULT_MASTERY_THRESHOLDS } from '../../core/progress/types.js';
import { en } from '../i18n/en.js';
import { browserState } from '../state/browserState.js';
import { escapeHtml } from '../util/escape-html.js';
import { patchChildren } from '../util/patch-children.js';

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

/** The section id of a rail key (`section:<id>`). */
function sectionIdOf(key: string): string {
  return key.slice('section:'.length);
}

function folderOf(key: string): FolderSel {
  if (key === 'all' || key === 'myFiles' || key === 'continue') return { kind: key };
  return { kind: 'section', id: sectionIdOf(key) };
}

interface RailEntry {
  key: string;
  label: string;
  depth: number;
  parent: string | null;
  hasChildren: boolean;
  expanded: boolean;
  /** 018 R-7: collapsed, and the chosen folder is one of its hidden descendants. */
  containsChosen: boolean;
  progress: string;
  /** Key-change folders only (011): how the second key relates to the first, e.g. "relative minor". */
  relation: string;
}

/**
 * The rail (`role="tree"`, contracts/score-browser.md §1, §4): *Continue*, *All*, the section tree and *My files*.
 * Folders with sub-folders start collapsed (018 FR-007) and have a disclosure control (`.browser-rail-toggle`) that
 * opens and closes them; which folders are open is `view.expanded`, stored with the rest of the browser view
 * (018 R-2), so the pointer and the keyboard change the same remembered state. A click on a folder's name chooses it
 * and also opens it when it is closed, never closes it (FR-003). The keyboard follows the WAI-ARIA tree pattern:
 * focus (one roving tab stop) moves with the arrow keys, Home and End, Left and Right close and open, and choosing a
 * folder is a separate act (Enter or Space), so walking the tree does not rebuild the list under the musician. A pure
 * view of `browserState` (Principle V): it renders the state it is given and asks for changes through
 * `browserState.setView` and a bubbling event.
 */
export class MxBrowserRail extends HTMLElement {
  private unsubscribe?: () => void;
  /** The folder holding the roving tab stop (and the focus while the rail has it); null = the selected folder. */
  private focusKey: string | null = null;

  connectedCallback() {
    this.setAttribute('role', 'tree');
    this.setAttribute('aria-label', en.browser.title);
    this.classList.add('browser-rail');
    this.addEventListener('keydown', this.onKeydown);
    this.addEventListener('click', this.onClick);
    this.unsubscribe = browserState.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
    this.removeEventListener('keydown', this.onKeydown);
    this.removeEventListener('click', this.onClick);
  }

  /** The visible folders in tree order: a folder hidden by a collapsed ancestor is left out. */
  private entries(): RailEntry[] {
    const { data, view } = browserState.get();
    const sections = data.index?.sections ?? [];
    const chosen = effectiveFolder(view);
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
      containsChosen: false,
      progress,
      relation: '',
    });
    const out: RailEntry[] = [top('continue', en.browser.folders.continue), top('all', en.browser.folders.all)];
    const walk = (node: SectionNode, parent: string | null) => {
      const key = `section:${node.section.id}`;
      const hasChildren = node.children.length > 0;
      const expanded = hasChildren && isExpanded(view.expanded, node.section.id);
      out.push({
        key,
        label: node.section.title,
        depth: node.depth,
        parent,
        hasChildren,
        expanded,
        containsChosen: hasChildren && !expanded && containsChosen(node.section.id, chosen, sections),
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
    const selectedKey = folderKey(effectiveFolder(browserState.get().view));
    const entries = this.entries();
    const stop = this.tabStop(entries);
    // Replacing the items would drop focus to the page; the musician keeps their place in the tree.
    const hadFocus = this.contains(document.activeElement);
    // Items whose markup did not change stay the same elements, so a click that an update lands in the middle of
    // (press, update, release) still arrives - it was lost on the first click after the browser's load-time update.
    patchChildren(
      this,
      entries
        .map((entry) => {
          const selected = entry.key === selectedKey;
          return `<div role="treeitem" class="browser-rail-item" data-key="${escapeHtml(entry.key)}"
          data-depth="${entry.depth}" aria-level="${entry.depth + 1}" tabindex="${entry.key === stop ? '0' : '-1'}"
          aria-selected="${selected}" ${entry.hasChildren ? `aria-expanded="${entry.expanded}"` : ''}
          ${entry.containsChosen ? 'data-contains-selected' : ''}
          style="--browser-rail-depth:${entry.depth}"
          >${
            entry.hasChildren
              ? '<span class="browser-rail-toggle" aria-hidden="true"></span>'
              : '<span class="browser-rail-toggle-space" aria-hidden="true"></span>'
          }<span class="browser-rail-label">${escapeHtml(entry.label)}${
            entry.containsChosen ? `<span class="visually-hidden">${escapeHtml(en.browser.containsChosen)}</span>` : ''
          }</span>${
            entry.relation ? `<span class="browser-rail-relation">${escapeHtml(entry.relation)}</span>` : ''
          }${entry.progress ? `<span class="browser-rail-progress">${escapeHtml(entry.progress)}</span>` : ''}</div>`;
        })
        .join(''),
    );
    if (hadFocus) this.itemFor(stop)?.focus();
    // 018 R-8: after a restore the chosen folder is brought into view. The request is lowered by `mx-browser-list`
    // (it is always mounted with the rail in the browser); a rail on its own would scroll on every render.
    if (browserState.get().revealSelection) this.itemFor(selectedKey)?.scrollIntoView({ block: 'nearest' });
  }

  /** One listener on the rail, not one per item: items are kept across renders (`patchChildren`). */
  private readonly onClick = (event: MouseEvent): void => {
    if (!(event.target instanceof Element)) return;
    const item = event.target.closest<HTMLElement>('.browser-rail-item');
    const key = item?.dataset.key;
    if (!item || !key) return;
    if (event.target.closest('.browser-rail-toggle')) this.setOpen(key, item.getAttribute('aria-expanded') !== 'true');
    else this.select(key, item.getAttribute('aria-expanded') === 'false');
  };

  /** Saves a view change and tells the browser dialog (it closes the folder-picker overlay on a folder change). */
  private commit(change: Partial<BrowserViewState>): void {
    browserState.setView(change);
    this.dispatchEvent(new CustomEvent('browserviewchange', { detail: { view: change }, bubbles: true }));
  }

  /** Chooses a folder; `openIt` also opens it (a closed folder with sub-folders, FR-003). */
  private select(key: string, openIt: boolean): void {
    this.focusKey = key;
    const change: Partial<BrowserViewState> = { folder: folderOf(key) };
    if (openIt) change.expanded = setExpanded(browserState.get().view.expanded, sectionIdOf(key), true);
    this.commit(change);
  }

  /** Moves the roving tab stop and the focus to `key`, without rebuilding the tree or choosing the folder. */
  private focusItem(key: string): void {
    this.focusKey = key;
    this.querySelectorAll<HTMLElement>('.browser-rail-item').forEach((el) => {
      el.tabIndex = el.dataset.key === key ? 0 : -1;
    });
    this.itemFor(key)?.focus();
  }

  /** Opens or closes one folder (the pointer toggle, Right and Left): the chosen folder and the list stay as they are. */
  private setOpen(key: string, open: boolean): void {
    this.focusKey = key;
    const { expanded } = browserState.get().view;
    const next = setExpanded(expanded, sectionIdOf(key), open);
    if (next !== expanded) this.commit({ expanded: next });
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
        if (current.hasChildren && !current.expanded) this.setOpen(current.key, true);
        else if (current.hasChildren) this.focusItem((entries[index + 1] ?? current).key); // its first child
        break;
      case 'ArrowLeft':
        if (current.hasChildren && current.expanded) this.setOpen(current.key, false);
        else if (current.parent !== null) this.focusItem(current.parent);
        break;
      case 'Enter':
      case ' ':
        this.select(current.key, current.hasChildren && !current.expanded);
        break;
      default:
        handled = false;
    }
    if (handled) event.preventDefault();
  };
}
customElements.define('mx-browser-rail', MxBrowserRail);
