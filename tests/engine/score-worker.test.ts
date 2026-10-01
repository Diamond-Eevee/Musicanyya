import * as fs from 'node:fs';
import * as path from 'node:path';
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

// Feature 019 (orchestra-score.md sections 2 to 4): an Orchestra part never reaches Verovio, the cursor or the summary
// as a printed part. The fixtures are in tests/fixtures/musicxml/orchestra/.
describe('Score worker with Orchestra parts (feature 019)', () => {
  const dir = path.join(__dirname, '../fixtures/musicxml/orchestra');

  interface Loaded {
    summary: { parts: { id: string; name: string; orchestra: boolean }[]; measureIds: string[] };
    renderXml: string;
    timeline: { spans: { noteId: string }[] };
    fullScore: { parts: { xmlId: string; orchestra: boolean; notes: { id: string }[] }[] };
  }

  async function open(name: string): Promise<Loaded> {
    const bytes = new Uint8Array(fs.readFileSync(path.join(dir, `${name}.musicxml`)));
    const messages: any[] = [];
    await handleMessage(
      { data: { type: 'load', requestId: 1, fileName: `${name}.musicxml`, bytes: bytes.buffer } } as MessageEvent,
      ((msg: unknown) => messages.push(msg)) as typeof postMessage,
    );
    const loaded = messages.find((m) => m.type === 'loaded');
    expect(loaded, `${name} loads`).toBeDefined();
    return loaded as Loaded;
  }

  // [fixture, the Orchestra part's id]
  const WITH_ORCHESTRA: [string, string][] = [
    ['piano-and-oboe', 'P2'],
    ['piano-and-two-staff-orchestra', 'P2'],
    ['orchestra-first', 'P1'],
    ['orchestra-no-program', 'P2'],
    ['orchestra-same-program', 'P2'],
  ];

  it.each(WITH_ORCHESTRA)(
    '%s: the render copy holds no <score-part> and no <part> of the Orchestra',
    async (name, id) => {
      const { renderXml } = await open(name);
      expect(renderXml).not.toContain(`<score-part id="${id}">`);
      expect(renderXml).not.toContain(`<part id="${id}">`);
      expect(renderXml.match(/<part id="/g)).toHaveLength(1); // the piano alone
      expect(renderXml.match(/<score-part id="/g)).toHaveLength(1);
    },
  );

  it.each(WITH_ORCHESTRA)('%s: the measure ids sit on the first printed part, one set', async (name) => {
    const { renderXml, summary } = await open(name);
    const ids = renderXml.match(/<measure [^>]*id="ms-\d+"/g) ?? [];
    expect(summary.measureIds.length).toBeGreaterThan(0);
    expect(ids).toHaveLength(summary.measureIds.length);
    expect(renderXml.slice(renderXml.indexOf('<part id="')).match(/<measure [^>]*id="ms-\d+"/g)).toHaveLength(
      summary.measureIds.length,
    );
  });

  it.each(WITH_ORCHESTRA)('%s: summary.parts[].orchestra marks the Orchestra part only', async (name, id) => {
    const { summary } = await open(name);
    expect(summary.parts).toHaveLength(2);
    for (const part of summary.parts) expect(part.orchestra, `${name} ${part.id}`).toBe(part.id === id);
  });

  it.each(WITH_ORCHESTRA)('%s: the cursor spans hold no Orchestra note', async (name, id) => {
    const { timeline, fullScore } = await open(name);
    const orchestra = new Set(fullScore.parts.filter((p) => p.xmlId === id).flatMap((p) => p.notes.map((n) => n.id)));
    const piano = new Set(fullScore.parts.filter((p) => p.xmlId !== id).flatMap((p) => p.notes.map((n) => n.id)));
    expect(orchestra.size).toBeGreaterThan(0);
    const spanIds = timeline.spans.map((s) => s.noteId);
    expect(spanIds.filter((noteId) => orchestra.has(noteId))).toEqual([]);
    expect(spanIds.some((noteId) => piano.has(noteId))).toBe(true);
  });

  it.each(WITH_ORCHESTRA.filter(([name]) => name !== 'orchestra-first'))(
    '%s: the render copy equals the twin without the Orchestra byte for byte (SC-004 by construction)',
    async (name) => {
      const withOrchestra = await open(name);
      const twin = await open(`${name}-twin`);
      expect(withOrchestra.renderXml).toBe(twin.renderXml);
    },
  );

  it('orchestra-first: the render copy equals the twin once the piano part index 1 is mapped to 0 in the Note IDs', async () => {
    const withOrchestra = await open('orchestra-first');
    const twin = await open('orchestra-first-twin');
    expect(withOrchestra.renderXml).toContain('n-p1-');
    expect(withOrchestra.renderXml.replace(/n-p1-/g, 'n-p0-')).toBe(twin.renderXml);
  });

  it.each(['partly-hidden', 'hidden-later', 'shown-again', 'all-hidden'])(
    '%s: hidden staves that are not an Orchestra stay in the render copy and the summary says so',
    async (name) => {
      const { renderXml, summary, timeline, fullScore } = await open(name);
      expect(renderXml.match(/<part id="/g)).toHaveLength(2);
      expect(summary.parts.map((p) => p.orchestra)).toEqual([false, false]);
      const all = new Set(fullScore.parts.flatMap((p) => p.notes.map((n) => n.id)));
      expect(new Set(timeline.spans.map((s) => s.noteId))).toEqual(all);
    },
  );
});
