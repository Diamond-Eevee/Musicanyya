export const TEMPO_PERCENT_MIN = 25;
export const TEMPO_PERCENT_MAX = 200;
export const TEMPO_PERCENT_STEP = 5;
export const TEMPO_PERCENT_DEFAULT = 100;

export const VOLUME_DEFAULT = 80;

export const ZOOM_MIN = 50;
export const ZOOM_MAX = 200;
export const ZOOM_DEFAULT = 100;
export const ZOOM_STEP = 10;

export const RECENT_SCORES_MAX = 10;

// File constraints
export const MAX_FILE_BYTES = 64 * 1024 * 1024; // 64 MiB
export const MAX_UNCOMPRESSED_BYTES = 256 * 1024 * 1024; // 256 MiB
export const MAX_ZIP_ENTRIES = 1000;

export const MAX_XML_CHARS = 64 * 1024 * 1024; // 64 Mi
export const MAX_ELEMENT_DEPTH = 64;
export const MAX_PARTS = 64;
export const MAX_MEASURES = 10000;

// Audio engine & sync
export const POSITION_REPORT_BLOCKS = 4;
export const VOLUME_RAMP_FRAMES = 256;
export const POSITION_HISTORY = 32;

export const DROPOUT_CHECK_MS = 500;
export const DROPOUT_TOLERANCE_MS = 20;

export const LATENCY_SAMPLES = 32;

// Debouncing
export const RELAYOUT_DEBOUNCE_MS = 150;
export const SETTINGS_WRITE_DEBOUNCE_MS = 500;

// UI
export const FOLLOW_MARGIN = 0.2; // Middle 60% of viewport means 20% margin top/bottom
