import type { PracticeInput } from '../../src/core/practice/types.js';

// Format:
// "on:60@100" -> noteOn key 60 at 100ms
// "off:60@150" -> noteOff key 60 at 150ms
// "sus:down@200" -> sustain down at 200ms
// "sus:up@250" -> sustain up at 250ms
// "lost:60,64@300" -> deviceLost with held keys 60,64 at 300ms
// "lost:@300" -> deviceLost with no held keys at 300ms
// "skipNext@350" -> skipNext at 350ms
// "skipPrev@400" -> skipPrevious at 400ms
// "reqHelp@450" -> requestHelp at 450ms

export function buildSequence(compactStr: string[]): PracticeInput[] {
  return compactStr.map((str) => {
    const [actionStr, timeStr] = str.split('@');
    if (!actionStr || !timeStr) throw new Error(`Invalid compact input: ${str}`);
    const timeStampMs = parseInt(timeStr, 10);
    const parts = actionStr.split(':');
    const cmd = parts[0];

    switch (cmd) {
      case 'on':
        return { type: 'noteOn', key: parseInt(parts[1] as string, 10), velocity: 80, timeStampMs };
      case 'off':
        return { type: 'noteOff', key: parseInt(parts[1] as string, 10), timeStampMs };
      case 'sus':
        return { type: 'sustain', down: parts[1] === 'down', timeStampMs };
      case 'lost':
        return {
          type: 'deviceLost',
          heldKeys: parts[1] ? parts[1].split(',').map((n) => parseInt(n, 10)) : [],
          timeStampMs,
        };
      case 'skipNext':
        return { type: 'skipNext', timeStampMs };
      case 'skipPrev':
        return { type: 'skipPrevious', timeStampMs };
      case 'reqHelp':
        return { type: 'requestHelp', timeStampMs };
      default:
        throw new Error(`Unknown command in compact input: ${str}`);
    }
  });
}

export function stripTimestamps(inputs: readonly PracticeInput[]): PracticeInput[] {
  return inputs.map((i) => ({ ...i, timeStampMs: 0 }));
}
