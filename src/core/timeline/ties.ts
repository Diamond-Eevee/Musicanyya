import type { LoadNoticeCode } from '../score/load-report.js';
import type { NoteId } from '../score/model.js';
import type { Ticks } from './types.js';

export interface TieOccurrence {
  noteId: NoteId;
  passIndex: number;
  part: number;
  soundingKey: number;
  startTick: Ticks;
  endTick: Ticks;
  tieStart: boolean;
  tieStop: boolean;
}

export interface TieChain {
  members: TieOccurrence[];
  startTick: Ticks;
  endTick: Ticks;
}

export interface TieNotice {
  code: LoadNoticeCode;
  noteId: NoteId;
}

/**
 * Resolves ties on the unrolled occurrence stream (R-8.4): a tie start links to the next
 * occurrence with the same part and sounding key whose onset equals its end. Chords tie per
 * note (independent by sounding key). Broken ties are re-attacked with an info notice.
 */
export function resolveTies(occurrences: TieOccurrence[]): { chains: TieChain[]; notices: TieNotice[] } {
  const sorted = [...occurrences].sort((a, b) => a.startTick - b.startTick);
  const openByKey = new Map<string, TieChain>();
  const chains: TieChain[] = [];
  const notices: TieNotice[] = [];

  for (const occ of sorted) {
    const key = `${occ.part}:${occ.soundingKey}`;
    const open = openByKey.get(key);
    if (open && open.endTick === occ.startTick && occ.tieStop) {
      open.members.push(occ);
      open.endTick = occ.endTick;
      if (!occ.tieStart) openByKey.delete(key);
      continue;
    }
    if (occ.tieStop) {
      notices.push({ code: 'brokenTie', noteId: occ.noteId });
    }
    const chain: TieChain = { members: [occ], startTick: occ.startTick, endTick: occ.endTick };
    chains.push(chain);
    if (occ.tieStart) openByKey.set(key, chain);
  }

  for (const open of openByKey.values()) {
    const last = open.members[open.members.length - 1];
    if (last) notices.push({ code: 'brokenTie', noteId: last.noteId });
  }

  return { chains, notices };
}
