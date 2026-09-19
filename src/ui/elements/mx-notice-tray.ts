import { noticeState } from '../state/noticeState.js';

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
        ${n.code} x ${n.count}
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
