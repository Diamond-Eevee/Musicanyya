import type { StrictnessLevel, StrictnessLevelName } from './grade/types.js';
import type { Level } from './library/types.js';

export const BASE_PPQ = 960;
export const MAX_PPQ = 16777216; // 2^24
export const TICK_LIMIT = 2147483648; // 2^31

// Shared with src/core/library/index-model.ts, which cannot import engine/config.ts
export const MAX_FILE_BYTES = 64 * 1024 * 1024; // 64 MiB

// SC-008: the bundled library adds no more than this to the app download. Asserted by
// tests/library/licence.test.ts against the real public/library tree.
export const LIBRARY_BUDGET_BYTES = 10 * 1024 * 1024; // 10 MiB

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
/** Live MIDI messages the worklet queues between two render blocks; more are dropped and counted (001 T057). 256 since
 *  019 T080: on Morning Mood one Practice input sends up to 94 (left hand only, a forte bar: the Orchestra's offs and ons
 *  and the right-hand accompaniment), which must fit twice over. */
export const LIVE_QUEUE_CAPACITY = 256;

export const TEMPO_PERCENT_MIN = 25;
export const TEMPO_PERCENT_MAX = 200;
export const TEMPO_PERCENT_DEFAULT = 100;
export const TEMPO_BPM_STEP = 1; // one press of a tempo-field step control (012 FR-010)
export const TEMPO_MARK_QPM_MIN = 10; // a mark's quarter-notes-per-minute outside this is unusable (012 R-2)
export const TEMPO_MARK_QPM_MAX = 1000;
export const TEMPO_BEAT_DOTS_MAX = 3; // more dots on a <beat-unit> make its mark unusable (012 R-2)
export const TEMPO_BPM_DIGITS_MAX = 4; // longest number the tempo field accepts (012)
export const VOLUME_DEFAULT = 80;
export const METRONOME_LEVEL_DEFAULT = 100; // Metronome level, 0..100; 100 is today's loudness so nothing changes for existing users (019 R-7)
export const ORCHESTRA_LEVEL_DEFAULT = 60; // Orchestra level, 0..100; low on purpose, tuned at the owner's listening check (019 R-7)
export const MIXER_LEVEL_STEP = 5; // One step of a Levels slider (019 R-7)
export const EXPRESSION_CONTROLLER = 11; // MIDI CC11 (expression): the Orchestra level, on top of the Score's own CC7 part volume (019 R-5)
export const ORCHESTRA_SILENT_TOLERANCE_DBFS = -90; // Level 0 counts as silent below this: CC11 = 0 attenuates by 96 dB (019 R-7, SC-002)
export const VOICE_HEADROOM_FRACTION = 0.5; // Peak active voices an Orchestra score may use, as a fraction of the synth's voice cap (019 R-11)
export const GUIDE_PROGRAM = 4; // 0-based GM program of the Guide voice: Electric Piano 1, "Tine Electric Piano" in GeneralUser GS; tuned at the owner's listening check (020 R-5, OD-1)
export const GUIDE_VELOCITY_SCALE = 0.9; // Guide voice velocity = written velocity x this, at least 1; 0.9 puts it level with the piano at Orchestra level 100 (owner request 2026-10-02, 020 R-5, OD-1)
export const GUIDE_QUIETER_MIN_DB = 6; // Test bound: at ORCHESTRA_LEVEL_DEFAULT the Guide voice is at least this far below the piano playing the same notes (020 R-5, SC-002)

// Audio worklet scheduling (R-10, shared with worklet which cannot import engine/config)
export const POSITION_REPORT_BLOCKS = 4;
export const VOLUME_RAMP_FRAMES = 256;
/** Tick-0 controller events (bank, volume, pan, ...) the worklet keeps to apply a schedule's channel setup (009 R-01). */
export const MAX_SETUP_CONTROLLERS = 64;
export const DEFAULT_CHANNEL_VOLUME = 100; // CC7 at tick 0 on every used channel whose part gives no <volume>: the GM / synth reset value (020 R-10)
export const DEFAULT_CHANNEL_PAN = 64; // CC10 at tick 0 on every used channel whose part gives no <pan>: centre (020 R-10)

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
export const PRACTICE_DISC_MAX_LEDGER_LINES = 5; // Ledger lines a red disc may need before it is folded by octaves (008 R-10)
export const PRACTICE_DISC_OTHER_STAFF_LEDGER_LINES = 3; // Ledger lines on the practised staff that make a disc move to the other staff (008 R-08)

// Play Mode (Metronome-paced performance) and Grading rules
export const PLAY_COUNT_IN_MEASURES = 1; // Default count-in length, never less than 1 measure (FR-003)
export const COUNT_IN_MIN_SECONDS = 2; // Whole measures are added until the count-in lasts this long (R-16)
export const COUNT_IN_INCLUDES_ANACRUSIS = true; // A pickup's missing beats are clicked too, so it falls on its own beat (R-16)
export const METRONOME_CHANNEL = 14; // 0-based, dedicated click channel reserved beside PERCUSSION_CHANNEL and LIVE_CHANNEL (R-02)
export const METRONOME_KEY_BEAT = 77; // GM Low Wood Block
export const METRONOME_KEY_DOWNBEAT = 76; // GM High Wood Block, the accent (FR-003)
export const METRONOME_VELOCITY_BEAT = 88;
export const METRONOME_VELOCITY_DOWNBEAT = 110;
/** The Metronome channel's level on the `AudioEngine.setChannelVolume` scale, 0..100 (ports.ts): silent when muted, full otherwise (009 R-02). */
export const METRONOME_VOLUME_MUTED = 0;
export const METRONOME_VOLUME_ON = 100;
/** A time signature outside these is read as 4/4: a file's <beats> and <beat-type> are untrusted, and the click loops step by the beat (009 audit). */
export const METER_BEATS_MAX = 64;
export const METER_BEAT_TYPES: readonly number[] = [1, 2, 4, 8, 16, 32, 64];
/** No measure has more beats than this, so a measure of absurd length still gets a bounded number of run clicks (009 audit). */
export const RUN_CLICKS_PER_PASS_MAX = 256;
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

// Library level criteria (data-model.md §4) - the threshold values `src/core/library/levels.ts`
// checks `ItemFacts` against. Nested caps: Introduction ⊂ Beginner ⊂ Intermediate ⊂ Advanced (feature 011 added
// Introduction; its tempo and bar-count ranges are kept inside Beginner's so the nesting holds).
export const LEVEL_PITCH_SPAN_SEMITONES_MAX: Record<Level, number> = {
  introduction: 36,
  beginner: 36,
  intermediate: 48,
  advanced: 88,
};
export const LEVEL_PITCH_BOUNDS_MIDI: Record<Level, { min: number; max: number }> = {
  introduction: { min: 36, max: 84 },
  beginner: { min: 36, max: 84 },
  intermediate: { min: 28, max: 96 },
  advanced: { min: 21, max: 108 },
};
export const LEVEL_HAND_INDEPENDENCE_FRACTION_MAX: Record<Level, number> = {
  introduction: 0,
  beginner: 0.35,
  intermediate: 1,
  advanced: 1,
};
export const LEVEL_VOICES_PER_STAFF_MAX: Record<Level, number> = {
  introduction: 1,
  beginner: 1,
  intermediate: 2,
  advanced: 4,
};
export const LEVEL_SHORTEST_VALUE_BEATS_MIN: Record<Level, number> = {
  introduction: 1,
  beginner: 0.5,
  intermediate: 0.25,
  advanced: 0.125,
};
export const LEVEL_LONGEST_RUN_MAX: Record<Level, number> = {
  introduction: 4,
  beginner: 4,
  intermediate: 32,
  advanced: Infinity,
};
export const LEVEL_TEMPO_QPM_RANGE: Record<Level, { min: number; max: number }> = {
  introduction: { min: 50, max: 72 },
  beginner: { min: 50, max: 100 },
  intermediate: { min: 40, max: 152 },
  advanced: { min: 30, max: 208 },
};
export const LEVEL_TEMPO_CHANGES_MAX: Record<Level, number> = {
  introduction: 0,
  beginner: 0,
  intermediate: 2,
  advanced: Infinity,
};
export const LEVEL_KEY_FIFTHS_MAX: Record<Level, number> = {
  introduction: 1,
  beginner: 2,
  intermediate: 4,
  advanced: 7,
};
export const LEVEL_KEY_CHANGES_MAX: Record<Level, number> = {
  introduction: 0,
  beginner: 0,
  intermediate: 2,
  advanced: Infinity,
};
export const LEVEL_ACCIDENTALS_PER_16_MEASURES_MAX: Record<Level, number> = {
  introduction: 2,
  beginner: 2,
  intermediate: 12,
  advanced: Infinity,
};
// Empty array = "any metre", the Advanced row of data-model.md §4 criterion 12.
export const LEVEL_METRES: Record<Level, readonly string[]> = {
  introduction: ['4/4', '3/4'],
  beginner: ['4/4', '3/4', '2/4'],
  intermediate: ['4/4', '3/4', '2/4', '6/8', '3/8', '2/2', '12/8'],
  advanced: [],
};
export const LEVEL_METRE_CHANGES_MAX: Record<Level, number> = {
  introduction: 0,
  beginner: 0,
  intermediate: 1,
  advanced: Infinity,
};
export const LEVEL_MEASURES_RANGE: Record<Level, { min: number; max: number }> = {
  introduction: { min: 8, max: 16 },
  beginner: { min: 8, max: 32 },
  intermediate: { min: 16, max: 96 },
  advanced: { min: 0, max: 250 },
};
export const LEVEL_DURATION_SECONDS_MAX: Record<Level, number> = {
  introduction: 60,
  beginner: 90,
  intermediate: 240,
  advanced: 480,
};
// Largest simultaneous interval in one hand (criterion 16). Advanced's "wider only under <arpeggiate>" exception is the
// rolled chord: `maxSpanSemitones` leaves out a chord whose notes all carry <arpeggiate> (`maxArpeggiatedSpanSemitones`
// reports it), and Advanced accepts any such span, lower levels hold it to these limits (feature 019, research R-17).
// Advanced allows an unrolled tenth (16): owner decision OD-3 of feature 019, 2026-10-01 (research R-17 addendum).
export const LEVEL_MAX_INTERVAL_SEMITONES: Record<Level, number> = {
  introduction: 7,
  beginner: 9,
  intermediate: 12,
  advanced: 16,
};
export const LEVEL_MAX_LEAP_SEMITONES: Record<Level, number> = {
  introduction: 12,
  beginner: 12,
  intermediate: 24,
  advanced: Infinity,
};
export const LEVEL_MEAN_DENSITY_MAX: Record<Level, number> = {
  introduction: 1.5,
  beginner: 2.5,
  intermediate: 6,
  advanced: 12,
};
export const LEVEL_PEAK_DENSITY_MAX: Record<Level, number> = {
  introduction: 3,
  beginner: 5,
  intermediate: 12,
  advanced: 24,
};
export const LEVEL_TIE_CHAIN_NOTES_MAX: Record<Level, number> = {
  introduction: 0,
  beginner: 2,
  intermediate: Infinity,
  advanced: Infinity,
};
export const LEVEL_TIE_BARLINES_MAX: Record<Level, number> = {
  introduction: 0,
  beginner: 1,
  intermediate: Infinity,
  advanced: Infinity,
};
export const LEVEL_TUPLETS: Record<Level, 'none' | 'simple' | 'any'> = {
  introduction: 'none',
  beginner: 'none',
  intermediate: 'simple',
  advanced: 'any',
};
export const LEVEL_GRACE_NOTES_PER_4_MEASURES_MAX: Record<Level, number> = {
  introduction: 0,
  beginner: 0,
  intermediate: 1,
  advanced: Infinity,
};
export const LEVEL_ORNAMENTS_PER_4_MEASURES_MAX: Record<Level, number> = {
  introduction: 0,
  beginner: 0,
  intermediate: 1,
  advanced: Infinity,
};
export const LEVEL_REPEAT_KINDS: Record<Level, readonly string[]> = {
  introduction: ['none'],
  beginner: ['none', 'simple'],
  intermediate: ['none', 'simple', 'voltas'],
  advanced: ['none', 'simple', 'voltas', 'jumps'],
};
export const LEVEL_BACKWARD_REPEATS_MAX: Record<Level, number> = {
  introduction: 0,
  beginner: 1,
  intermediate: Infinity,
  advanced: Infinity,
};
export const LEVEL_PEDAL: Record<Level, 'forbidden' | 'allowed'> = {
  introduction: 'forbidden',
  beginner: 'forbidden',
  intermediate: 'allowed',
  advanced: 'allowed',
};
// Exercise variants (feature 011, owner decision D-2 B7): an exercise may span 38 semitones within MIDI 35-85 at
// Introduction and Beginner - IV below I in both hands needs T-19..T+19, and F sharp major sits at the edge.
// Pieces keep the caps above; Intermediate and Advanced already exceed these values.
export const LEVEL_EXERCISE_PITCH_SPAN_SEMITONES_MAX: Partial<Record<Level, number>> = {
  introduction: 38,
  beginner: 38,
};
export const LEVEL_EXERCISE_PITCH_BOUNDS_MIDI: Partial<Record<Level, { min: number; max: number }>> = {
  introduction: { min: 35, max: 85 },
  beginner: { min: 35, max: 85 },
};
// Owner decision D-2 B8 (2026-09-26, asked during implementation): an exercise may leap 19 semitones at Introduction and
// Beginner. Where the hands swap, the right hand goes from the scale's last note (T) to a chord rooted at T+12 whose top is
// T+19; the chords cannot sit lower without colliding with the left-hand scale on the same keys. Pieces keep the caps above.
export const LEVEL_EXERCISE_MAX_LEAP_SEMITONES: Partial<Record<Level, number>> = {
  introduction: 19,
  beginner: 19,
};
/** Key changes a `key-changes` exercise may contain at Introduction and Beginner (D-2 B6). */
export const LEVEL_KEY_CHANGE_EXERCISE_MAX = 1;

// Step order (FR-010, SC-002): the facts `checkStepOrder` compares between consecutive main steps of one folder.
export const STEP_ORDER_FACTS = ['tempoBpm', 'notesPerBeat', 'handIndependenceFraction', 'chordChangesPerBar'] as const;

// Criterion 27 - identical at every level: one part, a grand staff.
export const LEVEL_REQUIRED_PARTS = 1;
export const LEVEL_REQUIRED_STAVES = 2;

// Score browser & progress (feature 013-score-browser-progress, data-model.md section 11)
export const PROGRESS_FORMAT_VERSION = 1; // ProgressRecord.format / UserFileEntry.format (FR-030)
export const PROGRESS_RESULTS_MAX = 20; // ProgressRecord.results kept per Score (FR-015, US2 #5); >= PERFORMANCES_PER_SCORE_MAX
export const MASTERY_NOTES_CORRECT_MIN_PERCENT = 90; // *Mastered* needs notes correct at or above this (FR-024)
export const MASTERY_NOTES_ON_TIME_MIN_PERCENT = 80; // *Mastered* needs played notes on time at or above this (FR-024)
export const MASTERY_TEMPO_PERCENT_MIN = 100; // *Mastered* needs the run's tempo factor at or above this (FR-024)
export const MASTERY_MIN_STRICTNESS: StrictnessLevelName = 'beginner'; // lowest strictness that can master (FR-024)
export const MASTERY_MAX_EXTRA_PERCENT: number | null = 10; // OD-2: extra notes at most this % of notes total, or null to disable (FR-024)
export const CONTINUE_ITEMS_MAX = 8; // Recent items shown in *Continue* (FR-025, US4 #1)
export const MORE_PRACTICE_AFTER_RUNS = 3; // Whole complete runs without *Mastered* before *More practice* is offered (FR-025)
export const USER_FILE_VERSIONS_MAX = 10; // Earlier content hashes kept per *My files* entry (FR-021)
// Shared with src/engine/config.ts (re-exported there): src/core/browser/query.ts (pure) cuts an overlong search
// itself, so this cannot live only in the engine layer (data-model.md section 11 corrected while implementing T014).
export const BROWSER_SEARCH_MAX_CHARS = 200; // Browser search text is cut to this length (FR-026)
export const BROWSER_EXPANDED_MAX = 512; // Most open-folder ids kept from a stored browser view (018 R-3)

// Melody over chords (feature 014, data-model.md §4): the Difficulty ladder the melody rule check verifies a
// rewritten Learning item's right-hand melody against, on top of the existing LEVEL_* criteria above.
export interface MelodyLadderRow {
  /** Shortest written value, in quarter-note beats (0.5 = an eighth note). */
  shortestValueBeats: number;
  /** Widest span the melody may cover within one section, in semitones. */
  rangeSemitones: number;
  /** Widest leap (consecutive melody notes), in scale steps; 0 = a repeated note is never a leap. */
  maxLeapSteps: number;
  /** Hand-position shifts allowed across the whole item. */
  shiftsMax: number;
  /** Whether a shift may only come at a section start (or after a rest), never in the middle of a section. */
  shiftsAtSectionStartOnly: boolean;
  /** Whether a thumb-under / finger-over crossing counts as a shift (true where the hand stays in one position). */
  crossingIsShift: boolean;
  /** Whether dotted values may be written. */
  dottedValues: boolean;
  /** Whether a melody eighth must stand in a pair on the beat and never together with a left-hand eighth. */
  eighthsInPairs: boolean;
  /** Where a non-chord tone may sound (never on the downbeat): in the bar's second half; on a weak beat or in the
   *  second half; anywhere after the downbeat (weak beats and off-beat eighths - the shortest value is an eighth). */
  nctPlacement: 'second-half-of-bar' | 'weak-beats' | 'weak-beats-and-off-beat-eighths';
  /** Longest run of non-chord tones in one direction (passing or neighbour tones). */
  nctRun: number;
  /** Left-hand chord changes allowed per bar (a house rule, research R7; `Infinity` = no extra limit). */
  lhAttacksPerBar: number;
  /** Whether melody-against-bass parallel octaves on consecutive chord starts are allowed. */
  parallelOctaves: boolean;
}
export const MELODY_LADDER: Record<Level, MelodyLadderRow> = {
  introduction: {
    // Amended 2026-09-28 after the owner's listening check (feature 014 T076, research R11): like the key step.
    shortestValueBeats: 1,
    rangeSemitones: 12,
    maxLeapSteps: 1,
    shiftsMax: 1, // one lift, at a section start (T068); thumb-under / finger-over are not shifts
    shiftsAtSectionStartOnly: true,
    crossingIsShift: false,
    dottedValues: false,
    eighthsInPairs: false,
    nctPlacement: 'weak-beats',
    nctRun: 2,
    lhAttacksPerBar: 1,
    parallelOctaves: true,
  },
  beginner: {
    shortestValueBeats: 1,
    rangeSemitones: 12,
    maxLeapSteps: 2,
    shiftsMax: 2,
    shiftsAtSectionStartOnly: false,
    crossingIsShift: false,
    dottedValues: false,
    eighthsInPairs: false,
    nctPlacement: 'weak-beats',
    nctRun: 2,
    lhAttacksPerBar: 2,
    parallelOctaves: true,
  },
  intermediate: {
    shortestValueBeats: 0.5,
    rangeSemitones: 12,
    maxLeapSteps: 4,
    shiftsMax: Infinity,
    shiftsAtSectionStartOnly: false,
    crossingIsShift: false,
    dottedValues: false,
    eighthsInPairs: true,
    nctPlacement: 'weak-beats-and-off-beat-eighths',
    nctRun: 2,
    lhAttacksPerBar: Infinity,
    parallelOctaves: false,
  },
  advanced: {
    shortestValueBeats: 0.5,
    rangeSemitones: 16,
    maxLeapSteps: 7,
    shiftsMax: Infinity,
    shiftsAtSectionStartOnly: false,
    crossingIsShift: false,
    dottedValues: true,
    eighthsInPairs: false,
    nctPlacement: 'weak-beats-and-off-beat-eighths',
    nctRun: 2,
    lhAttacksPerBar: Infinity,
    parallelOctaves: false,
  },
};
// Melody register (data-model §4 note): C4-A5 at every level except advanced, which reaches C6.
export const MELODY_REGISTER_MIDI: Record<Level, { min: number; max: number }> = {
  introduction: { min: 60, max: 81 }, // C4-A5
  beginner: { min: 60, max: 81 },
  intermediate: { min: 60, max: 81 },
  advanced: { min: 60, max: 84 }, // C4-C6
};
export const MELODY_MIN_CLEARANCE_SEMITONES = 3; // the melody's lowest note above the left hand's highest, at every instant
