import * as fs from 'fs';
import * as path from 'path';
import { it } from 'vitest';
import { handleMessage } from '../../src/workers/verovio.worker.js';

interface WorkerMessage {
  requestId: number;
  type: string;
  pageCount?: number;
  message?: string;
}

function post(messages: WorkerMessage[]) {
  return (msg: WorkerMessage) => messages.push(msg);
}

it('measures performance', async () => {
  const renderXml = fs.readFileSync(path.join(__dirname, '../fixtures/musicxml/large-score.musicxml'), 'utf8');
  const messages: WorkerMessage[] = [];

  await handleMessage({ data: { type: 'init', requestId: 1 } } as any, post(messages));

  const start = performance.now();
  await handleMessage(
    {
      data: {
        type: 'load',
        requestId: 2,
        renderXml,
        options: { pageWidth: 1200, pageHeight: 1600, scale: 100 }, // matches mx-score-view.ts's default page layout
      },
    } as any,
    post(messages),
  );
  const elapsedMs = performance.now() - start;

  const result = messages.find((m) => m.requestId === 2);
  if (result?.type === 'error') throw new Error(`Verovio load failed: ${result.message}`);
  console.log(`Loaded and laid out ${result?.pageCount ?? '?'} pages in ${elapsedMs.toFixed(0)} ms`);
}, 30000);
