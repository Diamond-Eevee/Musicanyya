import {
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
import type { SettingsStore, UserSettings } from '../ports.js';

export const SETTINGS_STORAGE_KEY = 'musicanyya.settings.v1';

function isInt(value: unknown, min: number, max: number, step = 1): value is number {
  return (
    typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max && (value - min) % step === 0
  );
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

export class LocalSettingsStore implements SettingsStore {
  private raw: Record<string, unknown> = {};
  private writeTimer: ReturnType<typeof setTimeout> | null = null;
  private pending: UserSettings | null = null;
  private errorReported = false;

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
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.raw));
    } catch {
      if (!this.errorReported) {
        this.errorReported = true;
        this.onError?.('storageUnavailable');
      }
    }
  }
}
