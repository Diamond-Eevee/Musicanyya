import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import type { Score } from '../../../src/core/score/model.js';
import { decodeXml } from '../../../src/engine/files/decode.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Parses a real MusicXML fixture into a `Score` (same pipeline as tests/core/practice/helpers.ts). */
export function loadScoreFixture(name: string): Score {
  const fixturesDir = path.join(__dirname, '../../fixtures/musicxml');
  const bytes = fs.readFileSync(path.join(fixturesDir, name));
  const xml = decodeXml(bytes);
  const { doc } = readXml(xml);
  const { score } = buildScore(doc);
  return score;
}
