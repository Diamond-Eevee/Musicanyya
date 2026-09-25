/**
 * The tiny script language shared by `pnpm screenshot --keys` and the e2e helper `pressKeys` (tests/e2e/helpers/
 * practice.ts): a comma-separated list of steps, each `+<midi>` (key down), `-<midi>` (key up), `wait` (let the page
 * draw a frame) or `sleep:<ms>` (wait that many milliseconds of wall-clock time, so a Play run can be played in time).
 * Pure, so both callers agree on what a list means and it is tested without a browser.
 */

export type KeyStep =
  | { kind: 'down'; key: number }
  | { kind: 'up'; key: number }
  | { kind: 'wait' }
  | { kind: 'sleep'; ms: number };

const STEP = /^([+-])(\d{1,3})$/;
const SLEEP = /^sleep:(\d{1,5})$/;
const MIDI_MAX = 127;
const SLEEP_MIN_MS = 1;
const SLEEP_MAX_MS = 60_000;

/** Parses "+76,-76,wait,sleep:500,+75". Throws an Error naming the bad step; an empty list is valid and gives no steps. */
export function parseKeySteps(text: string): KeyStep[] {
  const steps: KeyStep[] = [];
  for (const raw of text.split(',')) {
    const item = raw.trim();
    if (item === '') continue;
    if (item === 'wait') {
      steps.push({ kind: 'wait' });
      continue;
    }
    const sleep = SLEEP.exec(item);
    if (sleep) {
      const ms = Number(sleep[1]);
      if (ms < SLEEP_MIN_MS || ms > SLEEP_MAX_MS) throw badStep(item);
      steps.push({ kind: 'sleep', ms });
      continue;
    }
    const match = STEP.exec(item);
    const key = match ? Number(match[2]) : Number.NaN;
    if (!match || key > MIDI_MAX) throw badStep(item);
    steps.push({ kind: match[1] === '+' ? 'down' : 'up', key });
  }
  return steps;
}

function badStep(item: string): Error {
  return new Error(
    `Bad key step "${item}": use +<midi>, -<midi>, wait or sleep:<ms> (midi 0-127, ms ${SLEEP_MIN_MS}-${SLEEP_MAX_MS})`,
  );
}

/** The raw MIDI bytes the `e2e-midi` window event carries for a key step (velocity 100 down, 0 up). */
export function keyStepBytes(step: Extract<KeyStep, { kind: 'down' | 'up' }>): [number, number, number] {
  return step.kind === 'down' ? [0x90, step.key, 100] : [0x80, step.key, 0];
}
