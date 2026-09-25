/**
 * The tiny script language shared by `pnpm screenshot --keys` and the e2e helper `pressKeys` (tests/e2e/helpers/
 * practice.ts): a comma-separated list of steps, each `+<midi>` (key down), `-<midi>` (key up) or `wait` (let the page
 * draw a frame). Pure, so both callers agree on what a list means and it is tested without a browser.
 */

export type KeyStep = { kind: 'down'; key: number } | { kind: 'up'; key: number } | { kind: 'wait' };

const STEP = /^([+-])(\d{1,3})$/;
const MIDI_MAX = 127;

/** Parses "+76,-76,wait,+75". Throws an Error naming the bad step; an empty list is valid and gives no steps. */
export function parseKeySteps(text: string): KeyStep[] {
  const steps: KeyStep[] = [];
  for (const raw of text.split(',')) {
    const item = raw.trim();
    if (item === '') continue;
    if (item === 'wait') {
      steps.push({ kind: 'wait' });
      continue;
    }
    const match = STEP.exec(item);
    const key = match ? Number(match[2]) : Number.NaN;
    if (!match || key > MIDI_MAX) throw new Error(`Bad key step "${item}": use +<midi>, -<midi> or wait (midi 0-127)`);
    steps.push({ kind: match[1] === '+' ? 'down' : 'up', key });
  }
  return steps;
}

/** The raw MIDI bytes the `e2e-midi` window event carries for a key step (velocity 100 down, 0 up). */
export function keyStepBytes(step: Exclude<KeyStep, { kind: 'wait' }>): [number, number, number] {
  return step.kind === 'down' ? [0x90, step.key, 100] : [0x80, step.key, 0];
}
