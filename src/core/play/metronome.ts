import { METRONOME_VOLUME_MUTED, METRONOME_VOLUME_ON } from '../defaults.js';

/**
 * The level to set the Metronome channel to, on the `AudioEngine.setChannelVolume` scale (0..100): silent when the musician
 * has muted it, full otherwise. One place for the two callers - the start of a run and a live mute change - so neither can
 * send a wrong "on" level (009 R-02: a plain 1 on this scale is 1 %, nearly silent).
 */
export function metronomeChannelVolume(muted: boolean): number {
  return muted ? METRONOME_VOLUME_MUTED : METRONOME_VOLUME_ON;
}
