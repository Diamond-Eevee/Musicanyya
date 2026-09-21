import { en } from '../i18n/en.js';
import { scoreState } from '../state/scoreState.js';

/**
 * The empty-state invitation, and the drop target for the whole Score area (FR-016). It is an overlay inside the
 * Score area: it listens on its parent, so a MusicXML file dropped anywhere over the area is accepted, and it draws
 * its invitation only while no Score is loaded. The open action asks the app to open the file chooser (`openrequest`);
 * the one `mx-open-button` in the bar owns the chooser, so there is never a second file input.
 */
export class MxDropZone extends HTMLElement {
  private area: HTMLElement | null = null;
  private unsubscribe?: () => void;

  connectedCallback() {
    this.innerHTML = `
      <div class="mx-empty-state">
        <p>${en.app.emptyState}</p>
        <p class="mx-drop-hint">${en.open.dropHint}</p>
        <button type="button" class="mx-empty-open">${en.open.button}</button>
      </div>`;
    this.querySelector('.mx-empty-open')?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('openrequest', { bubbles: true }));
    });

    this.area = this.parentElement;
    for (const target of [this, this.area]) {
      target?.addEventListener('dragover', this.onDragOver);
      target?.addEventListener('dragleave', this.onDragLeave);
      target?.addEventListener('drop', this.onDrop);
    }

    this.unsubscribe = scoreState.subscribe(() => this.showInvitation());
    this.showInvitation();
  }

  disconnectedCallback() {
    for (const target of [this, this.area]) {
      target?.removeEventListener('dragover', this.onDragOver);
      target?.removeEventListener('dragleave', this.onDragLeave);
      target?.removeEventListener('drop', this.onDrop);
    }
    this.area = null;
    this.unsubscribe?.();
  }

  private showInvitation(): void {
    const invitation = this.querySelector<HTMLElement>('.mx-empty-state');
    const kind = scoreState.getStatus().kind;
    if (invitation) invitation.hidden = kind === 'loading' || kind === 'loaded';
  }

  /** The parent's listener sees the events this element's own listener already handled; skip those. */
  private alreadyHandled(event: Event): boolean {
    return event.currentTarget !== this && event.target instanceof Node && this.contains(event.target);
  }

  private readonly onDragOver = (event: Event): void => {
    if (this.alreadyHandled(event)) return;
    event.preventDefault();
    this.classList.add('drag-active');
  };

  private readonly onDragLeave = (event: Event): void => {
    if (this.alreadyHandled(event)) return;
    this.classList.remove('drag-active');
  };

  private readonly onDrop = (event: Event): void => {
    if (this.alreadyHandled(event)) return;
    event.preventDefault();
    this.classList.remove('drag-active');
    const file = (event as DragEvent).dataTransfer?.files?.[0] ?? null;
    if (file) this.dispatchEvent(new CustomEvent('fileopen', { detail: { file }, bubbles: true }));
  };
}
customElements.define('mx-drop-zone', MxDropZone);
