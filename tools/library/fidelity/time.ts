export interface QuarterTime {
  num: number;
  den: number;
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const temp = b;
    b = a % b;
    a = temp;
  }
  return a;
}

export function q(num: number, den: number = 1): QuarterTime {
  if (den === 0) {
    throw new Error('QuarterTime denominator cannot be 0');
  }
  if (num === 0) {
    return { num: 0, den: 1 };
  }

  const divisor = gcd(num, den);
  let n = num / divisor;
  let d = den / divisor;

  if (d < 0) {
    n = -n;
    d = -d;
  }

  return { num: n, den: d };
}

export function add(a: QuarterTime, b: QuarterTime): QuarterTime {
  return q(a.num * b.den + b.num * a.den, a.den * b.den);
}

export function sub(a: QuarterTime, b: QuarterTime): QuarterTime {
  return q(a.num * b.den - b.num * a.den, a.den * b.den);
}

export function cmp(a: QuarterTime, b: QuarterTime): number {
  // Since denominator is always positive
  return a.num * b.den - b.num * a.den;
}

export function fromTicks(ticks: number, ppq: number): QuarterTime {
  return q(ticks, ppq);
}

export function show(qt: QuarterTime): string {
  if (qt.num === 0) {
    return '0';
  }

  const whole = Math.floor(qt.num / qt.den);
  const rem = qt.num % qt.den;

  if (rem === 0) {
    return whole.toString();
  }

  if (whole === 0) {
    return `${rem}/${qt.den}`;
  }

  return `${whole} ${rem}/${qt.den}`;
}
