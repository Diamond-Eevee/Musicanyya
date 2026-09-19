import { MAX_REPEAT_DEPTH, UNROLL_GUARD_FACTOR, UNROLL_HARD_CAP } from '../defaults.js';
import type { LoadNoticeCode } from '../score/load-report.js';
import type { EndingMark, Jump, MeasureInfo, NavigationMarks } from '../score/model.js';
import type { MeasurePass } from './types.js';

export interface UnrollNotice {
  code: LoadNoticeCode;
  measureIndex: number;
  detail?: string;
}

export interface UnrollResult {
  passes: MeasurePass[];
  notices: UnrollNotice[];
}

interface EndingMember {
  start: number;
  end: number;
  numbers: number[];
}
interface EndingGroup {
  members: EndingMember[];
}

function groupBy<T>(items: T[], key: (item: T) => number): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = map.get(k);
    if (arr) arr.push(item);
    else map.set(k, [item]);
  }
  return map;
}

function buildEndingGroups(endings: EndingMark[]): EndingGroup[] {
  const sorted = [...endings].sort((a, b) => a.measureIndex - b.measureIndex);
  const groups: EndingGroup[] = [];
  let i = 0;
  while (i < sorted.length) {
    const startMark = sorted[i];
    if (startMark?.type !== 'start') {
      i++;
      continue;
    }
    const members: EndingMember[] = [];
    let cursor = i;
    while (cursor < sorted.length) {
      const start = sorted[cursor];
      if (start?.type !== 'start') break;
      let end = start.measureIndex;
      let j = cursor + 1;
      let closeMark = start;
      for (; j < sorted.length; j++) {
        const m = sorted[j];
        if (!m) break;
        if (m.type === 'stop' || m.type === 'discontinue') {
          closeMark = m;
          end = m.measureIndex;
          j++;
          break;
        }
      }
      members.push({
        start: start.measureIndex,
        end,
        numbers: start.numbers.length > 0 ? start.numbers : closeMark.numbers,
      });
      cursor = j;
      // Only continue the group if the next entry starts immediately after this member's close.
      const next = sorted[cursor];
      if (!next || next.measureIndex !== end + 1 || next.type !== 'start') break;
    }
    groups.push({ members });
    i = cursor;
  }
  return groups;
}

function findGroupByStart(
  groups: EndingGroup[],
  measureIndex: number,
): { group: EndingGroup; member: EndingMember } | undefined {
  for (const group of groups) {
    for (const member of group.members) {
      if (member.start === measureIndex) return { group, member };
    }
  }
  return undefined;
}

function findGroupContaining(groups: EndingGroup[], measureIndex: number): EndingGroup | undefined {
  for (const group of groups) {
    for (const member of group.members) {
      if (measureIndex >= member.start && measureIndex <= member.end) return group;
    }
  }
  return undefined;
}

function resolveJumpTarget(jump: Jump, navigation: NavigationMarks): number | undefined {
  const wantType = jump.type === 'da-capo' ? undefined : jump.type === 'dal-segno' ? 'segno' : 'coda';
  if (jump.type === 'da-capo') return 0;
  const candidates = navigation.targets.filter((t) => t.type === wantType);
  if (jump.name) {
    const named = candidates.find((t) => t.name === jump.name);
    if (named) return named.measureIndex;
    if (candidates.length === 0) return undefined;
  }
  if (candidates.length === 0) return undefined;
  // Only visual targets or a single target: the last one is the target.
  const last = candidates[candidates.length - 1];
  return last?.measureIndex;
}

export function unroll(measures: MeasureInfo[], navigation: NavigationMarks): UnrollResult {
  const notices: UnrollNotice[] = [];
  const passes: MeasurePass[] = [];
  const measureCount = measures.length;
  if (measureCount === 0) return { passes, notices };

  const repeatsByMeasure = groupBy(navigation.repeats, (r) => r.measureIndex);
  const jumpsByMeasure = groupBy(navigation.jumps, (j) => j.measureIndex);
  const targetsByMeasure = groupBy(navigation.targets, (t) => t.measureIndex);
  const endingGroups = buildEndingGroups(navigation.endings);

  const maxUnrolled = Math.min(UNROLL_GUARD_FACTOR * measureCount, UNROLL_HARD_CAP);

  let repeatStack: number[] = [];
  let lastCompletedBackward: number | null = null;
  const passCountByTarget = new Map<number, number>();
  let jumped = false;
  const usedJumpTypes = new Set<string>();

  function currentTarget(): number {
    const top = repeatStack.at(-1);
    if (top !== undefined) return top;
    return lastCompletedBackward !== null ? lastCompletedBackward + 1 : 0;
  }

  let pc = 0;
  let guardHit = false;
  let unrolledCursor = 0;

  while (pc < measureCount) {
    if (passes.length >= maxUnrolled) {
      guardHit = true;
      break;
    }

    // Step 2: forward repeat push.
    const repsAtPc = repeatsByMeasure.get(pc) ?? [];
    for (const r of repsAtPc) {
      if (r.direction !== 'forward') continue;
      if (repeatStack[repeatStack.length - 1] === pc) continue;
      if (repeatStack.length >= MAX_REPEAT_DEPTH) {
        notices.push({ code: 'repeatTooDeep', measureIndex: pc });
      } else {
        repeatStack.push(pc);
      }
    }

    // Step 3: ending group resolution.
    const groupEntry = findGroupByStart(endingGroups, pc);
    let groupCloses = false;
    if (groupEntry) {
      const target = currentTarget();
      const pass = (passCountByTarget.get(target) ?? 0) + 1;
      const lastMember = groupEntry.group.members.at(-1);
      if (lastMember) {
        let chosen = groupEntry.group.members.find((m) => m.numbers.includes(pass));
        if (!chosen && jumped) {
          chosen = lastMember;
        }
        if (!chosen) {
          chosen = lastMember;
          notices.push({ code: 'endingNoMatch', measureIndex: pc, detail: `pass ${pass}` });
        }
        pc = chosen.start;
        groupCloses = chosen === lastMember;
      }
    }

    // Step 4: emit.
    const target0 = currentTarget();
    const passNo = (passCountByTarget.get(target0) ?? 0) + 1;
    const mInfo = measures[pc];
    if (!mInfo) break;
    passes.push({ measureIndex: pc, passNo, startTick: unrolledCursor, lengthTicks: mInfo.lengthTicks });
    unrolledCursor += mInfo.lengthTicks;

    // The final member of an ending group closes its enclosing repeat cycle immediately: the
    // group's earlier (non-final) members may hold the actual backward-repeat barline, but once
    // we take the last member on the piece's final pass through it, that barline is never revisited.
    const repsHere0 = repeatsByMeasure.get(pc) ?? [];
    if (groupCloses && !repsHere0.some((r) => r.direction === 'backward')) {
      if (repeatStack.length > 0 && repeatStack[repeatStack.length - 1] === target0) {
        repeatStack.pop();
      }
      lastCompletedBackward = mInfo.index;
    }

    // Step 5: backward repeat.
    let looped = false;
    const repsHere = repeatsByMeasure.get(pc) ?? [];
    const backward = repsHere.find((r) => r.direction === 'backward');
    if (backward) {
      const coveringGroup = findGroupContaining(endingGroups, pc);
      let passesCount = backward.times ?? 2;
      if (coveringGroup) {
        passesCount = Math.max(...coveringGroup.members.flatMap((m) => m.numbers));
      }
      const target = currentTarget();
      const count = passCountByTarget.get(target) ?? 0;
      if (count < passesCount - 1 && (!jumped || backward.afterJump)) {
        passCountByTarget.set(target, count + 1);
        pc = target;
        looped = true;
      } else {
        if (repeatStack.length > 0 && repeatStack[repeatStack.length - 1] === target) {
          repeatStack.pop();
        }
        lastCompletedBackward = mInfo.index;
      }
    }
    if (looped) continue;

    // Step 6: jumps (only when no repeat was taken this measure).
    const jumpsHere = jumpsByMeasure.get(pc) ?? [];
    let jumpedNow = false;
    for (const jump of jumpsHere) {
      if (jump.timeOnly && !jump.timeOnly.includes(passNo)) continue;
      if (jump.type === 'da-capo' || jump.type === 'dal-segno') {
        if (usedJumpTypes.has(jump.type)) continue;
        const targetMeasure = resolveJumpTarget(jump, navigation);
        if (targetMeasure === undefined) {
          notices.push({ code: 'jumpTargetMissing', measureIndex: pc });
          continue;
        }
        usedJumpTypes.add(jump.type);
        jumped = true;
        repeatStack = [];
        passCountByTarget.clear();
        pc = targetMeasure;
        jumpedNow = true;
        break;
      }
      if (jump.type === 'to-coda') {
        if (!jumped || usedJumpTypes.has('to-coda')) continue;
        const targetMeasure = resolveJumpTarget(jump, navigation);
        if (targetMeasure === undefined) {
          notices.push({ code: 'jumpTargetMissing', measureIndex: pc });
          continue;
        }
        usedJumpTypes.add('to-coda');
        pc = targetMeasure;
        jumpedNow = true;
        break;
      }
    }
    if (jumpedNow) continue;

    // Fine: only stops playback once we have jumped (D.C./D.S. al Fine).
    const targetsHere = targetsByMeasure.get(pc) ?? [];
    if (jumped && targetsHere.some((t) => t.type === 'fine')) {
      break;
    }

    pc++;
  }

  if (guardHit) {
    notices.push({ code: 'unrollGuardHit', measureIndex: pc });
    passes.length = 0;
    for (let i = 0; i < measureCount; i++) {
      const mInfo = measures[i];
      if (!mInfo) continue;
      passes.push({ measureIndex: i, passNo: 1, startTick: mInfo.startTick, lengthTicks: mInfo.lengthTicks });
    }
  }

  return { passes, notices };
}

export function firstPassOf(passes: MeasurePass[], measureIndex: number): MeasurePass | undefined {
  return passes.find((p) => p.measureIndex === measureIndex);
}
