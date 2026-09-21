import { playState } from './playState.js';
import { practiceState } from './practiceState.js';
import { deriveRunStatus } from './runStatus.js';
import { transportState } from './transportState.js';

/** True while a Listen, Practice or Play run can be stopped (count-in, running or paused). */
export function isRunActive(): boolean {
  return deriveRunStatus({
    transport: transportState.get(),
    practice: practiceState.get(),
    run: playState.get().run,
    midiConnected: true,
    noticeCodes: [],
    measureIndex: null,
  }).canStop;
}

/** Calls `listener` whenever anything a run's activity depends on changes; returns the unsubscribe function. */
export function subscribeRunActive(listener: () => void): () => void {
  const unsubscribes = [
    transportState.subscribe(listener),
    practiceState.subscribe(listener),
    playState.subscribe(listener),
  ];
  return () => {
    for (const unsubscribe of unsubscribes) unsubscribe();
  };
}
