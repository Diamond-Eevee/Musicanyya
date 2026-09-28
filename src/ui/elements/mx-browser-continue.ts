import { buildBrowserItems } from '../../core/browser/items.js';
import { showsContinue } from '../../core/browser/query.js';
import type { BrowserItem, Suggestion } from '../../core/browser/types.js';
import { buildSectionTree } from '../../core/library/tree.js';
import { continueItems, morePractice, suggestNext } from '../../core/progress/suggest.js';
import { DEFAULT_MASTERY_THRESHOLDS, type ItemRef, itemRefKey } from '../../core/progress/types.js';
import { relativeDate, resultFigures, resultTempoSuffix } from '../format/result-text.js';
import { en } from '../i18n/en.js';
import './mx-status-badge.js';
import { browserState } from '../state/browserState.js';
import { escapeHtml } from '../util/escape-html.js';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

/**
 * The *Continue* view (contracts/score-browser.md §2, FR-025, US4): the recently opened items as cards, the
 * *Suggested next* card with its reason, an optional *More practice* card, and - with no history - a welcome with the
 * first step and a link to *Repertoire > Beginner*. It takes the place of `mx-browser-list` while the folder is
 * *Continue* and the search is empty. A pure view of `browserState` (Principle V): what to show and suggest is
 * computed by `src/core/progress/suggest.ts`; a card only reports the choice as `browseropenitem` (one action).
 */
export class MxBrowserContinue extends HTMLElement {
  private unsubscribe?: () => void;
  /** `data-ref` -> ref of every card of the last render, so a click never has to parse the key back. */
  private refs = new Map<string, ItemRef>();

  connectedCallback() {
    this.setAttribute('data-testid', 'browser-continue');
    this.setAttribute('aria-label', en.browser.folders.continue);
    this.setAttribute('role', 'region');
    this.addEventListener('click', this.onClick);
    this.unsubscribe = browserState.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
    this.removeEventListener('click', this.onClick);
  }

  private render(): void {
    const { data, view } = browserState.get();
    const shown = showsContinue(view);
    this.hidden = !shown;
    if (!shown) return; // nothing to build while the list is what the musician sees

    const items = buildBrowserItems(data.index, data.files, data.records, DEFAULT_MASTERY_THRESHOLDS, collator.compare);
    const tree = data.index ? buildSectionTree(data.index.sections, data.index.items) : [];
    const recent = continueItems(items, data.records);
    const suggestion = suggestNext(items, data.records, tree);
    const more = morePractice(items, data.records);
    const byRef = new Map(items.map((item) => [itemRefKey(item.ref), item]));
    this.refs = new Map(items.map((item) => [itemRefKey(item.ref), item.ref]));
    const find = (ref: ItemRef): BrowserItem | undefined => byRef.get(itemRefKey(ref));

    const welcome = this.welcomeHtml(suggestion);
    const recentHtml =
      recent.length > 0
        ? recent.map(({ item, lastOpenedAt }) => this.cardHtml(item, this.recentNote(item, lastOpenedAt))).join('')
        : `<p class="continue-empty">${escapeHtml(en.browser.nothingRecent)}</p>`;

    this.innerHTML = `
      ${welcome}
      ${this.suggestedHtml(suggestion, find)}
      ${this.moreHtml(more, find)}
      <div class="continue-recent-section">
        <h3>${escapeHtml(en.browser.recentHeading)}</h3>
        <div class="continue-recent">${recentHtml}</div>
      </div>`;
  }

  private suggestedHtml(suggestion: Suggestion, find: (ref: ItemRef) => BrowserItem | undefined): string {
    if (suggestion.kind === 'none') return '';
    const item = find(suggestion.ref);
    if (item === undefined) return '';
    const reason =
      suggestion.kind === 'continue'
        ? en.browser.suggestReasonContinue
        : suggestion.kind === 'next'
          ? en.browser.suggestReasonNext.replace('{title}', find(suggestion.after)?.title ?? '')
          : en.browser.suggestReasonFirst;
    return `
      <div class="continue-suggested" data-testid="browser-suggested">
        <h3>${escapeHtml(en.browser.suggestedHeading)}</h3>
        ${this.cardHtml(item, reason)}
      </div>`;
  }

  /** US4 #3: with no history, a welcome and a way to Repertoire > Beginner (the first step is the suggested card). */
  private welcomeHtml(suggestion: Suggestion): string {
    if (suggestion.kind !== 'firstSteps') return '';
    const link =
      suggestion.repertoireSectionId === null
        ? ''
        : `<button type="button" class="continue-link" data-section="${escapeHtml(suggestion.repertoireSectionId)}">
             ${escapeHtml(en.browser.welcomeRepertoire)}
           </button>`;
    return `
      <div class="continue-welcome">
        <h3>${escapeHtml(en.browser.welcomeTitle)}</h3>
        <p>${escapeHtml(en.browser.welcomeText)}</p>
        ${link}
      </div>`;
  }

  private moreHtml(ref: ItemRef | null, find: (ref: ItemRef) => BrowserItem | undefined): string {
    const item = ref === null ? undefined : find(ref);
    if (item === undefined) return '';
    return `
      <div class="continue-more">
        <h3>${escapeHtml(en.browser.morePracticeHeading)}</h3>
        ${this.cardHtml(item, en.browser.morePracticeReason)}
      </div>`;
  }

  /** "Best: 96% correct · 90% on time" and "Last played 3 days ago" for a played item, "Opened 2 days ago" for one
   *  that was only opened. */
  private recentNote(item: BrowserItem, lastOpenedAt: string): string {
    const { best, lastPlayedAt } = item.progress;
    if (lastPlayedAt === null) return en.browser.openedAgo.replace('{when}', relativeDate(lastOpenedAt));
    const tempo = best ? resultTempoSuffix(best) : '';
    const bestText = best ? `${en.browser.best}: ${resultFigures(best)}${tempo ? ` ${tempo}` : ''} · ` : '';
    return bestText + en.browser.lastPlayedAgo.replace('{when}', relativeDate(lastPlayedAt));
  }

  private cardHtml(item: BrowserItem, note: string): string {
    return `
      <button type="button" class="continue-card" data-ref="${escapeHtml(itemRefKey(item.ref))}"
        data-status="${item.progress.status}">
        <mx-status-badge status="${item.progress.status}"></mx-status-badge>
        <span class="continue-card-title">${escapeHtml(item.title)}</span>
        ${item.subtitle ? `<span class="continue-card-subtitle">${escapeHtml(item.subtitle)}</span>` : ''}
        <span class="continue-card-note">${escapeHtml(note)}</span>
      </button>`;
  }

  private readonly onClick = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    const card = target?.closest<HTMLElement>('.continue-card');
    if (card?.dataset.ref !== undefined) {
      const ref = this.refs.get(card.dataset.ref);
      if (ref !== undefined) this.dispatchEvent(new CustomEvent('browseropenitem', { detail: { ref }, bubbles: true }));
      return;
    }
    const link = target?.closest<HTMLElement>('.continue-link');
    if (link?.dataset.section !== undefined) {
      const folder = { kind: 'section', id: link.dataset.section } as const;
      browserState.setView({ folder });
      this.dispatchEvent(new CustomEvent('browserviewchange', { detail: { view: { folder } }, bubbles: true }));
    }
  };
}
customElements.define('mx-browser-continue', MxBrowserContinue);
