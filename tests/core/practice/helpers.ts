import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import type { Score } from '../../../src/core/score/model.js';
import { buildTimeline } from '../../../src/core/timeline/timeline.js';
import type { PlaybackTimeline } from '../../../src/core/timeline/types.js';
import { decodeXml } from '../../../src/engine/files/decode.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadFixture(name: string): { score: Score; timeline: PlaybackTimeline } {
  const fixturesDir = path.join(__dirname, '../../fixtures/musicxml');
  const bytes = fs.readFileSync(path.join(fixturesDir, name));
  const xml = decodeXml(bytes);
  const { doc } = readXml(xml);
  const { score } = buildScore(doc);
  const { timeline } = buildTimeline(score);
  return { score, timeline };
}
