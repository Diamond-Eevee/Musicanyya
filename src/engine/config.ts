import packageJson from '../../package.json';

// From the build, so an old stored performance is recognisable (FR-014, contracts/performance-log.md).
export const APP_VERSION: string = packageJson.version;

// Shared with core modules that cannot import this engine-layer file (src/core/transport/transport.ts;
// src/core/browser/query.ts, feature 013, needs BROWSER_SEARCH_MAX_CHARS to cut an overlong search).
export {
  BROWSER_SEARCH_MAX_CHARS,
  MAX_FILE_BYTES,
  POSITION_REPORT_BLOCKS,
  TEMPO_BEAT_DOTS_MAX,
  TEMPO_BPM_DIGITS_MAX,
  TEMPO_BPM_STEP,
  TEMPO_MARK_QPM_MAX,
  TEMPO_MARK_QPM_MIN,
  TEMPO_PERCENT_DEFAULT,
  TEMPO_PERCENT_MAX,
  TEMPO_PERCENT_MIN,
  VOLUME_DEFAULT,
  VOLUME_RAMP_FRAMES,
} from '../core/defaults.js';

// Score size in percent; 100 = fitted to the Score viewport (specs/004-score-first-layout/contracts/score-layout.md)
export const SCORE_SCALE_MIN = 50;
export const SCORE_SCALE_MAX = 200;
export const SCORE_SCALE_DEFAULT = 100;
export const SCORE_SCALE_STEP = 10;

// Which optional overlay layers are drawn until the user chooses otherwise (FR-012; piano keys off by FR-015)
export const OVERLAYS_DEFAULT = {
  cursor: true,
  marks: true,
  advice: true,
  pianoKeys: false,
  notices: true,
} as const;

// The on-screen piano is drawn as a real 88-key keyboard (specs/010-realistic-piano-keyboard/data-model.md section 3)
export const PIANO_KEY_LOW = 21; // A0
export const PIANO_KEY_HIGH = 108; // C8
export const BLACK_KEY_WIDTH_RATIO = 0.58; // black key width / white key width
export const BLACK_KEY_LENGTH_RATIO = 0.64; // black key length / white key length
export const WHITE_KEY_ASPECT = 4; // white key length / width, before the height cap
export const PIANO_KEYS_MAX_HEIGHT_PX = 160; // height cap of the keys, in CSS pixels
export const PIANO_KEYS_MAX_HEIGHT_VH = 20; // height cap of the keys, in % of the window height

// Bounds of the Verovio page requested from a viewport, in Verovio page units (1 unit = 1 CSS px at scale 100)
export const MIN_PAGE_UNITS = 200;
export const MAX_PAGE_UNITS = 10000;

// File constraints (MAX_FILE_BYTES re-exported from core/defaults.js above)
export const MAX_UNCOMPRESSED_BYTES = 256 * 1024 * 1024; // 256 MiB
export const MAX_ZIP_ENTRIES = 1000;

export const MAX_XML_CHARS = 64 * 1024 * 1024; // 64 Mi
export const MAX_ELEMENT_DEPTH = 64;
export const MAX_PARTS = 64;
export const MAX_MEASURES = 10000;

// Audio engine & sync (POSITION_REPORT_BLOCKS, VOLUME_RAMP_FRAMES re-exported from core/defaults.js above)
export const POSITION_HISTORY = 32;

export const DROPOUT_CHECK_MS = 500;
export const DROPOUT_TOLERANCE_MS = 20;

export const LATENCY_SAMPLES = 32;

// Debouncing
export const RELAYOUT_DEBOUNCE_MS = 150;
export const SETTINGS_WRITE_DEBOUNCE_MS = 500;

// Practice settings remembered per Score (contracts/practice-settings.md)
export const PRACTICE_SETTINGS_MAX = 20;

// UI
export const FOLLOW_MARGIN = 0.2; // Grade-mark reveal only (009 FR-023); runs use the look-ahead rule (015)

// Follow view & look-ahead (feature 015-next-system-lookahead, data-model.md section 3)
export const FOLLOW_GLIDE_MS = 400; // Duration of every follow glide, fresh or redirected (FR-007, FR-009, SC-002)
export const FOLLOW_GLIDE_MIN_REDIRECT_MS = 250; // Shortest duration of a redirected glide (FR-009, FR-010)
export const FOLLOW_GLIDE_REDUCED_MS = 0; // Duration when the OS asks for reduced motion (FR-011)
export const LOOKAHEAD_TOP_GAP_PX = 12; // Clear space left above the current system's box at the target (FR-001, FR-014)
export const FOLLOW_TARGET_EPSILON_PX = 1; // Positions closer than this count as equal (FR-002)
export const ENGRAVING_PAGE_MARGIN_TOP = 18; // Top margin in Verovio page units (FR-003)
export const ENGRAVING_PAGE_MARGIN_BOTTOM = 18; // Bottom margin in Verovio page units (FR-003)
export const ENGRAVING_SPACING_BRACE_GROUP = 8; // Minimum 4 staff spaces between staves of one braced instrument (FR-016)
export const SMUFL_TEXT_ASCENT_PCT = 75; // Line box of music-font text above the baseline, % of the em (score-layout 2.1.0 section 5)
export const SMUFL_TEXT_DESCENT_PCT = 25; // Line box of music-font text below the baseline, % of the em (score-layout 2.1.0 section 5)

// Play Mode storage limits and worker timeout (data-model.md §10)
export const PERFORMANCES_PER_SCORE_MAX = 20; // Attempts kept per Score, oldest dropped (FR-041)
export const PLAY_SETTINGS_MAX = 20; // Scores whose run settings are remembered (FR-040)
export const GRADE_WORKER_TIMEOUT_MS = 5000; // A Grade that never arrives becomes a notice, not a hang

// Notices: how many stack in the corner of the Score at once (feature 004, FR-011); older ones wait behind them.
export const NOTICE_TRAY_MAX = 3;

// Score browser & progress (feature 013-score-browser-progress, data-model.md section 11)
export const USER_FILES_BYTES_BUDGET = 100 * 1024 * 1024; // Total *My files* copy budget, least recently opened evicted first (FR-020)
export const UNDO_WINDOW_MS = 8000; // Deferred-commit window for reset/remove, UI timing only (FR-018, FR-022, R-12)
export const BROWSER_ANNOUNCE_DEBOUNCE_MS = 300; // Debounce of the browser's aria-live item-count announcement (FR-028)
export const BROWSER_DBLCLICK_WINDOW_MS = 300; // How long a single click waits for a second one before it selects the row (UI timing only, contracts §2)
// BROWSER_SEARCH_MAX_CHARS re-exported from core/defaults.js above (src/core/browser/query.ts needs it too).

// Modern look, themes & logo (feature 016-modern-look-logo, data-model.md section 5)
export const THEME_STORAGE_KEY = 'musicanyya.theme.v1'; // theme.md 2
export const THEME_CHOICE_DEFAULT = 'auto'; // clarification Q3
export const THEME_AUTO_LIGHT = 'paper'; // clarification Q3
export const THEME_AUTO_DARK = 'night'; // clarification Q3
export const THEME_ACCENT_MIN_DELTA_E = 15; // FR-011, research R-5
export const THEME_CONTROL_TRANSITION_MS = 120; // FR-008 (<= 150), research R-8
export const CHROME_FOCUS_RING_PX = 2; // FR-006
export const BRAND_SMALL_BELOW_PX = 24; // brand.md 1

// Live piano and audio setup (feature 021-live-piano-audio-setup, data-model.md section 6)
export const AUDIO_OUTPUT_FALLBACK_MAX_MS = 2000; // A vanished chosen output falls back to the system default within this (FR-025, R-6)
export const MIDI_STATUS_UPDATE_MAX_MS = 1000; // The top bar shows a MIDI keyboard change within this (FR-019, R-10)
export const AUDIO_TIME_EPSILON_SEC = 0.000001; // Two audio-clock times closer than this are the same instant (a comparison against a click time, not a rounding accident)
export const TRANSPORT_BUTTON_MIN_PX = 28; // Smallest side of a transport button: the captioned Stop button of the 020 build was 27.59 px high (FR-023, R-11)
export const LOCKED_HINT_MS = 8000; // How long the "click to turn the sound on" hint stays (FR-003, R-4)
