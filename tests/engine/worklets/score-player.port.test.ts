import { describe, expect, it } from 'vitest';
import { createPortMessageHandler, type InboundMessage } from '../../../src/engine/worklets/score-player.processor.js';

/**
 * 017 T010 (from 001 T166, Constitution I): the worklet's port handler takes whatever arrives on the port. A payload
 * that is not a message object with a string `type` is ignored - it must never throw in the handler - and every
 * other failure is reported as an error status, as before.
 */
describe('the worklet port boundary', () => {
  function setup(opts: { loadThrows?: boolean; receiveThrows?: boolean } = {}) {
    const received: InboundMessage[] = [];
    const posted: unknown[] = [];
    const loaded: unknown[] = [];
    const handle = createPortMessageHandler({
      receive: (msg) => {
        if (opts.receiveThrows) throw new Error('bad schedule');
        received.push(msg);
      },
      loadSoundBank: (bytes) => {
        if (opts.loadThrows) throw new Error('bad sound bank');
        loaded.push(bytes);
      },
      post: (msg) => posted.push(msg),
    });
    return { handle, received, posted, loaded };
  }

  for (const [label, payload] of [
    ['null', null],
    ['undefined', undefined],
    ['a number', 42],
    ['a string', 'play'],
    ['an empty object', {}],
    ['a number as type', { type: 5 }],
    ['an array', ['play']],
  ] as const) {
    it(`ignores ${label} without throwing`, () => {
      const { handle, received, posted, loaded } = setup();
      expect(() => handle(payload)).not.toThrow();
      expect(received).toEqual([]);
      expect(posted).toEqual([]);
      expect(loaded).toEqual([]);
    });
  }

  it('answers init with the initialised status', () => {
    const { handle, posted, received } = setup();
    handle({ type: 'init' });
    expect(posted).toEqual([{ type: 'status', state: 'initialised' }]);
    expect(received).toEqual([]);
  });

  it('loads a sound bank and reports it ready, or reports the error', () => {
    const ok = setup();
    const bytes = new ArrayBuffer(8);
    ok.handle({ type: 'soundBank', bytes });
    expect(ok.loaded).toEqual([bytes]);
    expect(ok.posted).toEqual([{ type: 'status', state: 'soundReady' }]);

    const bad = setup({ loadThrows: true });
    expect(() => bad.handle({ type: 'soundBank', bytes })).not.toThrow();
    expect(bad.posted).toEqual([{ type: 'status', state: 'error', detail: 'bad sound bank' }]);
  });

  it('passes every other message to the processor, and reports its failure instead of throwing', () => {
    const ok = setup();
    ok.handle({ type: 'play', fromTick: 0 });
    expect(ok.received).toEqual([{ type: 'play', fromTick: 0 }]);

    const bad = setup({ receiveThrows: true });
    expect(() => bad.handle({ type: 'schedule' })).not.toThrow();
    expect(bad.posted).toEqual([{ type: 'status', state: 'error', detail: 'bad schedule' }]);
  });
});
