import { playState } from './playState.js';
import { practiceState } from './practiceState.js';
import { deriveRunStatus } from './runStatus.js';
import { transportState } from './transportState.js';

/**
 * True while a Listen, Practice or Play run can be stopped (count-in, running or paused), and also while one is
 * starting - the transport waits in `loading` for the sound - since nothing may open over the music from the moment
 * Play is pressed (FR-006).
 */
export function isRunActive(): boolean {
  if (transportState.get().phase === 'loading') return true;
  return deriveRunStatus({
    transport: transportState.get(),
    practice: practiceState.get(),
    run: playState.get().run,
    midiConnected: true,
    noticeCodes: [],
    measureIndex: null,
  }).canStop;
}

/**
 * Calls `listener` when a run becomes active or stops being active; returns the unsubscribe function. The stores this
 * reads change every frame during a Play run (its position), so the listener is only bothered when the answer flips.
 */
export function subscribeRunActive(listener: () => void): () => void {
  let last = isRunActive();
  const onChange = () => {
    const now = isRunActive();
    if (now === last) return;
    last = now;
    listener();
  };
  const unsubscribes = [
    transportState.subscribe(onChange),
    practiceState.subscribe(onChange),
    playState.subscribe(onChange),
  ];
  return () => {
    for (const unsubscribe of unsubscribes) unsubscribe();
  };
}
