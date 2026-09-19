import * as fs from 'fs';
import * as path from 'path';
import { handleMessage } from '../../src/workers/verovio.worker.js';
import { it } from 'vitest';

it('measures performance', async () => {
  const xml = fs.readFileSync(path.join(__dirname, '../fixtures/musicxml/large-score.musicxml'), 'utf8');
  console.log('XML loaded, sending to verovio worker...');
  
  const start = performance.now();

  await new Promise<void>(async (resolve) => {
    await handleMessage({
      data: { type: 'load', xml }
    } as any, (msg) => {
      if (msg.type === 'loaded') {
        const end = performance.now();
        console.log(`Loaded and laid out in ${end - start} ms`);
        resolve();
      } else if (msg.type === 'failed') {
        console.error('Failed to load');
        resolve();
      }
    });
  });
}, 30000);
