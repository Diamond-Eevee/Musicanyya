import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { THEME_ACCENT_MIN_DELTA_E } from '../../src/engine/config';
import { DISC_COLOR, HELD_OVER_COLOR, SKIPPED_COLOR } from '../../src/ui/score/pressed-keys';
import { THEMES } from '../../src/ui/theme/themes';

const themesCssPath = path.resolve(__dirname, '../../src/ui/styles/themes.css');
const tokensCssPath = path.resolve(__dirname, '../../src/ui/styles/tokens.css');
const gradeMarksPath = path.resolve(__dirname, '../../src/ui/score/grade-marks.ts');
const practiceMarksPath = path.resolve(__dirname, '../../src/ui/score/practice-marks.ts');
const electronMainPath = path.resolve(__dirname, '../../electron/main.ts');

interface RGB {
  r: number;
  g: number;
  b: number;
}

function parseHexColor(hex: string): RGB {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(rgb: RGB): number {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(colorA: RGB, colorB: RGB): number {
  const l1 = relativeLuminance(colorA);
  const l2 = relativeLuminance(colorB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

interface Lab {
  L: number;
  a: number;
  b: number;
}

function rgbToLab(rgb: RGB): Lab {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);

  // sRGB to XYZ (D65)
  const X = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const Y = (r * 0.2126729 + g * 0.7151522 + b * 0.072175) / 1.0;
  const Z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;

  const f = (t: number) => (t > 0.00885645167 ? Math.cbrt(t) : 7.787037037 * t + 16 / 116);

  const fx = f(X);
  const fy = f(Y);
  const fz = f(Z);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

function deltaE00(lab1: Lab, lab2: Lab): number {
  const { L: L1, a: a1, b: b1 } = lab1;
  const { L: L2, a: a2, b: b2 } = lab2;

  const avgL = (L1 + L2) / 2;
  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const avgC = (c1 + c2) / 2;

  const g = 0.5 * (1 - Math.sqrt(avgC ** 7 / (avgC ** 7 + 25 ** 7)));
  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;

  const c1p = Math.hypot(a1p, b1);
  const c2p = Math.hypot(a2p, b2);
  const avgCp = (c1p + c2p) / 2;

  const rad2deg = (r: number) => (r * 180) / Math.PI;
  const deg2rad = (d: number) => (d * Math.PI) / 180;

  const computeHp = (a: number, b: number) => {
    if (a === 0 && b === 0) return 0;
    const deg = rad2deg(Math.atan2(b, a));
    return deg >= 0 ? deg : deg + 360;
  };

  const h1p = computeHp(a1p, b1);
  const h2p = computeHp(a2p, b2);

  let dHp = 0;
  if (c1p !== 0 && c2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) {
      dHp = h2p - h1p;
    } else if (h2p <= h1p) {
      dHp = h2p - h1p + 360;
    } else {
      dHp = h2p - h1p - 360;
    }
  }

  const dLp = L2 - L1;
  const dCp = c2p - c1p;
  const dBigHp = 2 * Math.sqrt(c1p * c2p) * Math.sin(deg2rad(dHp / 2));

  let avgHp = 0;
  if (c1p !== 0 && c2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) {
      avgHp = (h1p + h2p) / 2;
    } else if (h1p + h2p < 360) {
      avgHp = (h1p + h2p + 360) / 2;
    } else {
      avgHp = (h1p + h2p - 360) / 2;
    }
  }

  const T =
    1 -
    0.17 * Math.cos(deg2rad(avgHp - 30)) +
    0.24 * Math.cos(deg2rad(2 * avgHp)) +
    0.32 * Math.cos(deg2rad(3 * avgHp + 6)) -
    0.2 * Math.cos(deg2rad(4 * avgHp - 63));

  const dTheta = 30 * Math.exp(-(((avgHp - 275) / 25) ** 2));
  const RC = 2 * Math.sqrt(avgCp ** 7 / (avgCp ** 7 + 25 ** 7));
  const SL = 1 + (0.015 * (avgL - 50) ** 2) / Math.sqrt(20 + (avgL - 50) ** 2);
  const SC = 1 + 0.045 * avgCp;
  const SH = 1 + 0.015 * avgCp * T;
  const RT = -Math.sin(deg2rad(2 * dTheta)) * RC;

  const dE = Math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dBigHp / SH) ** 2 + RT * (dCp / SC) * (dBigHp / SH));

  return dE;
}

/**
 * Parses `selector { --x: v; }` blocks. A block inside an at-rule is keyed `<at-rule prelude> <selector>`, e.g.
 * `@media (prefers-color-scheme: dark) :root:not([data-theme])`, so it never merges with the same selector outside.
 */
function parseCssDeclarations(cssText: string): Map<string, Map<string, string>> {
  const blocks = new Map<string, Map<string, string>>();
  const css = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  const context: string[] = [];
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') {
      const prelude = css.slice(start, i).trim();
      const close = css.indexOf('}', i);
      const inner = css.slice(i + 1, close);
      if (prelude.startsWith('@') || inner.includes('{')) {
        context.push(prelude);
        start = i + 1;
        continue;
      }
      const key = [...context, prelude].join(' ');
      const decls = blocks.get(key) ?? new Map<string, string>();
      for (const declMatch of inner.matchAll(/([-\w]+)\s*:\s*([^;]+);/g)) {
        decls.set(declMatch[1].trim(), declMatch[2].trim());
      }
      blocks.set(key, decls);
      i = close;
      start = close + 1;
    } else if (ch === '}') {
      context.pop();
      start = i + 1;
    }
  }
  return blocks;
}

function readFeedbackColors(): string[] {
  const colors = new Set<string>();

  const tokensCss = fs.readFileSync(tokensCssPath, 'utf-8');
  const varMap = new Map<string, string>();
  const okabeRegex = /(--color-[-\w]+)\s*:\s*(#[0-9a-fA-F]{6});/g;
  for (const okMatch of tokensCss.matchAll(okabeRegex)) {
    varMap.set(okMatch[1], okMatch[2]);
  }

  const propRegex = /(--(?:grade|practice|status|highlight)-[-\w]+)\s*:\s*([^;]+);/g;
  for (const propMatch of tokensCss.matchAll(propRegex)) {
    const val = propMatch[2].trim();
    if (val.startsWith('#')) {
      colors.add(val.toLowerCase());
    } else if (val.startsWith('var(')) {
      const varName = val.slice(4, -1).trim();
      const resolved = varMap.get(varName);
      if (resolved) colors.add(resolved.toLowerCase());
    }
  }

  const gradeText = fs.readFileSync(gradeMarksPath, 'utf-8');
  const earlyMatch = /EARLY_COLOR\s*=\s*'([^']+)'/.exec(gradeText);
  if (earlyMatch) colors.add(earlyMatch[1].toLowerCase());
  const lateMatch = /LATE_COLOR\s*=\s*'([^']+)'/.exec(gradeText);
  if (lateMatch) colors.add(lateMatch[1].toLowerCase());

  colors.add(DISC_COLOR.toLowerCase());
  colors.add(HELD_OVER_COLOR.toLowerCase());
  colors.add(SKIPPED_COLOR.toLowerCase());

  const practiceText = fs.readFileSync(practiceMarksPath, 'utf-8');
  const startColorMatch = /ctx\.strokeStyle\s*=\s*'(#[0-9a-fA-F]{6})'/.exec(practiceText);
  if (startColorMatch) colors.add(startColorMatch[1].toLowerCase());
  const loopColorMatch = /ctx\.strokeStyle\s*=\s*'(#[0-9a-fA-F]{6})';\s*\/\/\s*wine/.exec(practiceText);
  if (loopColorMatch) colors.add(loopColorMatch[1].toLowerCase());

  return Array.from(colors);
}

const R5_THEMES = [
  {
    id: 'paper',
    kind: 'light',
    desk: '#e9e5dc',
    surface: '#f7f5f0',
    raised: '#ffffff',
    border: '#8a8578',
    ink: '#1c1b19',
    inkMuted: '#5b574f',
    accent: '#1f3a5f',
    onAccent: '#ffffff',
    accentSoft: '#dde3ec',
    warning: '#a4400b',
    startText: '#0072b2',
    loopText: '#882255',
  },
  {
    id: 'ivory',
    kind: 'light',
    desk: '#e8dfcc',
    surface: '#f6efe0',
    raised: '#fffaf0',
    border: '#8c8069',
    ink: '#2a2118',
    inkMuted: '#62574a',
    accent: '#8a2b2b',
    onAccent: '#ffffff',
    accentSoft: '#eed9dc',
    warning: '#9a3b00',
    startText: '#0072b2',
    loopText: '#882255',
  },
  {
    id: 'slate',
    kind: 'light',
    desk: '#dfe3e7',
    surface: '#f1f3f5',
    raised: '#ffffff',
    border: '#7c8690',
    ink: '#1b2229',
    inkMuted: '#4f5a64',
    accent: '#2c5d63',
    onAccent: '#ffffff',
    accentSoft: '#d8e6e7',
    warning: '#a4400b',
    startText: '#0072b2',
    loopText: '#882255',
  },
  {
    id: 'night',
    kind: 'dark',
    desk: '#111214',
    surface: '#1b1d21',
    raised: '#25282d',
    border: '#737882',
    ink: '#e8e6e1',
    inkMuted: '#a9a6a0',
    accent: '#b4c3e0',
    onAccent: '#10151c',
    accentSoft: '#2a3445',
    warning: '#f0a868',
    startText: '#8cc4f0',
    loopText: '#f0a8cc',
  },
  {
    id: 'walnut',
    kind: 'dark',
    desk: '#1c1510',
    surface: '#2a2019',
    raised: '#362a21',
    border: '#8a7866',
    ink: '#efe6d8',
    inkMuted: '#bcae9b',
    accent: '#e0c68f',
    onAccent: '#241a10',
    accentSoft: '#4a3a28',
    warning: '#f2a07b',
    startText: '#8cc4f0',
    loopText: '#f0a8cc',
  },
  {
    id: 'midnight',
    kind: 'dark',
    desk: '#0d1424',
    surface: '#151e33',
    raised: '#1e2942',
    border: '#6f7ca3',
    ink: '#e6e9f2',
    inkMuted: '#a7b0c8',
    accent: '#b9a8f0',
    onAccent: '#161230',
    accentSoft: '#2c2b52',
    warning: '#f0a868',
    startText: '#8cc4f0',
    loopText: '#f0a8cc',
  },
];

describe('Theme palette and contrast tests (theme.md 3.2/3.3, research R-5/R-6)', () => {
  describe('Research R-5 data table contrast & deltaE verification', () => {
    const feedbackColors = [
      '#56b4e9',
      '#0072b2',
      '#009e73',
      '#e69f00',
      '#f0e442',
      '#d55e00',
      '#cc79a7',
      '#882255',
      '#999999',
    ];

    for (const theme of R5_THEMES) {
      it(`verifies contrast and deltaE rules for theme ${theme.id} from R-5 table`, () => {
        const desk = parseHexColor(theme.desk);
        const surface = parseHexColor(theme.surface);
        const raised = parseHexColor(theme.raised);
        const border = parseHexColor(theme.border);
        const ink = parseHexColor(theme.ink);
        const inkMuted = parseHexColor(theme.inkMuted);
        const accent = parseHexColor(theme.accent);
        const onAccent = parseHexColor(theme.onAccent);
        const accentSoft = parseHexColor(theme.accentSoft);
        const warning = parseHexColor(theme.warning);
        const startText = parseHexColor(theme.startText);
        const loopText = parseHexColor(theme.loopText);

        expect(contrastRatio(border, surface), `${theme.id}: border on surface`).toBeGreaterThanOrEqual(3.0);
        expect(contrastRatio(border, raised), `${theme.id}: border on raised`).toBeGreaterThanOrEqual(3.0);

        expect(contrastRatio(ink, desk), `${theme.id}: ink on desk`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(ink, surface), `${theme.id}: ink on surface`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(ink, raised), `${theme.id}: ink on raised`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(ink, accentSoft), `${theme.id}: ink on accentSoft`).toBeGreaterThanOrEqual(4.5);

        expect(contrastRatio(inkMuted, desk), `${theme.id}: inkMuted on desk`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(inkMuted, surface), `${theme.id}: inkMuted on surface`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(inkMuted, raised), `${theme.id}: inkMuted on raised`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(inkMuted, accentSoft), `${theme.id}: inkMuted on accentSoft`).toBeGreaterThanOrEqual(4.5);

        expect(contrastRatio(accent, desk), `${theme.id}: accent on desk`).toBeGreaterThanOrEqual(3.0);
        expect(contrastRatio(accent, surface), `${theme.id}: accent on surface`).toBeGreaterThanOrEqual(3.0);
        expect(contrastRatio(accent, raised), `${theme.id}: accent on raised`).toBeGreaterThanOrEqual(3.0);

        expect(contrastRatio(onAccent, accent), `${theme.id}: onAccent on accent`).toBeGreaterThanOrEqual(4.5);

        expect(contrastRatio(accent, desk), `${theme.id}: focus on desk`).toBeGreaterThanOrEqual(3.0);
        expect(contrastRatio(accent, surface), `${theme.id}: focus on surface`).toBeGreaterThanOrEqual(3.0);
        expect(contrastRatio(accent, raised), `${theme.id}: focus on raised`).toBeGreaterThanOrEqual(3.0);

        expect(contrastRatio(warning, surface), `${theme.id}: warning on surface`).toBeGreaterThanOrEqual(3.0);
        expect(contrastRatio(warning, raised), `${theme.id}: warning on raised`).toBeGreaterThanOrEqual(3.0);

        expect(contrastRatio(startText, raised), `${theme.id}: startText on raised`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(loopText, raised), `${theme.id}: loopText on raised`).toBeGreaterThanOrEqual(4.5);

        const accentLab = rgbToLab(accent);
        for (const fbHex of feedbackColors) {
          const fbLab = rgbToLab(parseHexColor(fbHex));
          const de = deltaE00(accentLab, fbLab);
          expect(de, `${theme.id}: accent to ${fbHex} deltaE00`).toBeGreaterThanOrEqual(THEME_ACCENT_MIN_DELTA_E);
        }
      });
    }
  });

  describe('CSS files checks: (a)-(f), every theme (T009, T034)', () => {
    const requiredTokens = [
      '--mx-desk',
      '--mx-surface',
      '--mx-raised',
      '--mx-border',
      '--mx-ink',
      '--mx-ink-muted',
      '--mx-accent',
      '--mx-on-accent',
      '--mx-accent-soft',
      '--mx-focus',
      '--mx-warning',
      '--mx-start-text',
      '--mx-loop-text',
      'color-scheme',
    ];
    const cssBlocks = () => parseCssDeclarations(fs.readFileSync(themesCssPath, 'utf-8'));
    /** A token's colour inside one block, following one `var()` step within the same block. */
    const rgbIn = (block: Map<string, string> | undefined, token: string): RGB => {
      let val = block?.get(token) ?? '#000000';
      if (val.startsWith('var(')) val = block?.get(val.slice(4, -1).trim()) ?? '#000000';
      return parseHexColor(val);
    };

    for (const { id, kind } of THEMES) {
      const selector = `:root[data-theme="${id}"]`;

      it(`(a) ${selector} defines every token of theme.md 3.2 and color-scheme: ${kind}`, () => {
        const block = cssBlocks().get(selector);
        expect(block, `${selector} block must exist`).toBeDefined();
        for (const token of requiredTokens) {
          expect(block?.has(token), `${id} must define ${token}`).toBe(true);
        }
        expect(block?.get('color-scheme')).toBe(kind);
      });

      it(`(b) every contrast pair of ${id} in themes.css meets its ratio, naming the pair on failure`, () => {
        const block = cssBlocks().get(selector);
        expect(block).toBeDefined();
        const c = (token: string) => rgbIn(block, token);
        const pairs: Array<[string, string, number]> = [
          ['--mx-border', '--mx-surface', 3],
          ['--mx-border', '--mx-raised', 3],
          ['--mx-ink', '--mx-desk', 4.5],
          ['--mx-ink', '--mx-surface', 4.5],
          ['--mx-ink', '--mx-raised', 4.5],
          ['--mx-ink', '--mx-accent-soft', 4.5],
          ['--mx-ink-muted', '--mx-desk', 4.5],
          ['--mx-ink-muted', '--mx-surface', 4.5],
          ['--mx-ink-muted', '--mx-raised', 4.5],
          ['--mx-ink-muted', '--mx-accent-soft', 4.5],
          ['--mx-accent', '--mx-desk', 3],
          ['--mx-accent', '--mx-surface', 3],
          ['--mx-accent', '--mx-raised', 3],
          ['--mx-on-accent', '--mx-accent', 4.5],
          ['--mx-focus', '--mx-desk', 3],
          ['--mx-focus', '--mx-surface', 3],
          ['--mx-focus', '--mx-raised', 3],
          ['--mx-warning', '--mx-surface', 3],
          ['--mx-warning', '--mx-raised', 3],
          ['--mx-start-text', '--mx-raised', 4.5],
          ['--mx-loop-text', '--mx-raised', 4.5],
        ];
        for (const [fg, bg, ratio] of pairs) {
          expect(contrastRatio(c(fg), c(bg)), `${id}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(ratio);
        }
      });

      it(`(c) ${id} accent ΔE00 ≥ THEME_ACCENT_MIN_DELTA_E to every feedback colour`, () => {
        const block = cssBlocks().get(selector);
        expect(block?.get('--mx-accent'), `${id} must define --mx-accent`).toBeDefined();
        const accentLab = rgbToLab(rgbIn(block, '--mx-accent'));
        const feedbackColors = readFeedbackColors();
        expect(feedbackColors.length).toBeGreaterThan(0);
        for (const fbHex of feedbackColors) {
          const de = deltaE00(accentLab, rgbToLab(parseHexColor(fbHex)));
          expect(de, `${id} accent to ${fbHex} deltaE00`).toBeGreaterThanOrEqual(THEME_ACCENT_MIN_DELTA_E);
        }
      });
    }

    it('(d) no theme block defines --score-*, --grade-*, --practice-*, --status-* or --highlight-*', () => {
      for (const [selector, decls] of cssBlocks()) {
        if (!selector.includes('data-theme')) continue;
        for (const prop of decls.keys()) {
          expect(prop.startsWith('--score-'), `${selector} defines ${prop}`).toBe(false);
          expect(prop.startsWith('--grade-'), `${selector} defines ${prop}`).toBe(false);
          expect(prop.startsWith('--practice-'), `${selector} defines ${prop}`).toBe(false);
          expect(prop.startsWith('--status-'), `${selector} defines ${prop}`).toBe(false);
          expect(prop.startsWith('--highlight-'), `${selector} defines ${prop}`).toBe(false);
        }
      }
    });

    it('(e) :root:not([data-theme]) resolves to the Paper values', () => {
      const blocks = cssBlocks();
      const fallback = blocks.get(':root:not([data-theme])');
      expect(fallback, ':root:not([data-theme]) must exist').toBeDefined();
      const paper = blocks.get(':root[data-theme="paper"]');
      expect(paper, ':root[data-theme="paper"] must exist').toBeDefined();
      for (const [prop, val] of paper?.entries() ?? []) {
        expect(fallback?.get(prop), `fallback must match paper ${prop}`).toBe(val);
      }
      expect(fallback?.size).toBe(paper?.size);
    });

    it('(e2) under prefers-color-scheme: dark, :root:not([data-theme]) resolves to the Night values', () => {
      const blocks = cssBlocks();
      const darkFallback = blocks.get('@media (prefers-color-scheme: dark) :root:not([data-theme])');
      expect(darkFallback, 'dark fallback block must exist').toBeDefined();
      const night = blocks.get(':root[data-theme="night"]');
      expect(night, ':root[data-theme="night"] must exist').toBeDefined();
      for (const [prop, val] of night?.entries() ?? []) {
        expect(darkFallback?.get(prop), `dark fallback must match night ${prop}`).toBe(val);
      }
      expect(darkFallback?.size).toBe(night?.size);
    });

    it("(e3) the Electron window's start colours equal Paper's and Night's --mx-desk (research R-3)", () => {
      const mainTs = fs.readFileSync(electronMainPath, 'utf-8');
      const light = /START_BACKGROUND_LIGHT\s*=\s*'(#[0-9a-fA-F]{6})'/.exec(mainTs)?.[1];
      const dark = /START_BACKGROUND_DARK\s*=\s*'(#[0-9a-fA-F]{6})'/.exec(mainTs)?.[1];
      const blocks = cssBlocks();
      expect(light, 'START_BACKGROUND_LIGHT in electron/main.ts').toBe(
        blocks.get(':root[data-theme="paper"]')?.get('--mx-desk'),
      );
      expect(dark, 'START_BACKGROUND_DARK in electron/main.ts').toBe(
        blocks.get(':root[data-theme="night"]')?.get('--mx-desk'),
      );
    });

    it('(f) tokens.css defines --score-paper: #ffffff and --score-ink: #000000', () => {
      const tokensCss = fs.readFileSync(tokensCssPath, 'utf-8');
      const blocks = parseCssDeclarations(tokensCss);
      const rootBlock = blocks.get(':root');
      expect(rootBlock?.get('--score-paper')).toBe('#ffffff');
      expect(rootBlock?.get('--score-ink')).toBe('#000000');
    });
  });
});
