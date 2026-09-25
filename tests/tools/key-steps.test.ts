import { describe, expect, it } from 'vitest';
import { keyStepBytes, parseKeySteps } from '../../tools/dev/key-steps.js';

describe('key step script (008 T003/T004)', () => {
  it('parses down, up and wait steps in order, ignoring blanks and spaces', () => {
    expect(parseKeySteps('+76, -76,wait,,+75')).toEqual([
      { kind: 'down', key: 76 },
      { kind: 'up', key: 76 },
      { kind: 'wait' },
      { kind: 'down', key: 75 },
    ]);
  });

  it('accepts an empty list', () => {
    expect(parseKeySteps('')).toEqual([]);
  });

  it.each(['76', '+', '+x', '+128', '++76', 'wai', '*60'])('rejects the bad step "%s" by name', (bad) => {
    expect(() => parseKeySteps(`+60,${bad}`)).toThrow(`Bad key step "${bad}"`);
  });

  it('parses sleep:<ms> as a wall-clock wait between the other steps (009 T003)', () => {
    expect(parseKeySteps('+76,sleep:500,-76, sleep:1 ,sleep:60000')).toEqual([
      { kind: 'down', key: 76 },
      { kind: 'sleep', ms: 500 },
      { kind: 'up', key: 76 },
      { kind: 'sleep', ms: 1 },
      { kind: 'sleep', ms: 60000 },
    ]);
  });

  it.each(['sleep:0', 'sleep:-5', 'sleep:abc', 'sleep:60001', 'sleep:', 'sleep:1.5', 'sleep'])(
    'rejects the bad sleep step "%s" by name',
    (bad) => {
      expect(() => parseKeySteps(`+60,${bad}`)).toThrow(`Bad key step "${bad}"`);
    },
  );

  it('maps a step to the raw MIDI bytes of the e2e-midi event', () => {
    expect(keyStepBytes({ kind: 'down', key: 76 })).toEqual([0x90, 76, 100]);
    expect(keyStepBytes({ kind: 'up', key: 76 })).toEqual([0x80, 76, 0]);
  });
});
