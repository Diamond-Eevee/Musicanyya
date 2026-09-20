import { tickAtAudioTime } from '../tempo/rate.js';
import { effectiveQpm, tempoAtTick } from '../tempo/tempo-map.js';
import type { MeasurePass } from '../timeline/types.js';
import type { TickedMessage } from './match.js';
import { matchPerformance } from './match.js';
import type { TickedReliabilityEvent } from './summary.js';
import { computeSummary } from './summary.js';
import type { ExtraNote, Grade, GradeInput, NoteResult, PlayedAlongPress, ResultReason } from './types.js';
import { resolveWindows } from './windows.js';

function ticksToMs(ticks: number, qpm: number, ppq: number): number {
  return (ticks / ppq) * (60 / qpm) * 1000;
}

function passAtTick(passes: readonly MeasurePass[], tick: number): { measureIndex: number; passIndex: number } {
  for (let i = 0; i < passes.length; i++) {
    const pass = passes[i];
    if (pass && tick >= pass.startTick && tick < pass.startTick + pass.lengthTicks) {
      return { measureIndex: pass.measureIndex, passIndex: i };
    }
  }
  return { measureIndex: 0, passIndex: 0 };
}

function reasonFor(
  pitch: NoteResult['pitch'],
  timing: NoteResult['timing'],
  expectedKey: number,
  playedKey: number | null,
  deltaMs: number | null,
): ResultReason {
  if (pitch === 'missed') {
    return { code: 'missedNothingPlayed', expectedKey, playedKey: null, octaveDelta: null, deltaMs: null };
  }
  if (pitch === 'wrongPitch') {
    const octaveDelta = playedKey !== null ? Math.round((playedKey - expectedKey) / 12) : null;
    return {
      code: octaveDelta !== null && octaveDelta > 0 ? 'wrongOctaveHigh' : 'wrongOctaveLow',
      expectedKey,
      playedKey,
      octaveDelta,
      deltaMs,
    };
  }
  const code = timing === 'onTime' ? 'correctOnTime' : timing === 'early' ? 'earlyBy' : 'lateBy';
  return { code, expectedKey, playedKey, octaveDelta: null, deltaMs };
}

/**
 * Grades a recorded performance against its expected notes (contracts/grading.md). Pure and synchronous: same
 * Score + log + settings always gives the same Grade, including every reason (FR-025, SC-001).
 */
export function gradePerformance(input: GradeInput): Grade {
  const {
    runId,
    complete,
    expected,
    playedAlong,
    log,
    tempo,
    ppq,
    tickMap,
    startAudioTimeSec,
    settings,
    latency,
    reliability,
    passes,
    measures,
  } = input;
  const compensationSec = (latency.outputLatencyMs + latency.inputLatencyMs) / 1000;

  // Step 1: put everything on one (timeline-tick) axis, then sort by (tick, key) - arrival order never matters.
  const ticked: TickedMessage[] = log.messages.map((m) => {
    const correctedAudioTime = m.audioTimeSec - compensationSec;
    const runTick = tickAtAudioTime(correctedAudioTime - startAudioTimeSec, tempo, ppq, settings.tempoPercent);
    const timelineTick = runTick - tickMap.countInTicks + tickMap.rangeStartTick;
    return { kind: m.kind, key: m.key, velocity: m.velocity, tick: timelineTick, audioTimeSec: m.audioTimeSec };
  });
  ticked.sort((a, b) => (a.tick !== b.tick ? a.tick - b.tick : a.key - b.key));

  // Step 2: resolve windows, then the count-in filter (D-4): "no press earlier than
  // firstOnsetTick - claimEarly(first)". The upper bound (claimLate(last) past the final onset) is the run's
  // own recording boundary, already reflected in what `log` contains by the time grading runs.
  const windows = resolveWindows(expected, measures, tempo, ppq, settings.tempoPercent, settings.strictness);
  const first = expected[0];
  const firstWindow = windows[0];
  const lowerBoundTick = first && firstWindow ? first.onsetTick - firstWindow.claimEarlyTicks : -Infinity;
  const messages = ticked.filter((m) => m.tick >= lowerBoundTick);

  // Step 3: match (passes 1, 2, and 3 for played-along spans).
  const {
    claims,
    playedAlong: playedAlongClaims,
    extraMessageIndices,
  } = matchPerformance(expected, windows, messages, playedAlong);
  const claimByExpectedIndex = new Map(claims.map((c) => [c.expectedIndex, c]));

  // Step 4: timing, reasons - one NoteResult per expected note (FR-018).
  const results: NoteResult[] = expected.map((note, i) => {
    const claim = claimByExpectedIndex.get(note.index);
    if (!claim) {
      return {
        expectedIndex: note.index,
        noteIds: note.noteIds,
        pitch: 'missed',
        timing: null,
        playedKey: null,
        deltaTicks: null,
        deltaMs: null,
        reason: reasonFor('missed', null, note.key, null, null),
      };
    }
    const message = messages[claim.messageIndex];
    if (!message) throw new Error('grade.ts: claim referenced a message that does not exist');

    const deltaTicks = message.tick - note.onsetTick;
    const bounds = windows[i];
    const onTimeEarly = bounds?.onTimeEarlyTicks ?? 0;
    const onTimeLate = bounds?.onTimeLateTicks ?? 0;
    const timing =
      deltaTicks < 0 ? (-deltaTicks <= onTimeEarly ? 'onTime' : 'early') : deltaTicks <= onTimeLate ? 'onTime' : 'late';
    const qpm = effectiveQpm(tempoAtTick(tempo, note.onsetTick), settings.tempoPercent);
    const deltaMs = ticksToMs(deltaTicks, qpm, ppq);
    const pitch = claim.pass === 'exact' ? 'correct' : 'wrongPitch';

    return {
      expectedIndex: note.index,
      noteIds: note.noteIds,
      pitch,
      timing,
      playedKey: message.key,
      deltaTicks,
      deltaMs,
      reason: reasonFor(pitch, timing, note.key, message.key, deltaMs),
    };
  });

  // Leftover presses: extra notes.
  const extras: ExtraNote[] = extraMessageIndices.map((messageIndex) => {
    const message = messages[messageIndex];
    if (!message) throw new Error('grade.ts: extra referenced a message that does not exist');
    const { measureIndex, passIndex } = passAtTick(passes, message.tick);
    return {
      key: message.key,
      audioTimeSec: message.audioTimeSec,
      atTick: message.tick,
      measureIndex,
      passIndex,
      reason: {
        code: 'extraNoNoteWritten',
        expectedKey: null,
        playedKey: message.key,
        octaveDelta: null,
        deltaMs: null,
      },
    };
  });

  // Played-along presses: information only, counted in nothing.
  const playedAlongPresses: PlayedAlongPress[] = playedAlongClaims.map((p) => {
    const message = messages[p.messageIndex];
    if (!message) throw new Error('grade.ts: played-along claim referenced a message that does not exist');
    const { measureIndex, passIndex } = passAtTick(passes, message.tick);
    return { key: message.key, atTick: message.tick, measureIndex, passIndex, source: p.source };
  });

  // Reliability events, on the same tick axis (no latency compensation: these are engine events, not input).
  const tickedReliability: TickedReliabilityEvent[] = reliability.map((event) => {
    const runTick = tickAtAudioTime(event.audioTimeSec - startAudioTimeSec, tempo, ppq, settings.tempoPercent);
    return { kind: event.kind, tick: runTick - tickMap.countInTicks + tickMap.rangeStartTick };
  });

  const windowNotResolvable = windows.map((w) => w.timingNotResolvable);
  const {
    summary,
    measures: measureOverview,
    reliability: reliabilityWarnings,
  } = computeSummary(expected, results, extras, tickedReliability, passes, windowNotResolvable);

  return {
    runId,
    complete,
    results,
    extras,
    playedAlong: playedAlongPresses,
    summary,
    measures: measureOverview,
    reliability: reliabilityWarnings,
    settings,
    latency,
  };
}
