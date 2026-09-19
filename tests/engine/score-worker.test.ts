import { describe, expect, it } from 'vitest';
// Vitest doesn't run actual Web Workers easily out of the box without setup,
// but we can test the handler logic by extracting it. Or we can just import the logic.
// Actually, for a contract test, we often use a mock worker or test the message handler directly.
// Since the environment is Node, we can instantiate a Worker using `node:worker_threads` or rely on Vitest's environment if it's happy-dom.
// Wait, the project config says `engine` tests are `node`. So standard Web Worker is not available in Node natively without a polyfill.
// Let's test the inner logic function of the worker, or use a tiny mock if necessary.
// Let's just create a test that imports the message handler and calls it, simulating the worker environment.
import { handleMessage } from '../../src/workers/score.worker.js';
import ScoreWorker from '../../src/workers/score.worker.js?worker&url';

describe('Score worker contract', () => {
  it('load -> loaded/failed messages per contracts/worker-messages.md', async () => {
    const messages: any[] = [];
    const mockPostMessage = (msg: any, transfers?: any[]) => {
      messages.push(msg);
    };

    // Simulate an invalid file (not XML) to get a failed message
    const bytes = new TextEncoder().encode('not an xml file').buffer;
    await handleMessage({ data: { type: 'load', requestId: 1, fileName: 'test.xml', bytes } }, mockPostMessage);

    expect(messages.length).toBe(1);
    expect(messages[0].type).toBe('failed');
    expect(messages[0].requestId).toBe(1);
    expect(messages[0].error.code).toBeDefined();

    // Simulate a stale request ignored (not easily testable if handleMessage is stateless, but the worker can hold state)
  });
});
