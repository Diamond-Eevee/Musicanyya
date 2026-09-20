/** An AudioContext.getOutputTimestamp()-style pairing between the audio clock and performance.now() (research R-04). */
export interface ClockPair {
  contextTime: number; // AudioContext time domain, seconds
  performanceTime: number; // performance.now() domain, milliseconds
}

/**
 * Maps `MIDIMessageEvent.timeStampMs` (`performance.now()` domain) onto `AudioContext` seconds, the one clock
 * Constitution II requires. The engine calls `updatePair` with a fresh `(contextTime, performanceTime)` pair
 * whenever one is available (the same pairing `position-sync.ts` uses for the cursor); `toAudioTime` always uses
 * the most recently supplied pair, so a recorded message can store both the mapped `audioTimeSec` and the raw
 * `timeStampMs` it came from.
 */
export class MidiClockMap {
  private pair: ClockPair | null = null;

  /**
   * Anchors the map to a fresh pair. `null` is a no-op: when the browser cannot supply a usable pair this cycle,
   * the map keeps its last known pair instead of losing its anchor.
   */
  updatePair(pair: ClockPair | null): void {
    if (pair) this.pair = pair;
  }

  /** The audio-context-clock time for a `performance.now()` timestamp, or `null` before any pair has been set. */
  toAudioTime(timeStampMs: number): number | null {
    if (!this.pair) return null;
    return this.pair.contextTime + (timeStampMs - this.pair.performanceTime) / 1000;
  }
}
