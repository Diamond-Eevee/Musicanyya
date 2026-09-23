import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generateChangeFamily, generateTriadFamily } from '../../../../src/core/library/exercise/generate.js';
import type { ExerciseDefinition } from '../../../../src/core/library/exercise/types.js';
import { planEngraving } from '../../../../src/core/musicxml/engraving/plan.js';
import { readXml } from '../../../../src/core/musicxml/read.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.join(__dirname, '../../../../content/library/exercises');

function loadDefinition(fileName: string): ExerciseDefinition {
  return JSON.parse(fs.readFileSync(path.join(contentDir, fileName), 'utf-8')) as ExerciseDefinition;
}

const GENERATED_ON = '2026-09-23';

describe('generated exercise families ship fully engraved (FR-012)', () => {
  const definitionFiles = fs.readdirSync(contentDir).filter((f) => f.endsWith('.json'));

  for (const file of definitionFiles) {
    const definition = loadDefinition(file);
    const items = definition.family.startsWith('changes')
      ? generateChangeFamily(definition, GENERATED_ON)
      : generateTriadFamily(definition, GENERATED_ON);

    it(`${file}: every generated item plans zero engraving inserts (beams and accidentals are already complete)`, () => {
      for (const item of items) {
        const { doc } = readXml(item.xml);
        const plan = planEngraving(doc, 'library');
        expect(plan.inserts, `${item.fileStem}: ${plan.findings.length} finding(s)`).toEqual([]);
      }
    });
  }
});
