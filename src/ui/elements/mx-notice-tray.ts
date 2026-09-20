import { en } from '../i18n/en.js';
import { type Notice, noticeState } from '../state/noticeState.js';
import { escapeHtml } from '../util/escape-html.js';

function formatNotice(notice: Notice): string {
  let text = en.notices[notice.code] ?? notice.code;
  if (notice.element) text += ` (${notice.element})`;
  if (notice.measureLabels.length > 0)
    text += ` — measure${notice.measureLabels.length > 1 ? 's' : ''} ${notice.measureLabels.join(', ')}`;
  if (notice.count > 1) text += ` (x${notice.count})`;
  return text;
}

export class MxNoticeTray extends HTMLElement {
  private unsubscribe?: () => void;

  connectedCallback() {
    this.unsubscribe = noticeState.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  private render() {
    const notices = noticeState.getNotices();
    this.innerHTML = notices
      .map(
        (n) => `
      <div class="notice ${n.severity}">
        ${escapeHtml(formatNotice(n))}
        <button class="dismiss-btn" data-id="${n.id}">Dismiss</button>
      </div>
    `,
      )
      .join('');

    this.querySelectorAll('.dismiss-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.target as HTMLElement).getAttribute('data-id');
        if (id) noticeState.dismiss(id);
      });
    });
  }
}
customElements.define('mx-notice-tray', MxNoticeTray);
