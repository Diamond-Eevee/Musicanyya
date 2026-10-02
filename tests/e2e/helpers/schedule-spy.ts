import type { Page } from '@playwright/test';

/** What a schedule handed to the audio engine says about one channel (worklet-protocol `channelSetup` and the note events). */
export interface LoadedChannel {
  used: boolean;
  program: number;
  noteOns: number;
}

/** A schedule the engine was asked to load: the Orchestra mask and, per channel, its program and how many notes it plays. */
export interface LoadedSchedule {
  mask: number;
  channels: LoadedChannel[];
}

/**
 * Wraps `mxSession.audioEngine.load` in the page and keeps a summary of every schedule it is given (feature 020, SC-008: the
 * same way `levels.spec.ts` wraps `setOrchestraLevel`). Install it before the Play button is pressed.
 */
export const spyOnLoadedSchedules = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const engine = (globalThis as unknown as { mxSession: { audioEngine: Record<string, (...a: unknown[]) => void> } })
      .mxSession.audioEngine;
    const seen: LoadedSchedule[] = [];
    (window as unknown as { __loadedSchedules: LoadedSchedule[] }).__loadedSchedules = seen;
    const original = engine.load as (schedule: unknown) => void;
    engine.load = function (this: unknown, schedule: unknown) {
      const s = schedule as {
        orchestraMask?: number;
        channelSetup: Uint8Array;
        eventKind: Uint8Array;
        eventChannel: Uint8Array;
      };
      const NOTE_ON = 1; // EVENT_KIND.noteOn in src/core/schedule/compile.ts
      const channels: LoadedChannel[] = [];
      for (let c = 0; c < 16; c++) {
        let noteOns = 0;
        for (let i = 0; i < s.eventKind.length; i++) {
          if (s.eventKind[i] === NOTE_ON && s.eventChannel[i] === c) noteOns++;
        }
        channels.push({ used: s.channelSetup[c * 4] === 1, program: s.channelSetup[c * 4 + 1] as number, noteOns });
      }
      seen.push({ mask: s.orchestraMask ?? 0, channels });
      return original.call(this, schedule);
    } as never;
  });

/** Every schedule the engine has been given since `spyOnLoadedSchedules`, oldest first. */
export const loadedSchedules = (page: Page): Promise<LoadedSchedule[]> =>
  page.evaluate(() => (window as unknown as { __loadedSchedules: LoadedSchedule[] }).__loadedSchedules);

/** The channels of the schedule's Orchestra mask that play at least one note, with their program. */
export const maskChannelsWithNotes = (
  schedule: LoadedSchedule,
): { channel: number; program: number; noteOns: number }[] =>
  schedule.channels.flatMap((c, channel) =>
    (schedule.mask >> channel) & 1 && c.noteOns > 0 ? [{ channel, program: c.program, noteOns: c.noteOns }] : [],
  );

/** Every used channel with the given program (the Guide voice's, `GUIDE_PROGRAM`). */
export const channelsWithProgram = (schedule: LoadedSchedule, program: number): number[] =>
  schedule.channels.flatMap((c, channel) => (c.used && c.program === program ? [channel] : []));
