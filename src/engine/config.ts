import packageJson from '../../package.json';

// From the build, so an old stored performance is recognisable (FR-014, contracts/performance-log.md).
export const APP_VERSION: string = packageJson.version;

// Shared with src/core/transport/transport.ts, which cannot import this engine-layer file.
export {
  MAX_FILE_BYTES,
  POSITION_REPORT_BLOCKS,
  TEMPO_PERCENT_DEFAULT,
  TEMPO_PERCENT_MAX,
  TEMPO_PERCENT_MIN,
  TEMPO_PERCENT_STEP,
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

export const RECENT_SCORES_MAX = 10;

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
export const FOLLOW_MARGIN = 0.2; // Middle 60% of viewport means 20% margin top/bottom

// Play Mode storage limits and worker timeout (data-model.md §10)
export const PERFORMANCES_PER_SCORE_MAX = 20; // Attempts kept per Score, oldest dropped (FR-041)
export const PLAY_SETTINGS_MAX = 20; // Scores whose run settings are remembered (FR-040)
export const GRADE_WORKER_TIMEOUT_MS = 5000; // A Grade that never arrives becomes a notice, not a hang

// Notices: how many stack in the corner of the Score at once (feature 004, FR-011); older ones wait behind them.
export const NOTICE_TRAY_MAX = 3;
