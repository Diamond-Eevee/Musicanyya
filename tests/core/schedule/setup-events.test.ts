import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import type { PlayScheduleOptions } from '../../../src/core/play/types.js';
import { compileSchedule, EVENT_KIND, type ScheduleMessage } from '../../../src/core/schedule/compile.js';
import { compilePlaySchedule } from '../../../src/core/schedule/play-schedule.js';
import { buildTimeline } from '../../../src/core/timeline/timeline.js';
import { decodeXml } from '../../../src/engine/files/decode.js';
import { readMxl } from '../../../src/engine/files/mxl.js';

// 009 research R-01, guard test. The worklet applies a schedule's channel setup in its message handler and keeps
// ignoring event kinds 2 (programChange) and 3 (controlChange) in `process()`. That is only correct while the compilers
// emit those two kinds at tick 0 and nowhere else: a controller or program change later in a schedule would be dropped
// silently. This test pins the invariant; it is expected to PASS on today's code (it is a guard, not a failing test).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const fixturesDir = path.join(root, 'tests/fixtures/musicxml');
const libraryDir = path.join(root, 'public/library');

const METRONOME = { beatKey: 77, downbeatKey: 76, beatVelocity: 88, downbeatVelocity: 110 };
const PLAY_OPTIONS: PlayScheduleOptions = {
  range: null,
  gradedNoteIds: new Set(),
  accompaniment: true,
  countInMeasures: 1,
  tempoPercent: 100,
  metronome: METRONOME,
};

function collect(dir: string, into: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, into);
    else if (/\.(musicxml|xml|mxl)$/i.test(entry.name)) into.push(full);
  }
}

function files(): string[] {
  const found: string[] = [];
  collect(fixturesDir, found);
  const index = JSON.parse(fs.readFileSync(path.join(libraryDir, 'index.json'), 'utf8')) as {
    items: { file: string }[];
  };
  for (const item of index.items) found.push(path.join(libraryDir, item.file));
  return found;
}

/** Every kind-2/3 event's tick that is not 0, as `file: kind at tick`. */
function lateSetupEvents(schedule: ScheduleMessage): number[] {
  const late: number[] = [];
  for (let i = 0; i < schedule.eventKind.length; i++) {
    const kind = schedule.eventKind[i];
    if ((kind === EVENT_KIND.programChange || kind === EVENT_KIND.controlChange) && schedule.eventTick[i] !== 0) {
      late.push(schedule.eventTick[i] as number);
    }
  }
  return late;
}

describe('program and controller events only occur at tick 0 (009 research R-01)', () => {
  it('holds for compileSchedule and compilePlaySchedule on every fixture and every library item', async () => {
    const all = files();
    const violations: string[] = [];
    let compiled = 0;
    let setupEvents = 0;

    for (const file of all) {
      let bytes: Uint8Array = fs.readFileSync(file);
      let timeline: ReturnType<typeof buildTimeline>['timeline'];
      let measures: ReturnType<typeof buildScore>['score']['measures'];
      try {
        if (file.toLowerCase().endsWith('.mxl')) bytes = await readMxl(bytes);
        const { doc } = readXml(decodeXml(bytes));
        const { score } = buildScore(doc);
        measures = score.measures;
        timeline = buildTimeline(score).timeline;
      } catch {
        continue; // the corpus holds deliberately invalid files; they never reach a schedule
      }

      const schedules: [string, ScheduleMessage][] = [];
      try {
        schedules.push(['compileSchedule', compileSchedule(timeline)]);
        schedules.push(['compilePlaySchedule', compilePlaySchedule(timeline, measures, PLAY_OPTIONS).schedule]);
      } catch {
        continue; // a Score the compilers refuse (too long, a part on the Metronome channel) has no schedule to check
      }
      compiled++;
      for (const [name, schedule] of schedules) {
        for (let i = 0; i < schedule.eventKind.length; i++) {
          const kind = schedule.eventKind[i];
          if (kind === EVENT_KIND.programChange || kind === EVENT_KIND.controlChange) setupEvents++;
        }
        const late = lateSetupEvents(schedule);
        if (late.length > 0)
          violations.push(`${path.relative(root, file)}: ${name} has setup events at ticks ${late.join(',')}`);
      }
    }

    expect(violations).toEqual([]);
    // not vacuous: many files compiled, and they did carry setup events
    expect(compiled).toBeGreaterThan(150);
    expect(setupEvents).toBeGreaterThan(compiled);
  }, 120_000);
});
