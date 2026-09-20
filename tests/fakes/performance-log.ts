import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PerformanceLog, RecordedMessage } from '../../src/core/grade/types.js';
import type { RunSettings } from '../../src/core/play/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STEP_TO_CLASS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function pitchToKey(name: string): number {
  const m = /^([A-Ga-g])([#sb]?)(-?\d+)$/.exec(name);
  if (!m) throw new Error(`Invalid pitch name: ${name}`);
  const [, step, accidental, octaveStr] = m as unknown as [string, string, string, string];
  const pc = STEP_TO_CLASS[step.toUpperCase()] ?? 0;
  const alter = accidental === '#' || accidental === 's' ? 1 : accidental === 'b' ? -1 : 0;
  return (parseInt(octaveStr, 10) + 1) * 12 + pc + alter;
}

export interface PerformanceLogOptions {
  qpm: number; // tempo used to convert beat offsets to seconds
  startAudioTimeSec?: number; // audio time of beat 0; default 0
  velocity?: number; // note-on velocity; default 80
  durationBeats?: number; // note-off offset after onset, in beats; default 0.5
  deviceId?: string; // default 'fake-keyboard'
}

const NOTE_PATTERN = /^([A-Ga-g][#sb]?-?\d+)@(-?\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)?$/;

/**
 * Compact notation: `"<pitch>@<beat>[+-<errorMs>]"`, e.g. `"C4@0"` (on time), `"F#4@2+40"` (beat 2, 40 ms late),
 * `"Bb3@1.5-25"` (beat 1.5, 25 ms early). Each entry becomes a noteOn/noteOff pair.
 */
export function buildPerformanceLog(notes: readonly string[], options: PerformanceLogOptions): PerformanceLog {
  const { qpm, startAudioTimeSec = 0, velocity = 80, durationBeats = 0.5, deviceId = 'fake-keyboard' } = options;
  const secondsPerBeat = 60 / qpm;
  const messages: RecordedMessage[] = [];
  for (const entry of notes) {
    const m = NOTE_PATTERN.exec(entry);
    if (!m) throw new Error(`Invalid compact performance note: ${entry}`);
    const [, pitch, beatStr, errorStr] = m as unknown as [string, string, string, string | undefined];
    const key = pitchToKey(pitch);
    const beat = parseFloat(beatStr);
    const errorMs = errorStr ? parseFloat(errorStr) : 0;
    const onsetSec = startAudioTimeSec + beat * secondsPerBeat + errorMs / 1000;
    const offsetSec = onsetSec + durationBeats * secondsPerBeat;
    messages.push({
      kind: 'noteOn',
      key,
      velocity,
      down: false,
      audioTimeSec: onsetSec,
      timeStampMs: onsetSec * 1000,
      deviceId,
    });
    messages.push({
      kind: 'noteOff',
      key,
      velocity: 0,
      down: false,
      audioTimeSec: offsetSec,
      timeStampMs: offsetSec * 1000,
      deviceId,
    });
  }
  messages.sort((a, b) => a.audioTimeSec - b.audioTimeSec);
  return { version: 1, messages, droppedMessages: 0 };
}

/**
 * Reorders messages that share an identical `audioTimeSec` (adjacent groups only - the log must already be
 * sorted), so a test can assert the matcher's outcome is independent of arrival order (FR-019, invariant 4)
 * without changing what was actually played.
 */
export function shuffleSimultaneous(log: PerformanceLog): PerformanceLog {
  const messages = [...log.messages];
  let i = 0;
  while (i < messages.length) {
    let j = i + 1;
    while (j < messages.length && messages[j]?.audioTimeSec === messages[i]?.audioTimeSec) j++;
    if (j - i > 1) messages.splice(i, j - i, ...messages.slice(i, j).reverse());
    i = j;
  }
  return { ...log, messages };
}

export interface RecordedPerformanceFixture {
  scoreFixture: string; // filename under tests/fixtures/musicxml/
  settings: RunSettings;
  log: PerformanceLog;
}

/** Loads one of the JSON fixtures of contracts/performance-log.md format from tests/fixtures/performances/. */
export function loadRecordedPerformance(name: string): RecordedPerformanceFixture {
  const fixturesDir = path.join(__dirname, '../fixtures/performances');
  const raw = fs.readFileSync(path.join(fixturesDir, name), 'utf-8');
  return JSON.parse(raw) as RecordedPerformanceFixture;
}
