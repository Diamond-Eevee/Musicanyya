import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateSupportMatrixMarkdown } from '../../../src/core/musicxml/support.js';

describe('Support matrix sync', () => {
  it('docs/musicxml-support.md table equals SUPPORT_MATRIX', () => {
    const docPath = path.join(__dirname, '../../../docs/musicxml-support.md');
    const content = fs.readFileSync(docPath, 'utf8');
    const expectedTable = generateSupportMatrixMarkdown();

    // We expect the document to contain the exact markdown table generated from SUPPORT_MATRIX
    expect(content).toContain(expectedTable);
  });
});
