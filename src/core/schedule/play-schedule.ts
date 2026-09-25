import { COUNT_IN_INCLUDES_ANACRUSIS, COUNT_IN_MIN_SECONDS, METRONOME_CHANNEL } from '../defaults.js';
import type { PlayScheduleOptions, PlayTickMap } from '../play/types.js';
import type { MeasureInfo } from '../score/model.js';
import { audioTimeAtTick } from '../tempo/rate.js';
import { tempoAtTick } from '../tempo/tempo-map.js';
import { beatsPerMeasure, beatTicksAt } from '../timeline/beat.js';
import type { PlaybackTimeline, SoundingEvent, TempoSegment } from '../timeline/types.js';
import { compileSchedule, type ScheduleMessage } from './compile.js';

export interface PlaySchedule {
  schedule: ScheduleMessage;
  tickMap: PlayTickMap;
  expectedFirstRunTick: number;
}

/**
 * The measures with the meter in force written into each one: the Score model keeps `time` only where a `<time>` is written
 * (003 data-model section 2: "a measure with no `time` inherits the previous one"), so a piece in 3/4 or 6/8 has
 * `time: null` from its second measure on, and `beatTicksAt` / `beatsPerMeasure` would read that as the 4/4 default.
 */
function withMeterInForce(measures: readonly MeasureInfo[]): MeasureInfo[] {
  let inForce: MeasureInfo['time'] = null;
  return measures.map((m) => {
    if (m.time) inForce = m.time;
    return m.time || !inForce ? m : { ...m, time: inForce };
  });
}

function endOfPass(timeline: PlaybackTimeline, passIndex: number): number {
  const pass = timeline.passes[passIndex];
  return pass ? pass.startTick + pass.lengthTicks : timeline.endTick;
}

/**
 * Compiles a run's own schedule (contracts/play-run.md, research R-03): the graded notes dropped, the range
 * sliced out, the count-in in front and the Metronome as ordinary events on `METRONOME_CHANNEL`. Reuses
 * `compileSchedule` for the actual `ScheduleMessage` encoding, so the output satisfies the worklet-protocol
 * ordering rules for free (rule 6).
 *
 * `measures` (Score.measures, not the timeline) is where meter and pickup information live - play-run.md 1.1.1.
 */
export function compilePlaySchedule(
  timeline: PlaybackTimeline,
  measures: readonly MeasureInfo[],
  options: PlayScheduleOptions,
): PlaySchedule {
  // Rule 5 (asserted upstream by src/core/timeline/instruments.ts reserving METRONOME_CHANNEL, R-19): a loud
  // failure here is safer than silently dropping a Score part's accompaniment.
  for (const ev of timeline.events) {
    if (ev.channel === METRONOME_CHANNEL) {
      throw new Error(
        'A Score event was allocated to METRONOME_CHANNEL; the channel allocator must reserve it (R-19).',
      );
    }
  }

  const rangeStartTick = options.range ? (timeline.passes[options.range.fromPassIndex]?.startTick ?? 0) : 0;
  const rangeEndTick = options.range ? endOfPass(timeline, options.range.toPassIndex - 1) : timeline.endTick;
  const firstMeasureIndex = options.range
    ? (timeline.passes[options.range.fromPassIndex]?.measureIndex ?? 0)
    : (timeline.passes[0]?.measureIndex ?? 0);

  const inForce = withMeterInForce(measures);
  const measure = inForce[firstMeasureIndex];
  const anacrusisTicks = COUNT_IN_INCLUDES_ANACRUSIS ? (measure?.beatOffsetTicks ?? 0) : 0;
  const beatTicks = beatTicksAt(firstMeasureIndex, inForce, timeline.ppq);
  const beatsInMeasure = beatsPerMeasure(firstMeasureIndex, inForce);
  // A Score without <time> has nominalTicks 0 (009 T056): count in whole measures of the default the beat helpers
  // already use for it (4 beats), so the loop below always grows and a file can never hang the app.
  const nominalTicks = measure && measure.nominalTicks > 0 ? measure.nominalTicks : beatTicks * beatsInMeasure;
  const startTempo = tempoAtTick(timeline.tempo, rangeStartTick);

  // Sized against the tempo actually played (FR-037): a single-segment tempo map through the shared conversion
  // (src/core/tempo/rate.ts) so the count-in lasts COUNT_IN_MIN_SECONDS of real time, not of nominal time.
  const secondsOf = (ticks: number) =>
    audioTimeAtTick(
      ticks,
      [{ startTick: 0, qpmNum: startTempo.qpmNum, qpmDen: startTempo.qpmDen }],
      timeline.ppq,
      options.tempoPercent,
    );

  let measureCount = Math.max(1, options.countInMeasures);
  while (secondsOf(measureCount * nominalTicks) < COUNT_IN_MIN_SECONDS) measureCount++;

  const countInMeasuresTicks = measureCount * nominalTicks;
  const countInTicks = countInMeasuresTicks + anacrusisTicks;

  // Click ticks: one per beat inside the count-in measures (the downbeat of each accented), then the pickup's
  // missing beats after them, unaccented - the notional downbeat of the run's first measure is never itself a
  // click, because the music that starts there is the downbeat (data-model.md §2).
  const clicks: { tick: number; downbeat: boolean }[] = [];
  const totalMeasureBeats = measureCount * beatsInMeasure;
  for (let i = 0; i < totalMeasureBeats; i++) {
    clicks.push({ tick: i * beatTicks, downbeat: i % beatsInMeasure === 0 });
  }
  for (let tick = countInMeasuresTicks; tick < countInTicks; tick += beatTicks) {
    clicks.push({ tick, downbeat: false });
  }

  const shift = countInTicks - rangeStartTick;

  // The run's own clicks (009 R-14, FR-009 to FR-011): one per beat of every pass in range, in the pass's own meter, the
  // measure's first beat accented. A pickup starts on its own beat (its first click is beat `offset + 1`, not accented), as
  // the count-in above already told the musician. The pass structure carries repeats, jumps and every meter change, and the
  // clicks go through the same tick-to-frame conversion as the notes, so tempo changes and the tempo percentage apply.
  const firstPass = options.range ? options.range.fromPassIndex : 0;
  const endPass = options.range ? options.range.toPassIndex : timeline.passes.length;
  for (const pass of timeline.passes.slice(firstPass, endPass)) {
    const beat = beatTicksAt(pass.measureIndex, inForce, timeline.ppq);
    const perMeasure = beatsPerMeasure(pass.measureIndex, inForce);
    const pickup = pass.measureIndex === 0 && inForce[0]?.implicit === true;
    const offsetBeats = pickup ? Math.round((inForce[0]?.beatOffsetTicks ?? 0) / beat) : 0;
    for (let k = 0; k * beat < pass.lengthTicks; k++) {
      clicks.push({ tick: pass.startTick + shift + k * beat, downbeat: (offsetBeats + k) % perMeasure === 0 });
    }
  }

  const keptEvents: SoundingEvent[] = [];
  for (const ev of timeline.events) {
    if (ev.startTick < rangeStartTick || ev.startTick >= rangeEndTick) continue;
    const isGraded = ev.members.some((id) => options.gradedNoteIds.has(id));
    if (isGraded) continue;
    if (!options.accompaniment) continue;
    keptEvents.push({ ...ev, startTick: ev.startTick + shift, endTick: ev.endTick + shift });
  }

  const metronomeEvents: SoundingEvent[] = clicks.map((c) => ({
    head: { noteId: '', passIndex: -1 },
    members: [],
    part: -1,
    channel: METRONOME_CHANNEL,
    key: c.downbeat ? options.metronome.downbeatKey : options.metronome.beatKey,
    velocity: c.downbeat ? options.metronome.downbeatVelocity : options.metronome.beatVelocity,
    startTick: c.tick,
    endTick: c.tick + 1,
  }));

  // Rule 4: the tempo map is shifted the same way, and the segment covering the count-in is the tempo in force
  // at rangeStartTick.
  const shiftedTempo: TempoSegment[] = [];
  const startSeg = tempoAtTick(timeline.tempo, rangeStartTick);
  shiftedTempo.push({ startTick: 0, qpmNum: startSeg.qpmNum, qpmDen: startSeg.qpmDen });
  for (const seg of timeline.tempo) {
    if (seg.startTick > rangeStartTick && seg.startTick < rangeEndTick) {
      shiftedTempo.push({ startTick: seg.startTick + shift, qpmNum: seg.qpmNum, qpmDen: seg.qpmDen });
    }
  }

  const channels = timeline.channels.map((ch, i) =>
    i === METRONOME_CHANNEL ? { ...ch, used: true, percussion: true } : ch,
  );

  const runTimeline: PlaybackTimeline = {
    ppq: timeline.ppq,
    endTick: countInTicks + (rangeEndTick - rangeStartTick),
    passes: [],
    events: [...keptEvents, ...metronomeEvents],
    spans: [],
    tempo: shiftedTempo,
    channels,
    leadInTicks: 0,
  };

  const schedule = compileSchedule(runTimeline);
  const tickMap: PlayTickMap = { countInTicks, rangeStartTick, rangeEndTick, ppq: timeline.ppq };

  return { schedule, tickMap, expectedFirstRunTick: countInTicks };
}
