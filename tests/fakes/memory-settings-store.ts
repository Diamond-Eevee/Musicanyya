import { METRONOME_LEVEL_DEFAULT, ORCHESTRA_LEVEL_DEFAULT } from '../../src/core/defaults.js';
import { OVERLAYS_DEFAULT, SCORE_SCALE_DEFAULT, VOLUME_DEFAULT } from '../../src/engine/config.js';
import type { PracticeSettings, SettingsStore, UserSettings } from '../../src/engine/ports.js';

const BUILT_IN_USER: UserSettings = {
  version: 3,
  volume: VOLUME_DEFAULT,
  scale: SCORE_SCALE_DEFAULT,
  follow: true,
  overlays: { ...OVERLAYS_DEFAULT },
  metronomeLevel: METRONOME_LEVEL_DEFAULT,
  orchestraLevel: ORCHESTRA_LEVEL_DEFAULT,
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

  /** Writes are immediate here, so there is never anything pending (ports 2.1.0). */
  flushPending(): void {}

  loadPractice(scoreId: string | null): PracticeSettings {
    const own = scoreId === null ? undefined : this.byScore.get(scoreId);
    return own ? { ...own } : { ...this.defaults, loop: null };
  }

  adoptScoreSettings(fromHashes: readonly string[], toHash: string): boolean {
    if (this.byScore.has(toHash)) return false;
    const from = fromHashes.find((hash) => this.byScore.has(hash));
    const own = from === undefined ? undefined : this.byScore.get(from);
    if (!own) return false;
    this.byScore.set(toHash, { ...own, loop: null });
    return true;
  }

  savePractice(scoreId: string | null, settings: PracticeSettings): void {
    if (scoreId === null) return;
    this.byScore.set(scoreId, { ...settings });
    this.defaults = { ...settings, loop: null };
  }
}
