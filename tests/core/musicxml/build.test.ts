import { describe, it, expect } from 'vitest';
import { buildScore } from '../../../src/core/musicxml/build.js';
import * as fs from 'fs';
import * as path from 'path';

describe('buildScore', () => {
  it('builds time-model with file snapshots', () => {
    // We would loop over fixtures here, but since buildScore doesn't exist yet, this will fail.
    const fakeFixture = `<score-partwise><part id="P1"><measure number="1"><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;
    const result = buildScore(fakeFixture);
    expect(result).toBeDefined();
    expect(result).toMatchSnapshot();
  });
});
