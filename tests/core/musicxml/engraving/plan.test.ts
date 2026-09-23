import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { applyInserts, planEngraving } from '../../../../src/core/musicxml/engraving/plan.js';
import { readXml } from '../../../../src/core/musicxml/read.js';
import { decodeXml } from '../../../../src/engine/files/decode.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, '../../../fixtures/musicxml/engraving');

function fixtureFiles(): string[] {
  return fs
    .readdirSync(fixturesDir)
    .filter((f) => f.endsWith('.musicxml'))
    .sort();
}

describe('planEngraving + applyInserts: idempotence and determinism (contract guarantees 1-2)', () => {
  for (const file of fixtureFiles()) {
    it(`${file}: planning the completed text yields zero inserts`, () => {
      const xml = decodeXml(fs.readFileSync(path.join(fixturesDir, file)));
      const { doc } = readXml(xml);
      const plan = planEngraving(doc, 'library');
      const completed = applyInserts(xml, plan.inserts);

      const { doc: completedDoc } = readXml(completed);
      const replan = planEngraving(completedDoc, 'library');
      expect(replan.inserts, `${file}: still has inserts after one completion pass`).toEqual([]);
    });

    it(`${file}: a second apply of the same plan is byte-identical`, () => {
      const xml = decodeXml(fs.readFileSync(path.join(fixturesDir, file)));
      const { doc } = readXml(xml);
      const plan = planEngraving(doc, 'library');
      const applied1 = applyInserts(xml, plan.inserts);
      const applied2 = applyInserts(xml, plan.inserts);
      expect(applied1).toBe(applied2);
    });

    it(`${file}: two independent plan runs over the same source are equal (deterministic)`, () => {
      const xml = decodeXml(fs.readFileSync(path.join(fixturesDir, file)));
      const { doc: doc1 } = readXml(xml);
      const { doc: doc2 } = readXml(xml);
      const plan1 = planEngraving(doc1, 'library');
      const plan2 = planEngraving(doc2, 'library');
      expect(plan1.inserts).toEqual(plan2.inserts);
      expect(plan1.beamGroupsAdded).toBe(plan2.beamGroupsAdded);
    });
  }
});
