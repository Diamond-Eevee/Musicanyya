import { en } from '../i18n/en.js';

export class MxDropZone extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `<div class="mx-drop-zone">${en.open.dropHint}</div>`;

    this.addEventListener('dragover', (event) => {
      event.preventDefault();
      this.classList.add('drag-active');
    });
    this.addEventListener('dragleave', () => this.classList.remove('drag-active'));
    this.addEventListener('drop', (event) => {
      event.preventDefault();
      this.classList.remove('drag-active');
      const dragEvent = event as DragEvent;
      const file = dragEvent.dataTransfer?.files?.[0] ?? null;
      if (file) this.dispatchEvent(new CustomEvent('fileopen', { detail: { file }, bubbles: true }));
    });
  }
}
customElements.define('mx-drop-zone', MxDropZone);
