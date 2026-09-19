const STEP_TO_CLASS: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

export function getMidiKey(step: string, alter: number, octave: number): number {
  const pc = STEP_TO_CLASS[step] ?? 0;
  return (octave + 1) * 12 + pc + alter;
}

export function getUnpitchedDisplayKey(step: string, octave: number): number {
  const pc = STEP_TO_CLASS[step] ?? 0;
  return (octave + 1) * 12 + pc;
}

export function applyTransposition(
  midiKey: number,
  chromatic: number,
  octaveChange: number,
  isDoubleTransposition: boolean,
): number {
  return midiKey + chromatic + octaveChange * 12;
}
