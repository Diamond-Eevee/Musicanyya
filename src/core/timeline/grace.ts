import { GRACE_MAX_STEAL_RATIO, GRACE_MIN_REMAINING_TICKS, GRACE_NOTE_TICKS } from '../defaults.js';
import type { NoteId } from '../score/model.js';
import type { Ticks } from './types.js';

export interface GraceInput {
  noteId: NoteId;
  part: number;
  voice: string;
  nominalTick: Ticks;
  graceIndex: number | null; // null = the principal note; 1..n = play order within its group
  stealPrevious: number | null; // percent 0-100, from <grace steal-time-previous>
  stealFollowing: number | null; // percent 0-100, from <grace steal-time-following>
  durationTicks: Ticks; // the principal's own written duration; ignored for graces
}

export interface TimedNote {
  noteId: NoteId;
  startTick: Ticks;
  endTick: Ticks;
}

interface StreamGroup {
  nominalTick: Ticks;
  graces: GraceInput[]; // sorted by graceIndex
  principal: GraceInput | null;
}

function groupByVoiceStream(inputs: GraceInput[]): Map<string, StreamGroup[]> {
  const byVoice = new Map<string, GraceInput[]>();
  for (const inp of inputs) {
    const key = `${inp.part}:${inp.voice}`;
    const arr = byVoice.get(key);
    if (arr) arr.push(inp);
    else byVoice.set(key, [inp]);
  }
  const result = new Map<string, StreamGroup[]>();
  for (const [key, list] of byVoice) {
    list.sort((a, b) => a.nominalTick - b.nominalTick || (a.graceIndex ?? 0) - (b.graceIndex ?? 0));
    const groups: StreamGroup[] = [];
    for (const inp of list) {
      let group = groups[groups.length - 1];
      if (!group || group.nominalTick !== inp.nominalTick) {
        group = { nominalTick: inp.nominalTick, graces: [], principal: null };
        groups.push(group);
      }
      if (inp.graceIndex === null) group.principal = inp;
      else group.graces.push(inp);
    }
    result.set(key, groups);
  }
  return result;
}

/**
 * Places grace notes in time after unrolling (R-8.1): each grace lasts GRACE_NOTE_TICKS by
 * default (scaled down if a group would take more than GRACE_MAX_STEAL_RATIO of the previous
 * note, and never shortening it below GRACE_MIN_REMAINING_TICKS), stealing from the previous
 * note in the same voice; <grace steal-time-following> instead keeps the group on the beat and
 * delays the principal. Grace notes with no previous note (start of a voice/piece) become a
 * lead-in before tick 0.
 */
export function applyGraceTiming(inputs: GraceInput[], ppq: number): { timed: TimedNote[]; leadInTicks: Ticks } {
  const timedByNoteId = new Map<NoteId, TimedNote>();
  let leadInTicks = 0;
  const graceTickDefault = GRACE_NOTE_TICKS(ppq);
  const minRemaining = GRACE_MIN_REMAINING_TICKS(ppq);

  for (const groups of groupByVoiceStream(inputs).values()) {
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      if (!group) continue;
      if (group.principal) {
        timedByNoteId.set(group.principal.noteId, {
          noteId: group.principal.noteId,
          startTick: group.nominalTick,
          endTick: group.nominalTick + group.principal.durationTicks,
        });
      }
      if (group.graces.length === 0) continue;
      const n = group.graces.length;
      const first = group.graces[0];
      const followingPercent = first?.stealFollowing ?? null;
      const previousPercent = first?.stealPrevious ?? null;

      if (followingPercent !== null) {
        const total = Math.round((graceTickDefault * n * followingPercent) / 100) || graceTickDefault * n;
        let t = group.nominalTick;
        for (const g of group.graces) {
          timedByNoteId.set(g.noteId, { noteId: g.noteId, startTick: t, endTick: t + total / n });
          t += total / n;
        }
        if (group.principal) {
          const principalDuration = group.principal.durationTicks;
          timedByNoteId.set(group.principal.noteId, {
            noteId: group.principal.noteId,
            startTick: group.nominalTick + total,
            endTick: group.nominalTick + total + principalDuration,
          });
        }
        continue;
      }

      const prevGroup = groups[i - 1];
      const prevTimed = prevGroup ? (prevGroup.principal ?? prevGroup.graces[prevGroup.graces.length - 1]) : undefined;
      const prevTimedNote = prevTimed ? timedByNoteId.get(prevTimed.noteId) : undefined;

      if (prevTimedNote) {
        const prevDuration = prevTimedNote.endTick - prevTimedNote.startTick;
        const stealCap = prevDuration * GRACE_MAX_STEAL_RATIO;
        const maxAllowedBySafety = Math.max(0, prevDuration - minRemaining);
        const requested = previousPercent !== null ? prevDuration * (previousPercent / 100) : graceTickDefault * n;
        const actualTotal = Math.min(requested, stealCap, maxAllowedBySafety);
        const perGrace = actualTotal / n;

        let end = group.nominalTick;
        for (let g = group.graces.length - 1; g >= 0; g--) {
          const grace = group.graces[g];
          if (!grace) continue;
          const start = end - perGrace;
          timedByNoteId.set(grace.noteId, { noteId: grace.noteId, startTick: start, endTick: end });
          end = start;
        }
        prevTimedNote.endTick -= actualTotal;
      } else {
        // No previous note in this voice: place the group ending at the nominal tick. If that
        // pushes it before tick 0 (grace notes at the very start of the piece), it becomes a lead-in.
        const perGrace = graceTickDefault;
        let end = group.nominalTick;
        for (let g = group.graces.length - 1; g >= 0; g--) {
          const grace = group.graces[g];
          if (!grace) continue;
          const start = end - perGrace;
          timedByNoteId.set(grace.noteId, { noteId: grace.noteId, startTick: start, endTick: end });
          end = start;
        }
        if (end < 0) leadInTicks = Math.max(leadInTicks, -end);
      }
    }
  }

  // Shift everything forward so nothing sounds before tick 0.
  const timed = [...timedByNoteId.values()];
  if (leadInTicks > 0) {
    for (const t of timed) {
      t.startTick += leadInTicks;
      t.endTick += leadInTicks;
    }
  }

  return { timed, leadInTicks };
}
