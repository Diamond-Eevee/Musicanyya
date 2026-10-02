import { METRONOME_LEVEL_DEFAULT, ORCHESTRA_LEVEL_DEFAULT } from '../../core/defaults.js';
import type { LatencyProfile } from '../../core/grade/types.js';
import type { HandSelection } from '../../core/practice/types.js';
import {
  OVERLAYS_DEFAULT,
  PRACTICE_SETTINGS_MAX,
  SCORE_SCALE_DEFAULT,
  SCORE_SCALE_MAX,
  SCORE_SCALE_MIN,
  SCORE_SCALE_STEP,
  SETTINGS_WRITE_DEBOUNCE_MS,
  VOLUME_DEFAULT,
} from '../config.js';
import type { OverlayFlags, PracticeSettings, SettingsStore, UserSettings } from '../ports.js';

export const SETTINGS_STORAGE_KEY = 'musicanyya.settings.v1';
export const PRACTICE_STORAGE_KEY = 'musicanyya.practice.v1';
export const LATENCY_STORAGE_KEY = 'musicanyya.latency.v1';

const SCORE_ID_PATTERN = /^[0-9a-f]{64}$/;
const HAND_PRESETS: readonly string[] = ['both', 'right', 'left', 'custom'];

const BUILT_IN_PRACTICE: PracticeSettings = { selection: null, loop: null, accompaniment: true, help: true };
const BUILT_IN_PLAY: import('../../core/play/types.js').RunSettings = {
  range: null,
  tempoPercent: 100,
  selection: { preset: 'both', partIndex: 0, staves: [1, 2] },
  strictness: 'beginner', // PLAY_STRICTNESS_DEFAULT
  countInMeasures: 1, // PLAY_COUNT_IN_MEASURES
  metronomeMuted: false,
  accompaniment: true,
};
type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInt(value: unknown, min: number, max: number, step = 1): value is number {
  return (
    typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max && (value - min) % step === 0
  );
}

function isIndex(value: unknown, min: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min;
}

/** Every overlay switch is validated on its own; a missing or invalid one takes its default (view-settings.md). */
function validOverlays(raw: unknown): OverlayFlags {
  const source = isObject(raw) ? raw : {};
  const flag = (name: keyof OverlayFlags): boolean => {
    const value = source[name];
    return typeof value === 'boolean' ? value : OVERLAYS_DEFAULT[name];
  };
  return {
    cursor: flag('cursor'),
    marks: flag('marks'),
    advice: flag('advice'),
    pianoKeys: flag('pianoKeys'),
    notices: flag('notices'),
  };
}

/**
 * Reads format versions 3 and 2, and version 1 silently (contracts/view-settings.md section 3): a v1 file has no
 * `scale`, but its `zoomPercent` means the same thing, so a returning user keeps their size; a file before version 3
 * has no levels, so both take their defaults (019 mixer-levels.md section 2). It always yields version 3.
 */
function validate(raw: Record<string, unknown>): UserSettings {
  const storedScale = 'scale' in raw ? raw.scale : raw.zoomPercent;
  return {
    version: 3,
    volume: isInt(raw.volume, 0, 100) ? raw.volume : VOLUME_DEFAULT,
    // tempoPercent (2.1.0, feature 012 FR-015): deprecated, ignored when present.
    scale: isInt(storedScale, SCORE_SCALE_MIN, SCORE_SCALE_MAX, SCORE_SCALE_STEP) ? storedScale : SCORE_SCALE_DEFAULT,
    follow: typeof raw.follow === 'boolean' ? raw.follow : true,
    overlays: validOverlays(raw.overlays),
    metronomeLevel: isInt(raw.metronomeLevel, 0, 100) ? raw.metronomeLevel : METRONOME_LEVEL_DEFAULT,
    orchestraLevel: isInt(raw.orchestraLevel, 0, 100) ? raw.orchestraLevel : ORCHESTRA_LEVEL_DEFAULT,
  };
}

function validSelection(raw: unknown): HandSelection | null {
  if (!isObject(raw)) return null;
  const { preset, partIndex, staves } = raw;
  if (typeof preset !== 'string' || !HAND_PRESETS.includes(preset)) return null;
  if (!isIndex(partIndex, 0)) return null;
  if (!Array.isArray(staves) || staves.length === 0 || !staves.every((staff) => isIndex(staff, 1))) return null;
  return {
    preset: preset as HandSelection['preset'],
    partIndex,
    staves: Array.from(new Set(staves as number[])).sort((a, b) => a - b),
  };
}

function validLoop(raw: unknown): PracticeSettings['loop'] {
  if (!isObject(raw)) return null;
  const { fromPassIndex, toPassIndex } = raw;
  return isIndex(fromPassIndex, 0) && isIndex(toPassIndex, 0) ? { fromPassIndex, toPassIndex } : null;
}

/** Every field is validated on its own and falls back to its default (contracts/practice-settings.md). */
function validPractice(raw: JsonObject): PracticeSettings {
  return {
    selection: validSelection(raw.selection),
    loop: validLoop(raw.loop),
    accompaniment: typeof raw.accompaniment === 'boolean' ? raw.accompaniment : BUILT_IN_PRACTICE.accompaniment,
    help: typeof raw.help === 'boolean' ? raw.help : BUILT_IN_PRACTICE.help,
  };
}

function validRange(raw: unknown): import('../../core/practice/types.js').LoopRange | null {
  if (!isObject(raw)) return null;
  const { fromMeasureIndex, toMeasureIndex } = raw;
  return isIndex(fromMeasureIndex, 0) && isIndex(toMeasureIndex, 0) ? { fromMeasureIndex, toMeasureIndex } : null;
}

/** Any finite number in [min, max] (feature 012 FR-037: no longer an integer multiple of 5). */
function isFiniteInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function validPlay(raw: JsonObject): import('../../core/play/types.js').RunSettings {
  const strictnessLevels = ['beginner', 'standard', 'strict'];
  return {
    range: validRange(raw.range),
    tempoPercent: isFiniteInRange(raw.tempoPercent, 25, 200) ? raw.tempoPercent : BUILT_IN_PLAY.tempoPercent,
    selection: validSelection(raw.selection) ?? BUILT_IN_PLAY.selection,
    strictness: strictnessLevels.includes(raw.strictness as string)
      ? (raw.strictness as import('../../core/grade/types.js').StrictnessLevelName)
      : BUILT_IN_PLAY.strictness,
    countInMeasures: isIndex(raw.countInMeasures, 1) ? raw.countInMeasures : BUILT_IN_PLAY.countInMeasures,
    metronomeMuted: typeof raw.metronomeMuted === 'boolean' ? raw.metronomeMuted : BUILT_IN_PLAY.metronomeMuted,
    accompaniment: typeof raw.accompaniment === 'boolean' ? raw.accompaniment : BUILT_IN_PLAY.accompaniment,
  };
}

/** The fields a record stores; "selection" is left out when there is none, because the schema wants an object. */
function practiceFields(settings: PracticeSettings): JsonObject {
  const fields: JsonObject = { loop: settings.loop, accompaniment: settings.accompaniment, help: settings.help };
  if (settings.selection) {
    fields.selection = {
      preset: settings.selection.preset,
      partIndex: settings.selection.partIndex,
      staves: [...settings.selection.staves],
    };
  }
  return fields;
}

function playFields(settings: import('../../core/play/types.js').RunSettings): JsonObject {
  return {
    range: settings.range,
    tempoPercent: settings.tempoPercent,
    selection: {
      preset: settings.selection.preset,
      partIndex: settings.selection.partIndex,
      staves: [...settings.selection.staves],
    },
    strictness: settings.strictness,
    countInMeasures: settings.countInMeasures,
    metronomeMuted: settings.metronomeMuted,
    accompaniment: settings.accompaniment,
  };
}

export class LocalSettingsStore implements SettingsStore {
  private raw: Record<string, unknown> = {};
  private writeTimer: ReturnType<typeof setTimeout> | null = null;
  private pending: UserSettings | null = null;
  private errorReported = false;
  /** The practice file as last saved this session. It stays authoritative until the page is reloaded, so blocked or
   *  full storage still lets the settings work in memory. Null until the first save. */
  private practiceFile: JsonObject | null = null;
  private practiceTimer: ReturnType<typeof setTimeout> | null = null;

  private playFile: JsonObject | null = null;
  private playTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly onError?: (message: string) => void) {}

  load(): UserSettings {
    try {
      const item = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (item) {
        const parsed: unknown = JSON.parse(item);
        if (isObject(parsed)) this.raw = parsed;
      }
    } catch {
      this.raw = {};
    }
    return validate(this.raw);
  }

  save(settings: UserSettings): void {
    this.pending = settings;
    if (this.writeTimer !== null) clearTimeout(this.writeTimer);
    this.writeTimer = setTimeout(() => this.flush(), SETTINGS_WRITE_DEBOUNCE_MS);
  }

  /** Every debounced write that has not run yet, now (017 T039): a reload or a closed tab within
   *  `SETTINGS_WRITE_DEBOUNCE_MS` of a change used to lose it. */
  flushPending(): void {
    if (this.writeTimer !== null) {
      clearTimeout(this.writeTimer);
      this.flush();
    }
    if (this.practiceTimer !== null) {
      clearTimeout(this.practiceTimer);
      this.flushPractice();
    }
    if (this.playTimer !== null) {
      clearTimeout(this.playTimer);
      this.flushPlay();
    }
  }

  private flush(): void {
    this.writeTimer = null;
    if (!this.pending) return;
    // Unknown fields are kept; v1's `zoomPercent` is dropped now that its value lives in `scale`, and
    // `tempoPercent` is dropped too (2.1.0, feature 012 FR-015: no longer written).
    const combined: Record<string, unknown> = { ...this.raw, ...this.pending };
    const { zoomPercent: _superseded, tempoPercent: _deprecated, ...merged } = combined;
    this.raw = merged;
    this.pending = null;
    this.write(SETTINGS_STORAGE_KEY, this.raw);
  }

  /** The stored calibration file (audio-setup.md section 4): the `{ version: 1, profile, outputDeviceId? }` wrapper this
   *  build writes, or the bare profile builds 003-020 wrote. Anything else is no calibration. */
  private readLatencyFile(): { profile: LatencyProfile; outputDeviceId: string | null } | null {
    try {
      const item = localStorage.getItem(LATENCY_STORAGE_KEY);
      if (!item) return null;
      const parsed: unknown = JSON.parse(item);
      if (!isObject(parsed)) return null;
      const wrapped = 'profile' in parsed;
      if (wrapped && parsed.version !== 1) return null;
      const profile: unknown = wrapped ? parsed.profile : parsed;
      if (
        !isObject(profile) ||
        typeof profile.inputLatencyMs !== 'number' ||
        !Number.isFinite(profile.inputLatencyMs)
      ) {
        return null;
      }
      return {
        profile: {
          outputLatencyMs: typeof profile.outputLatencyMs === 'number' ? profile.outputLatencyMs : 0,
          inputLatencyMs: profile.inputLatencyMs,
          source: 'measured',
          measuredAt: typeof profile.measuredAt === 'string' ? profile.measuredAt : null,
        },
        outputDeviceId: wrapped && typeof parsed.outputDeviceId === 'string' ? parsed.outputDeviceId : null,
      };
    } catch {
      return null;
    }
  }

  loadLatencyProfile(): LatencyProfile {
    return (
      this.readLatencyFile()?.profile ?? { outputLatencyMs: 0, inputLatencyMs: 0, source: 'assumed', measuredAt: null }
    );
  }

  saveLatencyProfile(profile: LatencyProfile, outputDeviceId?: string): void {
    this.write(LATENCY_STORAGE_KEY, {
      version: 1,
      profile,
      ...(outputDeviceId === undefined ? {} : { outputDeviceId }),
    });
  }

  loadLatencyOutputDeviceId(): string | null {
    return this.readLatencyFile()?.outputDeviceId ?? null;
  }

  clearLatencyProfile(): void {
    try {
      localStorage.removeItem(LATENCY_STORAGE_KEY);
    } catch {
      // storage blocked: nothing was stored that could be cleared
    }
  }

  loadAudioOutput(): string | null {
    return null; // feature 021 T058
  }

  saveAudioOutput(_deviceId: string | null): void {
    // feature 021 T058
  }

  loadPractice(scoreId: string | null): PracticeSettings {
    const file = this.readPracticeFile();
    const byScore = isObject(file.byScore) ? file.byScore : {};
    const own = scoreId !== null && SCORE_ID_PATTERN.test(scoreId) ? byScore[scoreId] : undefined;
    if (isObject(own)) return validPractice(own);

    // Never practised: the last-used choices apply, but a loop belongs to one Score and never travels.
    const defaults = isObject(file.defaults) ? validPractice(file.defaults) : BUILT_IN_PRACTICE;
    return { ...defaults, loop: null };
  }

  savePractice(scoreId: string | null, settings: PracticeSettings): void {
    if (scoreId === null || !SCORE_ID_PATTERN.test(scoreId)) return;

    const file = this.readPracticeFile();
    const updated = new Date().toISOString();
    const byScore: JsonObject = isObject(file.byScore) ? { ...file.byScore } : {};

    // Unknown fields survive a save (a later feature may add some); the fields this feature owns are rewritten.
    const previous = isObject(byScore[scoreId]) ? (byScore[scoreId] as JsonObject) : {};
    const { selection: _selection, ...previousKept } = previous;
    byScore[scoreId] = { ...previousKept, ...practiceFields(settings), updated };

    const previousDefaults = isObject(file.defaults) ? file.defaults : {};
    const { selection: _defaultSelection, loop: _defaultLoop, ...defaultsKept } = previousDefaults;
    const { loop: _noLoop, ...defaultFields } = practiceFields(settings);

    this.practiceFile = {
      ...file,
      version: 1,
      defaults: { ...defaultsKept, ...defaultFields, updated },
      byScore: this.evictOldest(byScore, scoreId, PRACTICE_SETTINGS_MAX),
    };

    if (this.practiceTimer !== null) clearTimeout(this.practiceTimer);
    this.practiceTimer = setTimeout(() => this.flushPractice(), SETTINGS_WRITE_DEBOUNCE_MS);
  }

  loadPlay(scoreId: string | null): import('../../core/play/types.js').RunSettings {
    const file = this.readPlayFile();
    const byScore = isObject(file.byScore) ? file.byScore : {};
    const own = scoreId !== null && SCORE_ID_PATTERN.test(scoreId) ? byScore[scoreId] : undefined;
    if (isObject(own)) return validPlay(own);

    // A Score never played in Play mode takes strictness/count-in/etc. from the last-used defaults, but never the
    // tempo (feature 012 R-9, FR-015): its first Play setup starts at the written tempo, exactly like the transport.
    const defaults = isObject(file.defaults) ? validPlay(file.defaults) : BUILT_IN_PLAY;
    return { ...defaults, range: null, tempoPercent: BUILT_IN_PLAY.tempoPercent };
  }

  savePlay(scoreId: string | null, settings: import('../../core/play/types.js').RunSettings): void {
    if (scoreId === null || !SCORE_ID_PATTERN.test(scoreId)) return;

    const file = this.readPlayFile();
    const updated = new Date().toISOString();
    const byScore: JsonObject = isObject(file.byScore) ? { ...file.byScore } : {};

    const previous = isObject(byScore[scoreId]) ? (byScore[scoreId] as JsonObject) : {};
    const { selection: _selection, ...previousKept } = previous;
    byScore[scoreId] = { ...previousKept, ...playFields(settings), updated };

    const previousDefaults = isObject(file.defaults) ? file.defaults : {};
    const { selection: _defaultSelection, range: _defaultRange, ...defaultsKept } = previousDefaults;
    const { range: _noRange, ...defaultFields } = playFields(settings);

    this.playFile = {
      ...file,
      version: 1,
      defaults: { ...defaultsKept, ...defaultFields, updated },
      // T068 says "with the per-Score cap". Wait, the PLAY_SETTINGS_MAX is 20, same as PRACTICE_SETTINGS_MAX.
      byScore: this.evictOldest(byScore, scoreId, 20), // We will update evictOldest to take max
    };

    if (this.playTimer !== null) clearTimeout(this.playTimer);
    this.playTimer = setTimeout(() => this.flushPlay(), SETTINGS_WRITE_DEBOUNCE_MS);
  }

  adoptScoreSettings(fromHashes: readonly string[], toHash: string): boolean {
    if (!SCORE_ID_PATTERN.test(toHash)) return false;
    try {
      const practice = this.adoptInto(this.readPracticeFile(), 'loop', fromHashes, toHash);
      if (practice) {
        this.practiceFile = practice;
        if (this.practiceTimer !== null) clearTimeout(this.practiceTimer);
        this.practiceTimer = setTimeout(() => this.flushPractice(), SETTINGS_WRITE_DEBOUNCE_MS);
      }
      const play = this.adoptInto(this.readPlayFile(), 'range', fromHashes, toHash);
      if (play) {
        this.playFile = play;
        if (this.playTimer !== null) clearTimeout(this.playTimer);
        this.playTimer = setTimeout(() => this.flushPlay(), SETTINGS_WRITE_DEBOUNCE_MS);
      }
      return practice !== null || play !== null;
    } catch {
      return false;
    }
  }

  /** `file` with the entry of the first of `fromHashes` that has one copied to `toHash` (without `omit`, the field that
   *  belongs to one Score); null when `toHash` already has an entry or none of the old ones does. */
  private adoptInto(file: JsonObject, omit: string, fromHashes: readonly string[], toHash: string): JsonObject | null {
    const byScore: JsonObject = isObject(file.byScore) ? file.byScore : {};
    if (isObject(byScore[toHash])) return null;
    const from = fromHashes.find((hash) => SCORE_ID_PATTERN.test(hash) && isObject(byScore[hash]));
    if (from === undefined) return null;
    const { [omit]: _belongsToOneScore, ...kept } = byScore[from] as JsonObject;
    const next: JsonObject = { ...byScore, [toHash]: { ...kept, updated: new Date().toISOString() } };
    return { ...file, version: 1, byScore: this.evictOldest(next, toHash, PRACTICE_SETTINGS_MAX) };
  }

  /** At most `max` Scores stay; the oldest-updated go first, and the Score just saved never does. */
  private evictOldest(byScore: JsonObject, keep: string, max: number): JsonObject {
    const ids = Object.keys(byScore);
    if (ids.length <= max) return byScore;

    const updatedOf = (id: string): string => {
      const entry = byScore[id];
      return isObject(entry) && typeof entry.updated === 'string' ? entry.updated : '';
    };
    const oldestFirst = ids.filter((id) => id !== keep).sort((a, b) => updatedOf(a).localeCompare(updatedOf(b)));
    const result = { ...byScore };
    for (const id of oldestFirst.slice(0, ids.length - max)) delete result[id];
    return result;
  }

  private flushPractice(): void {
    this.practiceTimer = null;
    if (this.practiceFile) this.write(PRACTICE_STORAGE_KEY, this.practiceFile);
  }

  private flushPlay(): void {
    this.playTimer = null;
    if (this.playFile) this.write('musicanyya.play.v1', this.playFile);
  }

  /** The practice file as saved this session, else as stored; anything unusable reads as an empty file. */
  private readPracticeFile(): JsonObject {
    if (this.practiceFile) return this.practiceFile;
    try {
      const item = localStorage.getItem(PRACTICE_STORAGE_KEY);
      if (item) {
        const parsed: unknown = JSON.parse(item);
        if (isObject(parsed) && parsed.version === 1) return parsed;
      }
    } catch {
      // unreadable or corrupt: start again from an empty file
    }
    return { version: 1 };
  }

  private readPlayFile(): JsonObject {
    if (this.playFile) return this.playFile;
    try {
      const item = localStorage.getItem('musicanyya.play.v1');
      if (item) {
        const parsed: unknown = JSON.parse(item);
        if (isObject(parsed) && parsed.version === 1) return parsed;
      }
    } catch {
      // unreadable or corrupt: start again from an empty file
    }
    return { version: 1 };
  }

  private write(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      if (!this.errorReported) {
        this.errorReported = true;
        this.onError?.('storageUnavailable');
      }
    }
  }
}
