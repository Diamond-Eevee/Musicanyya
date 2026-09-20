import { MAX_PPQ } from './defaults.js';

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x;
}

export function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs(a * b) / gcd(a, b);
}

export function reduceFraction(num: number, den: number): { num: number; den: number } {
  if (num === 0) {
    return { num: 0, den: 1 };
  }
  const d = gcd(num, den);
  return { num: num / d, den: den / d };
}

export function computePPQ(divisions: number[]): number {
  let currentPPQ = 960;
  for (const div of divisions) {
    currentPPQ = lcm(currentPPQ, div);
  }
  if (currentPPQ > MAX_PPQ) {
    throw new Error(`PPQ exceeded MAX_PPQ: ${currentPPQ}`);
  }
  return currentPPQ;
}
