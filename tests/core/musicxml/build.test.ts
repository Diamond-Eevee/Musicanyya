import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import { decodeXml } from '../../../src/engine/files/decode.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('buildScore snapshots', () => {
  const fixturesDir = path.join(__dirname, '../../fixtures/musicxml');
  const files = fs
    .readdirSync(fixturesDir)
    .filter(
      (f) =>
        f.endsWith('.musicxml') && !f.includes('malformed') && !f.includes('large-score') && !f.includes('encoding'),
    );

  for (const file of files) {
    it(`builds time-model for ${file}`, () => {
      const bytes = fs.readFileSync(path.join(fixturesDir, file));
      const xml = decodeXml(bytes);
      const { doc } = readXml(xml);
      const { score, report } = buildScore(doc);
      expect({ score, report }).toMatchSnapshot();
    });
  }
});
