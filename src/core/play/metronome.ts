import { METRONOME_VOLUME_MUTED } from '../defaults.js';

/**
 * The level to set the Metronome channel to, on the `AudioEngine.setChannelVolume` scale (0..100): silent when the musician
 * has muted it, the musician's Metronome `level` (0..100, feature 019) otherwise. One place for every caller - the start of
 * a run, a live mute change and a live level change - so none can send a wrong "on" level (009 R-02: a plain 1 on this
 * scale is 1 %, nearly silent).
 */
export function metronomeChannelVolume(muted: boolean, level: number): number {
  return muted ? METRONOME_VOLUME_MUTED : level;
}
