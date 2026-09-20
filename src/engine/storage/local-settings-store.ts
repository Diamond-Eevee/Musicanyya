import type { HandSelection } from '../../core/practice/types.js';
import {
  PRACTICE_SETTINGS_MAX,
  SETTINGS_WRITE_DEBOUNCE_MS,
  TEMPO_PERCENT_DEFAULT,
  TEMPO_PERCENT_MAX,
  TEMPO_PERCENT_MIN,
  TEMPO_PERCENT_STEP,
  VOLUME_DEFAULT,
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
} from '../config.js';
import type { PracticeSettings, SettingsStore, UserSettings } from '../ports.js';

export const SETTINGS_STORAGE_KEY = 'musicanyya.settings.v1';
export const PRACTICE_STORAGE_KEY = 'musicanyya.practice.v1';

const SCORE_ID_PATTERN = /^[0-9a-f]{64}$/;
const HAND_PRESETS: readonly string[] = ['both', 'right', 'left', 'custom'];

const BUILT_IN_PRACTICE: PracticeSettings = { selection: null, loop: null, accompaniment: true, help: true };

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

function validate(raw: Record<string, unknown>): UserSettings {
  return {
    version: 1,
    volume: isInt(raw.volume, 0, 100) ? raw.volume : VOLUME_DEFAULT,
    tempoPercent: isInt(raw.tempoPercent, TEMPO_PERCENT_MIN, TEMPO_PERCENT_MAX, TEMPO_PERCENT_STEP)
      ? raw.tempoPercent
      : TEMPO_PERCENT_DEFAULT,
    zoomPercent: isInt(raw.zoomPercent, ZOOM_MIN, ZOOM_MAX) ? raw.zoomPercent : ZOOM_DEFAULT,
    follow: typeof raw.follow === 'boolean' ? raw.follow : true,
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

export class LocalSettingsStore implements SettingsStore {
  private raw: Record<string, unknown> = {};
  private writeTimer: ReturnType<typeof setTimeout> | null = null;
  private pending: UserSettings | null = null;
  private errorReported = false;
  /** The practice file as last saved this session. It stays authoritative until the page is reloaded, so blocked or
   *  full storage still lets the settings work in memory. Null until the first save. */
  private practiceFile: JsonObject | null = null;
  private practiceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly onError?: (message: string) => void) {}

  load(): UserSettings {
    try {
      const item = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (item) {
        const parsed: unknown = JSON.parse(item);
        if (parsed && typeof parsed === 'object') this.raw = parsed as Record<string, unknown>;
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

  private flush(): void {
    this.writeTimer = null;
    if (!this.pending) return;
    this.raw = { ...this.raw, ...this.pending };
    this.pending = null;
    this.write(SETTINGS_STORAGE_KEY, this.raw);
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
      byScore: this.evictOldest(byScore, scoreId),
    };

    if (this.practiceTimer !== null) clearTimeout(this.practiceTimer);
    this.practiceTimer = setTimeout(() => this.flushPractice(), SETTINGS_WRITE_DEBOUNCE_MS);
  }

  /** At most PRACTICE_SETTINGS_MAX Scores stay; the oldest-updated go first, and the Score just saved never does. */
  private evictOldest(byScore: JsonObject, keep: string): JsonObject {
    const ids = Object.keys(byScore);
    if (ids.length <= PRACTICE_SETTINGS_MAX) return byScore;

    const updatedOf = (id: string): string => {
      const entry = byScore[id];
      return isObject(entry) && typeof entry.updated === 'string' ? entry.updated : '';
    };
    const oldestFirst = ids.filter((id) => id !== keep).sort((a, b) => updatedOf(a).localeCompare(updatedOf(b)));
    const result = { ...byScore };
    for (const id of oldestFirst.slice(0, ids.length - PRACTICE_SETTINGS_MAX)) delete result[id];
    return result;
  }

  private flushPractice(): void {
    this.practiceTimer = null;
    if (this.practiceFile) this.write(PRACTICE_STORAGE_KEY, this.practiceFile);
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
