// The played order of a reading's written bars, unfolded by the app's own repeat expansion (research R6: one shared
// rule for both sides; fromMusicXml gets the same expansion through buildTimeline).
import type { EndingMark, MeasureInfo, NavigationMarks, RepeatMark } from '../../../src/core/score/model';
import { unroll } from '../../../src/core/timeline/unroll';
import type { ReferenceBar } from './reference';

export function playedOrder(bars: ReferenceBar[]): number[] {
  const ppq = bars.reduce((l, b) => lcm(lcm(l, b.start.den), b.length.den), 1);
  const ticks = (t: { num: number; den: number }) => (t.num * ppq) / t.den;
  const measures: MeasureInfo[] = bars.map((b) => ({
    index: b.index,
    id: `m${b.index}`,
    label: b.number,
    startTick: ticks(b.start),
    lengthTicks: ticks(b.length),
    nominalTicks: ticks(b.length),
    implicit: false,
    beatOffsetTicks: 0,
    time: null,
  }));
  const repeats: RepeatMark[] = [];
  const endings: EndingMark[] = [];
  bars.forEach((b, i) => {
    if (b.repeatStart) repeats.push({ measureIndex: i, direction: 'forward', times: 2 });
    if (b.repeatEnd) repeats.push({ measureIndex: i, direction: 'backward', times: b.repeatTimes ?? 2 });
    const prev = bars[i - 1];
    const next = bars[i + 1];
    const same = (x: ReferenceBar | undefined) => x !== undefined && x.endings.join() === b.endings.join();
    if (b.endings.length === 0) return;
    if (!same(prev) || prev?.repeatEnd) endings.push({ measureIndex: i, type: 'start', numbers: b.endings });
    if (!same(next) || b.repeatEnd)
      endings.push({ measureIndex: i, type: b.repeatEnd ? 'stop' : 'discontinue', numbers: b.endings });
  });
  const navigation: NavigationMarks = { repeats, endings, targets: [], jumps: [] };
  return unroll(measures, navigation).passes.map((p) => p.measureIndex);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b;
}
