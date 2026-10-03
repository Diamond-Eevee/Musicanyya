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

/** The keyboard states of the control (feature 021 US3, data-model.md section 2): a keyboard with one mark each. */
export type MidiStateIcon =
  | 'keyboard'
  | 'keyboard-check'
  | 'keyboard-cross'
  | 'keyboard-question'
  | 'keyboard-slash'
  | 'keyboard-slash-dashed';

const KEYBOARD_KEYS = '<path d="M5.5 4.5v8M9 4.5v8M12.5 4.5v8" fill="none" stroke="currentColor" stroke-width="0.9"/>';
const KEYBOARD_BODY = (dash: string) =>
  `<rect x="1" y="4.5" width="14.5" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"${dash}/>`;

const KEYBOARD_MARKS: Record<MidiStateIcon, string> = {
  keyboard: '',
  // a tick
  'keyboard-check':
    '<path d="M14 11l2.2 2.2 3.8-4.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  // a cross
  'keyboard-cross':
    '<path d="M15.2 9l4.2 4.2M19.4 9l-4.2 4.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  // a question mark
  'keyboard-question':
    '<path d="M14.8 9.6a2 2 0 1 1 2.9 1.8c-.7.4-1 .7-1 1.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<circle cx="16.7" cy="14.8" r="0.9" fill="currentColor"/>',
  // a slash through the keyboard
  'keyboard-slash':
    '<path d="M2 14.5L18 2.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  // the same slash, over a dashed keyboard
  'keyboard-slash-dashed':
    '<path d="M2 14.5L18 2.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
};

export function keyboardIconSvg(icon: MidiStateIcon): string {
  const dash = icon === 'keyboard-slash-dashed' ? ' stroke-dasharray="2.2 1.6"' : '';
  return `<svg class="midi-icon midi-icon-${icon}" viewBox="0 0 20 16" width="20" height="16" aria-hidden="true" focusable="false">${KEYBOARD_BODY(dash)}${KEYBOARD_KEYS}${KEYBOARD_MARKS[icon]}</svg>`;
}
