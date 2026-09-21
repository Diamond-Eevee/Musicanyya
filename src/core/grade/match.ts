import { PLAY_RETRIGGER_DEBOUNCE_MS } from '../defaults.js';
import type { ExpectedNote, PlayedAlongSpan } from './types.js';
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

export interface PlayedAlongClaim {
  messageIndex: number;
  source: PlayedAlongSpan['source'];
}

export interface MatchOutcome {
  claims: readonly Claim[];
  missedIndices: readonly number[]; // ExpectedNote.index values with no claim
  playedAlong: readonly PlayedAlongClaim[];
  extraMessageIndices: readonly number[]; // message indices of note-ons that claimed and played-along nothing
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
 * Matches a run's recorded input against its expected notes, in three passes (contracts/grading.md §3, research
 * R-18): pass 1 claims the same pitch, pass 2 (only for what pass 1 left unclaimed) the same pitch class - an
 * octave error - and pass 3 (only for what is still unclaimed) checks the leftover presses against
 * `playedAlongSpans`, turning a press inside one into a `PlayedAlongClaim` instead of an extra note. Each pass
 * completes for every candidate before the next begins, so a press that could satisfy a real match always does:
 * the played-along spans only ever absorb what is genuinely left over. Leftover expected notes are missed;
 * leftover presses that no span covers either are extra.
 */
export function matchPerformance(
  expected: readonly ExpectedNote[],
  windows: readonly ResolvedWindow[],
  messages: readonly TickedMessage[],
  playedAlongSpans: readonly PlayedAlongSpan[] = [],
): MatchOutcome {
  const presses = candidatePresses(messages);
  const claimedExpected = new Set<number>();
  const claimedPress = new Set<number>();
  const claims: Claim[] = [];

  runPass((key) => key, 'exact', expected, windows, presses, claimedExpected, claimedPress, claims);
  runPass((key) => key % 12, 'octave', expected, windows, presses, claimedExpected, claimedPress, claims);

  const playedAlong: PlayedAlongClaim[] = [];
  const extraMessageIndices: number[] = [];
  for (let pi = 0; pi < presses.length; pi++) {
    if (claimedPress.has(pi)) continue;
    const press = presses[pi];
    if (!press) continue;
    const span = playedAlongSpans.find((s) => s.key === press.key && press.tick >= s.fromTick && press.tick < s.toTick);
    if (span) playedAlong.push({ messageIndex: press.messageIndex, source: span.source });
    else extraMessageIndices.push(press.messageIndex);
  }

  const missedIndices = expected.filter((_, i) => !claimedExpected.has(i)).map((n) => n.index);

  return { claims, missedIndices, playedAlong, extraMessageIndices };
}
