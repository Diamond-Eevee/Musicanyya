import { playState } from './playState.js';
import { practiceState } from './practiceState.js';
import { deriveRunStatus } from './runStatus.js';
import { transportState } from './transportState.js';

/**
 * Narrower than `isRunActive()` (FR-007, R-2, contracts/score-browser.md §5): true only while a Play run
 * (count-in or running) or a Practice session (waiting, blocked or interrupted) is active. A playing or paused
 * Listen does not count - opening the browser only pauses Listen (R-2's own decision), and the browser must not
 * close just because Listen started or paused.
 */
export function isPlayOrPracticeActive(): boolean {
  const run = playState.get().run;
  if (run !== null && (run.phase === 'countIn' || run.phase === 'running')) return true;
  const session = practiceState.get().session;
  return (
    session !== null && (session.phase === 'waiting' || session.phase === 'blocked' || session.phase === 'interrupted')
  );
}

/** Calls `listener` when `isPlayOrPracticeActive()` flips, the same edge-triggered shape as `subscribeRunActive`. */
export function subscribePlayOrPracticeActive(listener: () => void): () => void {
  let last = isPlayOrPracticeActive();
  const onChange = () => {
    const now = isPlayOrPracticeActive();
    if (now === last) return;
    last = now;
    listener();
  };
  const unsubscribes = [playState.subscribe(onChange), practiceState.subscribe(onChange)];
  return () => {
    for (const unsubscribe of unsubscribes) unsubscribe();
  };
}

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
