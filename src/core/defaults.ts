import type { StrictnessLevel, StrictnessLevelName } from './grade/types.js';

export const BASE_PPQ = 960;
export const MAX_PPQ = 16777216; // 2^24
export const TICK_LIMIT = 2147483648; // 2^31

// Shared with src/core/library/index-model.ts, which cannot import engine/config.ts
export const MAX_FILE_BYTES = 64 * 1024 * 1024; // 64 MiB

export const DEFAULT_TEMPO_QPM = 100;

// Grace note timing
export const GRACE_NOTE_TICKS = (ppq: number) => Math.floor(ppq / 8);
export const GRACE_MAX_STEAL_RATIO = 0.5;
export const GRACE_MIN_REMAINING_TICKS = (ppq: number) => Math.floor(ppq / 16);

// Timeline unrolling
export const MAX_REPEAT_DEPTH = 4;
export const UNROLL_GUARD_FACTOR = 10;
export const UNROLL_HARD_CAP = 20000;
export const INFER_JUMPS_FROM_TEXT = true;

// Dynamics
export const DYNAMIC_VELOCITY: Record<string, number> = {
  ppp: 20,
  pp: 36,
  p: 49,
  mp: 64,
  mf: 76,
  f: 88,
  ff: 104,
  fff: 124,
};
export const DEFAULT_VELOCITY = 80;
export const SFORZANDO_BOOST = 24;
export const ACCENT_BOOST = 12;

export const WEDGE_TARGET_WINDOW_TICKS = (ppq: number) => ppq;
export const WEDGE_DEFAULT_DELTA = 16;

export const VELOCITY_MIN = 1;
export const VELOCITY_MAX = 127;

// Channels
export const PERCUSSION_CHANNEL = 9; // 0-based
export const LIVE_CHANNEL = 15; // 0-based

export const LIVE_VELOCITY_DEFAULT = 80; // or from key velocity

export const TEMPO_PERCENT_MIN = 25;
export const TEMPO_PERCENT_MAX = 200;
export const TEMPO_PERCENT_STEP = 5;
export const TEMPO_PERCENT_DEFAULT = 100;
export const VOLUME_DEFAULT = 80;

// Audio worklet scheduling (R-10, shared with worklet which cannot import engine/config)
export const POSITION_REPORT_BLOCKS = 4;
export const VOLUME_RAMP_FRAMES = 256;

// Dropout detection and diagnostics (R-10 "Dropouts")
export const DROPOUT_DRIFT_THRESHOLD_SECONDS = 0.05;
export const DIAGNOSTICS_REPORT_WINDOW_MS = 1000;

// Practice Mode (Wait for Input) rules
export const PRACTICE_HAND_ATTRIBUTION = 'voice-home-staff'; // How a note's hand is decided
export const PRACTICE_CHORD_REQUIRE_SIMULTANEOUS = true; // All required keys must be held together
export const PRACTICE_REQUIRE_GRACE_NOTES = false; // Grace notes are accepted, never waited for
export const PRACTICE_EXPECT_INVISIBLE_NOTES = false; // Hidden / playback-only notes are never expected
export const PRACTICE_EXPECT_UNPITCHED = false; // Percussion and unpitched notes are never expected
export const PRACTICE_LOOP_OCCURRENCE = 'current-pass'; // Which occurrence a range or start measure resolves to
export const PRACTICE_PART_PRESELECTION = 'first-keyboard-like'; // Which part is preselected in a multi-part Score
export const PRACTICE_HELP_AFTER_WRONG_ATTEMPTS = 3; // Wrong attempts before help appears by itself
export const PRACTICE_RELEASE_OF_SUSTAINED_NOTE_BLOCKS = false; // Letting a long note go early never blocks

// Play Mode (Metronome-paced performance) and Grading rules
export const PLAY_COUNT_IN_MEASURES = 1; // Default count-in length, never less than 1 measure (FR-003)
export const COUNT_IN_MIN_SECONDS = 2; // Whole measures are added until the count-in lasts this long (R-16)
export const COUNT_IN_INCLUDES_ANACRUSIS = true; // A pickup's missing beats are clicked too, so it falls on its own beat (R-16)
export const METRONOME_CHANNEL = 14; // 0-based, dedicated click channel reserved beside PERCUSSION_CHANNEL and LIVE_CHANNEL (R-02)
export const METRONOME_KEY_BEAT = 77; // GM Low Wood Block
export const METRONOME_KEY_DOWNBEAT = 76; // GM High Wood Block, the accent (FR-003)
export const METRONOME_VELOCITY_BEAT = 88;
export const METRONOME_VELOCITY_DOWNBEAT = 110;
export const PLAY_STRICTNESS_DEFAULT: StrictnessLevelName = 'beginner'; // The most forgiving level (FR-039)
export const PLAY_BEAT_UNIT_SOURCE = 'metronome-mark-then-time'; // What "a beat" means for the windows; compound meters take the dotted note
export const PLAY_ARPEGGIO_SPREAD_BEATS = 0.5; // Spread allowed for a chord the Score writes as arpeggiated, in place of the chord spread (D-2, FR-022)
export const ORNAMENT_NEIGHBOUR_STEPS = 1; // Scale steps each way around an ornamented note whose presses are played-along (D-1, FR-024)
export const PLAY_NEIGHBOUR_GAP_FRACTION = 0.5; // Claim windows meet at the midpoint between onsets and never reach a neighbour (SC-014)
export const PLAY_WINDOW_ABSOLUTE_FLOOR_MS = 20; // Below this a resolved claim window is timingNotResolvable, never raised (section 6)
export const PLAY_RETRIGGER_DEBOUNCE_MS = 15; // A note-off/note-on of one pitch closer than this is key chatter, not a repeated note (R-07)
export const CALIBRATION_BEATS = 16; // Taps taken by the Latency calibration (R-05)
export const CALIBRATION_TEMPO_QPM = 80; // Tempo the calibration clicks at
export const CALIBRATION_MAX_SPREAD_MS = 60; // Wider than this and the calibration is rejected (R-05)

// data-model.md §6 - the three window sets (FR-020, FR-039). Clamp-inertness invariant (SC-014) is asserted in
// tests/core/grade/windows.test.ts: floorMs <= beats*375 and capMs >= beats*1000 for every window here.
export const PLAY_STRICTNESS_LEVELS: Record<StrictnessLevelName, StrictnessLevel> = {
  beginner: {
    onTimeEarly: { beats: 1 / 6, floorMs: 60, capMs: 180 },
    onTimeLate: { beats: 1 / 6, floorMs: 60, capMs: 180 },
    claim: { beats: 1 / 2, floorMs: 150, capMs: 500 },
    chordSpread: { beats: 1 / 12, floorMs: 30, capMs: 90 },
    arpeggioSpread: { beats: PLAY_ARPEGGIO_SPREAD_BEATS, floorMs: 180, capMs: 1000 },
  },
  standard: {
    onTimeEarly: { beats: 1 / 8, floorMs: 35, capMs: 130 },
    onTimeLate: { beats: 1 / 8, floorMs: 35, capMs: 130 },
    claim: { beats: 1 / 3, floorMs: 110, capMs: 340 },
    chordSpread: { beats: 1 / 16, floorMs: 20, capMs: 65 },
    arpeggioSpread: { beats: PLAY_ARPEGGIO_SPREAD_BEATS, floorMs: 180, capMs: 1000 },
  },
  strict: {
    onTimeEarly: { beats: 1 / 16, floorMs: 20, capMs: 70 },
    onTimeLate: { beats: 1 / 16, floorMs: 20, capMs: 70 },
    claim: { beats: 1 / 4, floorMs: 80, capMs: 250 },
    chordSpread: { beats: 1 / 24, floorMs: 15, capMs: 45 },
    arpeggioSpread: { beats: 1 / 3, floorMs: 120, capMs: 700 },
  },
};
