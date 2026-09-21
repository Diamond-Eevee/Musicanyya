import { NOTICE_TRAY_MAX } from '../../engine/config.js';
import { en } from '../i18n/en.js';
import { type Notice, noticeState } from '../state/noticeState.js';
import { viewState } from '../state/viewState.js';
import { escapeHtml } from '../util/escape-html.js';

const FAILURE_NOTICES: ReadonlySet<string> = new Set([
  'notMusicXml',
  'timewiseUnsupported',
  'unsupportedEncoding',
  'unsupportedArchive',
  'archiveNoScore',
  'fileTooLarge',
  'fileTooComplex',
  'malformedXml',
  'externalEntityBlocked',
  'noPlayableContent',
  'internal',
  'soundFontMissing',
  'workletLoadFailed',
  'storageUnavailable',
  'playGradeTimeout',
  'playGradeError',
]);

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
    // Switching the layer off hides the notes about a score, never a failure: a file that would not open, a sound or
    // engine that would not start, storage that would not save, a grade that failed (FR-012 vs. silent failure).
    const layerOn = viewState.get().overlays.notices;
    const all = noticeState.getNotices().filter((notice) => layerOn || FAILURE_NOTICES.has(notice.code));
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
