import { describe, expect, it } from 'vitest';
import { logoMarkSvg, logoTileSvg } from '../../src/ui/brand/logo.js';

describe('logo mark and tile (brand.md section 1, SC-007, FR-014 - FR-017)', () => {
  it('(a) logoMarkSvg({}) contains only svg/path/g elements, viewBox="0 0 32 32", fill="currentColor" and aria-hidden="true"', () => {
    const svg = logoMarkSvg({});
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    const root = doc.documentElement;

    expect(root.tagName.toLowerCase()).toBe('svg');
    expect(root.getAttribute('viewBox')).toBe('0 0 32 32');
    expect(root.getAttribute('fill')).toBe('currentColor');
    expect(root.getAttribute('aria-hidden')).toBe('true');

    const allElements = Array.from(doc.querySelectorAll('*'));
    const allowedTags = new Set(['svg', 'path', 'g']);
    for (const el of allElements) {
      expect(allowedTags.has(el.tagName.toLowerCase()), `Element <${el.tagName}> should not be in logo SVG`).toBe(true);
    }
  });

  it('(b) with a title, it has role="img" and that <title> and no aria-hidden', () => {
    const svg = logoMarkSvg({ title: 'Musicanyya logo' });
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    const root = doc.documentElement;

    expect(root.getAttribute('role')).toBe('img');
    expect(root.hasAttribute('aria-hidden')).toBe(false);
    const titleEl = root.querySelector('title');
    expect(titleEl).not.toBeNull();
    expect(titleEl?.textContent).toBe('Musicanyya logo');

    const allElements = Array.from(doc.querySelectorAll('*'));
    const allowedTags = new Set(['svg', 'path', 'g', 'title']);
    for (const el of allElements) {
      expect(allowedTags.has(el.tagName.toLowerCase())).toBe(true);
    }
  });

  it('(c) logoTileSvg(16) uses the small variant and logoTileSvg(32) the regular one (path data differs)', () => {
    const tile16 = logoTileSvg(16);
    const tile32 = logoTileSvg(32);

    const parser = new DOMParser();
    const doc16 = parser.parseFromString(tile16, 'image/svg+xml');
    const doc32 = parser.parseFromString(tile32, 'image/svg+xml');

    const paths16 = Array.from(doc16.querySelectorAll('path'))
      .map((p) => p.getAttribute('d'))
      .join(' ');
    const paths32 = Array.from(doc32.querySelectorAll('path'))
      .map((p) => p.getAttribute('d'))
      .join(' ');

    expect(paths16.length).toBeGreaterThan(0);
    expect(paths32.length).toBeGreaterThan(0);
    expect(paths16).not.toBe(paths32);
  });

  it("(d) the tile's rect has rx 6/32 of the size and fill #1f3a5f, and the mark is #ffffff", () => {
    for (const size of [16, 24, 32, 48, 64, 128, 256]) {
      const tile = logoTileSvg(size);
      const parser = new DOMParser();
      const doc = parser.parseFromString(tile, 'image/svg+xml');
      const root = doc.documentElement;

      expect(root.tagName.toLowerCase()).toBe('svg');

      const rect = root.querySelector('rect');
      expect(rect, `Tile at size ${size} must have a rect`).not.toBeNull();
      const expectedRx = (size * 6) / 32;
      const actualRx = parseFloat(rect?.getAttribute('rx') ?? '0');
      expect(actualRx).toBeCloseTo(expectedRx, 2);
      expect(rect?.getAttribute('fill')).toBe('#1f3a5f');

      const whiteEls = root.querySelectorAll('[fill="#ffffff"], [fill="#fff"], [color="#ffffff"]');
      expect(whiteEls.length, `Tile at size ${size} must contain #ffffff for the mark`).toBeGreaterThan(0);
    }
  });
});
