import { LIVE_CHANNEL } from '../defaults.js';
import type { PerformanceLog } from '../grade/types.js';
import { compileSchedule, mergeSchedules, type ScheduleMessage } from '../schedule/compile.js';
import { tickAtAudioTime } from '../tempo/rate.js';
import type { ChannelSetup, PlaybackTimeline, SoundingEvent, TempoSegment } from '../timeline/types.js';

export interface ReplayOptions {
  log: PerformanceLog;
  /** Run-tick space (0 = count-in start), matching `GradeInput.tempo` (contracts/grading.md step 1). */
  tempo: readonly TempoSegment[];
  ppq: number;
  /** `RunSettings.tempoPercent` the run used - sizes the same tick <-> second conversion grading used. */
  tempoPercent: number;
  /** 0 for a stored performance (research R-20: its log is already run-relative); the live `PlayRun`'s own value
   *  for a run just finished and not yet stored. */
  startAudioTimeSec: number;
  /** The run's own compiled schedule (`compilePlaySchedule`'s `.schedule`) - count-in, Metronome and every
   *  non-live event, exactly as the run played it (FR-042). */
  accompaniment: ScheduleMessage;
}

function emptyChannel(): ChannelSetup {
  return { used: false, program: 0, bankMsb: 0, percussion: false, volume: null, pan: null };
}

/**
 * Compiles a stored (or just-finished) performance log into a `ScheduleMessage` on the live channel's instrument,
 * merged with the run's own accompaniment (research R-10, FR-042): replay is compiled and handed to the existing
 * sample-accurate engine like any other schedule, never fired note by note from a timer (Constitution I).
 */
export function compileReplay(options: ReplayOptions): ScheduleMessage {
  const { log, tempo, ppq, tempoPercent, startAudioTimeSec, accompaniment } = options;

  const liveEvents: SoundingEvent[] = [];
  const open = new Map<number, { startTick: number; velocity: number }>();

  const closeAt = (key: number, endTick: number) => {
    const start = open.get(key);
    if (!start) return;
    open.delete(key);
    if (endTick <= start.startTick) return; // zero-length - key chatter, nothing audible to replay
    liveEvents.push({
      head: { noteId: '', passIndex: -1 },
      members: [],
      part: -1,
      channel: LIVE_CHANNEL,
      key,
      velocity: start.velocity,
      startTick: start.startTick,
      endTick,
    });
  };

  for (const message of log.messages) {
    if (message.kind === 'sustain') continue; // recorded for provenance only (FR-012); never replayed as a note
    const runTick = Math.round(tickAtAudioTime(message.audioTimeSec - startAudioTimeSec, tempo, ppq, tempoPercent));

    if (message.kind === 'noteOn') {
      if (message.velocity <= 0) continue; // a velocity-0 "noteOn" is a noteOff (contracts/grading.md step 3)
      closeAt(message.key, runTick); // an unclosed retrigger - close the held note first rather than lose it
      open.set(message.key, { startTick: runTick, velocity: message.velocity });
    } else {
      closeAt(message.key, runTick); // a noteOff with nothing open (e.g. a dropped noteOn) is simply ignored
    }
  }

  const channels = Array.from({ length: 16 }, emptyChannel);
  const liveChannel = channels[LIVE_CHANNEL];
  if (liveChannel) liveChannel.used = liveEvents.length > 0;

  const liveTimeline: PlaybackTimeline = {
    ppq,
    endTick: accompaniment.endTick,
    passes: [],
    events: liveEvents,
    spans: [],
    tempo: Array.from(tempo),
    channels,
    leadInTicks: 0,
  };

  return mergeSchedules(accompaniment, compileSchedule(liveTimeline));
}
