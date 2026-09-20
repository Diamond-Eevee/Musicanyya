import { TEMPO_PERCENT_DEFAULT, VOLUME_DEFAULT, ZOOM_DEFAULT } from '../../src/engine/config.js';
import type { PracticeSettings, SettingsStore, UserSettings } from '../../src/engine/ports.js';

const BUILT_IN_USER: UserSettings = {
  version: 1,
  volume: VOLUME_DEFAULT,
  tempoPercent: TEMPO_PERCENT_DEFAULT,
  zoomPercent: ZOOM_DEFAULT,
  follow: true,
};
const BUILT_IN_PRACTICE: PracticeSettings = { selection: null, loop: null, accompaniment: true, help: true };

/** A `SettingsStore` that keeps everything in memory, so the session wiring can be tested without localStorage. */
export class MemorySettingsStore implements SettingsStore {
  private user: UserSettings = { ...BUILT_IN_USER };
  private byScore = new Map<string, PracticeSettings>();
  private defaults: PracticeSettings = { ...BUILT_IN_PRACTICE };

  load(): UserSettings {
    return { ...this.user };
  }

  save(settings: UserSettings): void {
    this.user = { ...settings };
  }

  loadPractice(scoreId: string | null): PracticeSettings {
    const own = scoreId === null ? undefined : this.byScore.get(scoreId);
    return own ? { ...own } : { ...this.defaults, loop: null };
  }

  savePractice(scoreId: string | null, settings: PracticeSettings): void {
    if (scoreId === null) return;
    this.byScore.set(scoreId, { ...settings });
    this.defaults = { ...settings, loop: null };
  }
}
