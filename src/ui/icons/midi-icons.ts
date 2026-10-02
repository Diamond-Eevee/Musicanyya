/**
 * Icons of the top bar's MIDI control (contracts/top-bar.md section 2). Inline SVG on a 20 x 16 grid, `fill`/`stroke`
 * `currentColor`, decoration only (the control carries the accessible name). One shape per state, so a state is never
 * told apart by colour alone (Constitution VI).
 */
export type LiveSoundIcon = 'locked' | 'loading' | 'failed';

const SPEAKER = '<path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor"/>';

const MARKS: Record<LiveSoundIcon, string> = {
  // speaker + padlock
  locked:
    '<rect x="12" y="8.5" width="6" height="5" rx="1" fill="currentColor"/>' +
    '<path d="M13.2 8.5V7.4a1.8 1.8 0 0 1 3.6 0v1.1" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  // speaker + three dots
  loading:
    '<circle cx="11.5" cy="8" r="1.2" fill="currentColor"/>' +
    '<circle cx="15" cy="8" r="1.2" fill="currentColor"/>' +
    '<circle cx="18.5" cy="8" r="1.2" fill="currentColor"/>',
  // speaker + cross
  failed: '<path d="M12 5l6 6M18 5l-6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
};

export function liveSoundIconSvg(icon: LiveSoundIcon): string {
  return `<svg class="midi-icon midi-icon-${icon}" viewBox="0 0 20 16" width="20" height="16" aria-hidden="true" focusable="false">${SPEAKER}${MARKS[icon]}</svg>`;
}
