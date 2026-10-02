import type { Page } from '@playwright/test';

/** One `type: 'live'` message posted to the worklet (worklet-protocol `live`): its kind and key, and when it was posted. */
export interface LiveMessage {
  kind: 'on' | 'off' | 'sustain' | 'allOff';
  key: number | null;
  /** `performance.now()` in the page when the message was posted to the worklet port (feature 021 SC-004). */
  at: number;
}

type EngineInternals = {
  node: { port: { postMessage: (...a: unknown[]) => void } } | null;
  context: AudioContext | null;
};
type SpyWindow = Window & { __liveMessages?: LiveMessage[]; mxSession?: { audioEngine: EngineInternals } };

/**
 * Wraps the engine's worklet node `port.postMessage` and records `{ kind, key, at }` of every `type: 'live'` message
 * (feature 021, modelled on `schedule-spy.ts`). It works before the node exists too: the engine's `node` field is hooked
 * so that a node created later is wrapped as it is assigned. Install it before the first MIDI message.
 */
export const spyOnLiveMessages = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const w = window as SpyWindow;
    const engine = w.mxSession?.audioEngine;
    if (!engine) throw new Error('mxSession.audioEngine is not on the page');
    const seen: LiveMessage[] = [];
    w.__liveMessages = seen;
    const wrap = (node: EngineInternals['node']) => {
      if (!node) return;
      const port = node.port as typeof node.port & { __spied?: boolean };
      if (port.__spied) return;
      port.__spied = true;
      const original = port.postMessage.bind(port);
      port.postMessage = (message: unknown, ...rest: unknown[]) => {
        const m = message as { type?: string; kind?: LiveMessage['kind']; key?: number };
        if (m?.type === 'live' && m.kind !== undefined) {
          seen.push({ kind: m.kind, key: typeof m.key === 'number' ? m.key : null, at: performance.now() });
        }
        return original(message, ...rest);
      };
    };
    let current = engine.node;
    wrap(current);
    Object.defineProperty(engine, 'node', {
      configurable: true,
      get: () => current,
      set: (value: EngineInternals['node']) => {
        current = value;
        wrap(value);
      },
    });
  });

/** Every live message posted to the worklet since `spyOnLiveMessages`, oldest first. */
export const liveMessages = (page: Page): Promise<LiveMessage[]> =>
  page.evaluate(() => (window as SpyWindow).__liveMessages ?? []);

/** Forgets the messages seen so far (a step of a test that counts from here on). */
export const clearLiveMessages = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const seen = (window as SpyWindow).__liveMessages;
    if (seen) seen.length = 0;
  });

/** The state of the engine's `AudioContext` ('suspended' | 'running' | 'closed'), or null when none exists yet. */
export const audioContextState = (page: Page): Promise<AudioContextState | null> =>
  page.evaluate(() => (window as SpyWindow).mxSession?.audioEngine.context?.state ?? null);
