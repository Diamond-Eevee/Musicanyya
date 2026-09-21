import { NOTICE_TRAY_MAX } from '../../engine/config.js';
import { en } from '../i18n/en.js';
import { type Notice, noticeState } from '../state/noticeState.js';
import { viewState } from '../state/viewState.js';
import { escapeHtml } from '../util/escape-html.js';

function formatNotice(notice: Notice): string {
  let text = en.notices[notice.code] ?? notice.code;
  if (notice.element) text += ` (${notice.element})`;
  if (notice.measureLabels.length > 0)
    text += ` — measure${notice.measureLabels.length > 1 ? 's' : ''} ${notice.measureLabels.join(', ')}`;
  if (notice.count > 1) text += ` (x${notice.count})`;
  return text;
}

/**
 * The one bounded, non-modal corner of the Score where notices appear (FR-011): the newest few stack here, older
 * ones wait behind them and come forward as these are dismissed, and nothing here ever takes keyboard focus. The
 * notices layer can be switched off (FR-012); that only hides them, they are kept.
 */
export class MxNoticeTray extends HTMLElement {
  private unsubscribe?: () => void;
  private unsubscribeView?: () => void;

  connectedCallback() {
    this.unsubscribe = noticeState.subscribe(() => this.render());
    this.unsubscribeView = viewState.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
    this.unsubscribeView?.();
  }

  private render() {
    const all = viewState.get().overlays.notices ? noticeState.getNotices() : [];
    const shown = all.slice(-NOTICE_TRAY_MAX);
    const waiting = all.length - shown.length;

    this.innerHTML =
      shown
        .map(
          (n) => `
      <div class="notice ${n.severity}">
        ${escapeHtml(formatNotice(n))}
        <button class="dismiss-btn" data-id="${n.id}">Dismiss</button>
      </div>
    `,
        )
        .join('') +
      (waiting > 0 ? `<div class="notice-more">${en.tray.more.replace('{n}', String(waiting))}</div>` : '');

    this.querySelectorAll('.dismiss-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.target as HTMLElement).getAttribute('data-id');
        if (id) noticeState.dismiss(id);
      });
    });
  }
}
customElements.define('mx-notice-tray', MxNoticeTray);
