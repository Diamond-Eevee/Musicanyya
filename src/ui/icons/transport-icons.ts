/**
 * Icons of the transport buttons (feature 021 US4, contracts/top-bar.md section 5). Own drawings, inline SVG on a
 * 16 x 16 grid, `fill="currentColor"` so every theme colours them, decoration only: the button keeps its `aria-label`
 * (the old word) and gains a `title`. `data-icon` names the drawing, for the tests and for a quick look in the inspector.
 */
export type TransportIcon = 'play' | 'pause' | 'stop' | 'skip-back' | 'skip-forward';

const SHAPES: Record<TransportIcon, string> = {
  // a triangle pointing right
  play: '<path d="M4.5 2.5v11l8.5-5.5z"/>',
  // two bars
  pause: '<rect x="3.5" y="2.5" width="3" height="11" rx="0.7"/><rect x="9.5" y="2.5" width="3" height="11" rx="0.7"/>',
  // a square
  stop: '<rect x="3" y="3" width="10" height="10" rx="1"/>',
  // a bar and a triangle pointing left
  'skip-back': '<rect x="2.5" y="2.5" width="2" height="11" rx="0.6"/><path d="M13.5 2.5v11L5.8 8z"/>',
  // a triangle pointing right and a bar
  'skip-forward': '<path d="M2.5 2.5v11L10.2 8z"/><rect x="11.5" y="2.5" width="2" height="11" rx="0.6"/>',
};

export function transportIconSvg(icon: TransportIcon): string {
  return `<svg class="transport-icon" data-icon="${icon}" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true" focusable="false">${SHAPES[icon]}</svg>`;
}
