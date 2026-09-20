import { PLAY_RETRIGGER_DEBOUNCE_MS } from '../defaults.js';
import type { ExpectedNote } from './types.js';
import type { ResolvedWindow } from './windows.js';

export interface TickedMessage {
  kind: 'noteOn' | 'noteOff' | 'sustain';
  key: number;
  velocity: number;
  tick: number; // already on the run's timeline, via tickAtAudioTime (contracts/grading.md §1)
  audioTimeSec: number; // for the retrigger-debounce check, which is a real-time phenomenon (R-07)
}

export type ClaimPass = 'exact' | 'octave';

export interface Claim {
  expectedIndex: number; // ExpectedNote.index
  messageIndex: number; // index into the `messages` array passed to matchPerformance
  pass: ClaimPass;
}

export interface MatchOutcome {
  claims: readonly Claim[];
  missedIndices: readonly number[]; // ExpectedNote.index values with no claim
  extraMessageIndices: readonly number[]; // message indices of note-ons that claimed nothing
}

interface CandidatePress {
  messageIndex: number;
  key: number;
  tick: number;
}

/**
 * Only a note-on with velocity > 0 can claim; a note-off/note-on pair of one pitch closer together than
 * `PLAY_RETRIGGER_DEBOUNCE_MS` (real time, not ticks - it is a hardware bounce) is chatter, coalesced into the
 * press that was already open (contracts/grading.md §3).
 */
function candidatePresses(messages: readonly TickedMessage[]): CandidatePress[] {
  const lastNoteOffAudioTime = new Map<number, number>();
  const candidates: CandidatePress[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (!m) continue;
    if (m.kind === 'noteOff' || (m.kind === 'noteOn' && m.velocity <= 0)) {
      lastNoteOffAudioTime.set(m.key, m.audioTimeSec);
      continue;
    }
    if (m.kind !== 'noteOn') continue;
    const lastOff = lastNoteOffAudioTime.get(m.key);
    if (lastOff !== undefined && (m.audioTimeSec - lastOff) * 1000 < PLAY_RETRIGGER_DEBOUNCE_MS) continue;
    candidates.push({ messageIndex: i, key: m.key, tick: m.tick });
  }
  return candidates;
}

/**
 * Order-preserving assignment per contracts/grading.md §3: for every still-unclaimed expected note, in onset
 * order, among the still-unclaimed presses in its group whose tick falls inside its claim window, claim the
 * nearest. The neighbour clamp (windows.ts) guarantees adjacent claim windows never overlap, so a press can be
 * a candidate for at most one onset on each side of a shared boundary, which is exactly what makes "process in
 * onset order, claim greedily" both order-preserving and the minimum-total-distance assignment: an earlier
 * onset can never need a press that a later onset would rather have, because their windows do not overlap.
 * A press exactly at a shared boundary or equidistant between two onsets - the only ties the contract names -
 * both resolve to "the earlier onset wins", which this same onset-order processing gives for free.
 */
function runPass(
  groupKey: (key: number) => number,
  pass: ClaimPass,
  expected: readonly ExpectedNote[],
  windows: readonly ResolvedWindow[],
  presses: readonly CandidatePress[],
  claimedExpected: Set<number>,
  claimedPress: Set<number>,
  claims: Claim[],
): void {
  for (let ei = 0; ei < expected.length; ei++) {
    if (claimedExpected.has(ei)) continue;
    const note = expected[ei];
    const bounds = windows[ei];
    if (!note || !bounds) continue;
    const group = groupKey(note.key);

    let bestPressIndex = -1;
    let bestDistance = Infinity;
    for (let pi = 0; pi < presses.length; pi++) {
      if (claimedPress.has(pi)) continue;
      const press = presses[pi];
      if (!press || groupKey(press.key) !== group) continue;
      if (press.tick < note.onsetTick - bounds.claimEarlyTicks || press.tick > note.onsetTick + bounds.claimLateTicks) {
        continue;
      }
      const distance = Math.abs(press.tick - note.onsetTick);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestPressIndex = pi;
      }
    }

    if (bestPressIndex >= 0) {
      claimedExpected.add(ei);
      claimedPress.add(bestPressIndex);
      const press = presses[bestPressIndex];
      if (press) claims.push({ expectedIndex: note.index, messageIndex: press.messageIndex, pass });
    }
  }
}

/**
 * Matches a run's recorded input against its expected notes, in two passes (contracts/grading.md §3): pass 1
 * claims the same pitch, pass 2 (only for what pass 1 left unclaimed) the same pitch class - an octave error.
 * Pass 1 completes for every expected note before pass 2 considers any of them. Leftover expected notes are
 * missed; leftover candidate presses are extra. This function does not know about played-along spans (T093
 * adds a third pass on top of it) or timing results - it only decides which press claims which note.
 */
export function matchPerformance(
  expected: readonly ExpectedNote[],
  windows: readonly ResolvedWindow[],
  messages: readonly TickedMessage[],
): MatchOutcome {
  const presses = candidatePresses(messages);
  const claimedExpected = new Set<number>();
  const claimedPress = new Set<number>();
  const claims: Claim[] = [];

  runPass((key) => key, 'exact', expected, windows, presses, claimedExpected, claimedPress, claims);
  runPass((key) => key % 12, 'octave', expected, windows, presses, claimedExpected, claimedPress, claims);

  const missedIndices = expected.filter((_, i) => !claimedExpected.has(i)).map((n) => n.index);
  const extraMessageIndices = presses.filter((_, i) => !claimedPress.has(i)).map((p) => p.messageIndex);

  return { claims, missedIndices, extraMessageIndices };
}
