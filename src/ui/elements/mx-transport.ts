export class MxTransport extends HTMLElement {
  connectedCallback() {
    throw new Error('Not implemented');
  }
}
customElements.define('mx-transport', MxTransport);
