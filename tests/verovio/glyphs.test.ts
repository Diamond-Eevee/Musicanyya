// The accidental glyphs for the red discs come from Verovio itself (feature 008, research R-11): a tiny built-in
// snippet is rendered once at start-up and the glyph path data read out of the SVG <defs>. This runs against the
// real toolkit, in Node, like the other tests of this folder.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import verovio, { type VerovioToolkit } from 'verovio';
import { beforeAll, describe, expect, it } from 'vitest';
import { decodeXml } from '../../src/engine/files/decode.js';
import { harvestGlyphs } from '../../src/workers/glyphs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function newToolkit(): Promise<VerovioToolkit> {
  return new Promise((resolve) => {
    if (verovio.module._vrvToolkit_constructor) resolve(new verovio.toolkit());
    else verovio.module.onRuntimeInitialized = () => resolve(new verovio.toolkit());
  });
}

const LAYOUT = {
  breaks: 'auto',
  adjustPageHeight: 0,
  header: 'none',
  footer: 'none',
  font: 'Leipzig',
  svgViewBox: 1,
  svgHtml5: 0,
  pageWidth: 2100,
  pageHeight: 2970,
  scale: 40,
};

function renderFixture(toolkit: VerovioToolkit): string {
  const bytes = fs.readFileSync(path.join(__dirname, '../fixtures/musicxml/scale-c-major-q100.musicxml'));
  toolkit.setOptions(LAYOUT);
  toolkit.loadData(decodeXml(bytes));
  return toolkit.renderToSVG(1);
}

describe('harvestGlyphs (feature 008, research R-11)', () => {
  let toolkit: VerovioToolkit;
  beforeAll(async () => {
    toolkit = await newToolkit();
  }, 60_000);

  it('returns non-empty path data for the sharp, flat, natural and black notehead, and the font’s units per em', () => {
    const glyphs = harvestGlyphs(toolkit);
    for (const name of ['sharp', 'flat', 'natural', 'notehead'] as const) {
      expect(glyphs[name].length, name).toBeGreaterThan(20);
      expect(glyphs[name], name).toMatch(/^[Mm]\s*[-\d.]/); // SVG path data starts with a moveto
    }
    expect(glyphs.unitsPerEm).toBeGreaterThan(0);
    expect(new Set([glyphs.sharp, glyphs.flat, glyphs.natural, glyphs.notehead]).size).toBe(4); // four different shapes
  });

  it('is repeatable: the same glyphs every time', () => {
    expect(harvestGlyphs(toolkit)).toEqual(harvestGlyphs(toolkit));
  });

  it('leaves the toolkit as it found it: a Score loaded afterwards renders exactly as on a toolkit that never harvested', async () => {
    // Verovio gives the page a random id (used again in its style block and glyph defs) and every element one too:
    // compare without them
    const normalise = (svg: string) => {
      const root = /<svg[^>]* id="([^"]+)"/.exec(svg)?.[1];
      const plain = root ? svg.split(root).join('ROOT') : svg;
      return plain
        .replace(/ id="[^"]*"/g, '')
        .replace(/(class="[a-z]+Milestone(?:End)?) [^"]*"/g, '$1"')
        .replace(/xlink:href="#[^"]*"/g, 'xlink:href="#"');
    };
    const a = await newToolkit();
    const b = await newToolkit();
    const harvested = await newToolkit();
    harvestGlyphs(harvested);
    const expected = normalise(renderFixture(a));
    expect(normalise(renderFixture(b)), 'control: two untouched toolkits render the same').toBe(expected);
    expect(normalise(renderFixture(harvested))).toBe(expected);
  });
});
