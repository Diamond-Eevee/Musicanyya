import type { LoadNoticeCode } from '../score/load-report.js';
import type { Note, NoteId, Score } from '../score/model.js';
import { buildTempoMap } from '../tempo/tempo-map.js';
import {
  buildDynamicsBaseline,
  buildWedgeSpans,
  findWedgeAt,
  resolveNoteVelocity,
  velocityInWedge,
} from './dynamics.js';
import type { GraceInput, TimedNote } from './grace.js';
import { computeGraceTiming } from './grace.js';
import { assignChannels, channelForNote, instrumentForNote, soundingKeyForNote } from './instruments.js';
import type { TieOccurrence } from './ties.js';
import { resolveTies } from './ties.js';
import type { PlaybackTimeline, SoundingEvent, VisualSpan } from './types.js';
import { unroll } from './unroll.js';

export interface TimelineNotice {
  code: LoadNoticeCode;
  detail?: string;
}

export interface TimelineResult {
  timeline: PlaybackTimeline;
  notices: TimelineNotice[];
}

function occKey(noteId: NoteId, passIndex: number): string {
  return `${noteId}#${passIndex}`;
}

interface OccMeta {
  note: Note;
  part: number;
  passIndex: number;
}

/**
 * Compiles a Score into a PlaybackTimeline: unrolls repeats/jumps, places grace notes, resolves
 * ties, assigns channels and velocities, and produces the sorted sounding events and per-notehead
 * visual spans the engine schedule and UI highlighting are built from.
 */
export function buildTimeline(score: Score): TimelineResult {
  const notices: TimelineNotice[] = [];
  const { passes, notices: unrollNotices } = unroll(score.measures, score.navigation);
  for (const n of unrollNotices)
    notices.push(n.detail !== undefined ? { code: n.code, detail: n.detail } : { code: n.code });

  const tempo = buildTempoMap(score.tempoMarks, passes);
  const assignment = assignChannels(score.parts);

  const passesByMeasure = new Map<number, { passIndex: number; startTick: number }[]>();
  passes.forEach((p, passIndex) => {
    const arr = passesByMeasure.get(p.measureIndex);
    if (arr) arr.push({ passIndex, startTick: p.startTick });
    else passesByMeasure.set(p.measureIndex, [{ passIndex, startTick: p.startTick }]);
  });

  const metaByKey = new Map<string, OccMeta>();
  const timedByKey = new Map<string, TimedNote>();
  let globalLeadIn = 0;

  for (const part of score.parts) {
    const inputs: GraceInput[] = [];
    for (const note of part.notes) {
      const occs = passesByMeasure.get(note.measureIndex) ?? [];
      for (const occ of occs) {
        const key = occKey(note.id, occ.passIndex);
        metaByKey.set(key, { note, part: part.index, passIndex: occ.passIndex });
        inputs.push({
          noteId: key,
          part: part.index,
          voice: `${note.staff}:${note.voice}`,
          nominalTick: occ.startTick + note.onsetInMeasure,
          graceIndex: note.grace ? note.grace.index : null,
          stealPrevious: note.grace?.stealPrevious ?? null,
          stealFollowing: note.grace?.stealFollowing ?? null,
          durationTicks: note.durationTicks,
        });
      }
    }
    const { timed, leadInTicks } = computeGraceTiming(inputs, score.ppq);
    globalLeadIn = Math.max(globalLeadIn, leadInTicks);
    for (const t of timed) timedByKey.set(t.noteId, t);
  }

  // Dynamics baselines and wedge spans are computed on the same (pre-shift) tick axis as grace timing.
  const baselineByPart = new Map<number, ReturnType<typeof buildDynamicsBaseline>>();
  const wedgesByPart = new Map<number, ReturnType<typeof buildWedgeSpans>>();
  for (const part of score.parts) {
    const baseline = buildDynamicsBaseline(part, passes);
    baselineByPart.set(part.index, baseline);
    wedgesByPart.set(part.index, buildWedgeSpans(part, passes, baseline, score.ppq));
  }

  const tieOccurrences: TieOccurrence[] = [];
  for (const [key, meta] of metaByKey) {
    const timed = timedByKey.get(key);
    if (!timed) continue;
    tieOccurrences.push({
      noteId: key,
      passIndex: meta.passIndex,
      part: meta.part,
      soundingKey: meta.note.soundingKey,
      startTick: timed.startTick,
      endTick: timed.endTick,
      tieStart: meta.note.tie.start,
      tieStop: meta.note.tie.stop,
    });
  }

  const { chains, notices: tieNotices } = resolveTies(tieOccurrences);
  for (const n of tieNotices) notices.push({ code: n.code, detail: n.noteId });

  const events: SoundingEvent[] = [];
  const spans: VisualSpan[] = [];

  for (const chain of chains) {
    for (const member of chain.members) {
      const meta = metaByKey.get(member.noteId);
      if (!meta) continue;
      spans.push({ noteId: meta.note.id, startTick: member.startTick, endTick: member.endTick });
    }

    const headOcc = chain.members[0];
    if (!headOcc) continue;
    const meta = metaByKey.get(headOcc.noteId);
    if (!meta) continue;
    const part = score.parts.find((p) => p.index === meta.part);
    if (!part) continue;

    const instrument = instrumentForNote(part, meta.note);
    const key = soundingKeyForNote(meta.note, instrument);
    if (key === null) {
      notices.push({ code: 'unpitchedWithoutSound', detail: meta.note.id });
      continue;
    }
    if (!instrument) continue;

    const baseline = baselineByPart.get(part.index) ?? [];
    const wedges = wedgesByPart.get(part.index) ?? [];
    const wedge = findWedgeAt(wedges, chain.startTick);
    const velocity = resolveNoteVelocity({
      velocityOverride: meta.note.velocityOverride,
      accent: meta.note.accent,
      tick: chain.startTick,
      baseline,
      wedgeVelocity: wedge ? velocityInWedge(wedge, chain.startTick) : null,
    });

    events.push({
      head: { noteId: meta.note.id, passIndex: meta.passIndex },
      members: chain.members.map((m) => metaByKey.get(m.noteId)?.note.id ?? meta.note.id),
      part: part.index,
      channel: channelForNote(assignment, part, instrument),
      key,
      velocity,
      startTick: chain.startTick,
      endTick: chain.endTick,
    });
  }

  events.sort((a, b) => a.startTick - b.startTick);
  spans.sort((a, b) => a.startTick - b.startTick);

  const shiftedEvents = shiftEvents(events, globalLeadIn);
  const shiftedSpans = shiftSpans(spans, globalLeadIn);
  const shiftedTempo = tempo.map((t) => ({ ...t, startTick: t.startTick + globalLeadIn }));
  const shiftedPasses = passes.map((p) => ({ ...p, startTick: p.startTick + globalLeadIn }));

  const endTick = Math.max(
    globalLeadIn,
    ...shiftedEvents.map((e) => e.endTick),
    ...shiftedPasses.map((p) => p.startTick + p.lengthTicks),
  );

  const timeline: PlaybackTimeline = {
    ppq: score.ppq,
    endTick,
    passes: shiftedPasses,
    events: shiftedEvents,
    spans: shiftedSpans,
    tempo: shiftedTempo,
    channels: assignment.channelSetup,
    leadInTicks: globalLeadIn,
  };

  return { timeline, notices };
}

function shiftEvents(events: SoundingEvent[], by: number): SoundingEvent[] {
  if (by === 0) return events;
  return events.map((e) => ({ ...e, startTick: e.startTick + by, endTick: e.endTick + by }));
}
function shiftSpans(spans: VisualSpan[], by: number): VisualSpan[] {
  if (by === 0) return spans;
  return spans.map((s) => ({ ...s, startTick: s.startTick + by, endTick: s.endTick + by }));
}
