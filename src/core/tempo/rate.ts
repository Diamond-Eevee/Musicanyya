export function ticksPerFrame(
  qpmNum: number,
  qpmDen: number,
  ppq: number,
  sampleRate: number,
  tempoPercentage: number,
): number {
  const qpm = qpmNum / qpmDen;
  const realQpm = qpm * (tempoPercentage / 100);
  const tps = (realQpm * ppq) / 60;
  return tps / sampleRate;
}

export function tickAtFrame(frame: number, rate: number): number {
  return frame * rate;
}

export function frameOfTick(tick: number, rate: number): number {
  return Math.ceil(tick / rate);
}
