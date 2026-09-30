import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Feature 016, T016: scans src/ui/styles/*.css (except tokens.css, themes.css)
 * and <style> blocks in src/ui/elements/*.ts for hardcoded hex, rgb/rgba, hsl/hsla,
 * and named colours. Every allowed exception must have a recorded reason.
 */

interface AllowRule {
  file: string;
  reason: string;
  matches: (line: string, value: string, lineNumber: number) => boolean;
}

const ALLOWLIST: AllowRule[] = [
  {
    file: 'src/ui/elements/mx-piano-keys.ts',
    reason: 'feature 010: piano key colours, physical ivory/ebony gradient, and pressed key shadows inside .key rules',
    matches: (_line, _val, lineNum) => {
      // Key rules in mx-piano-keys.ts are lines 122-245 (white/black keys, pressed states, key-dot, key-label)
      // Lines 250+ are frame / sustain pedal controls which must use tokens
      return lineNum >= 122 && lineNum <= 245;
    },
  },
  {
    file: 'src/ui/styles/score.css',
    reason: 'feature 008/009: score feedback marks reading tokens or feedback highlights',
    matches: (line) => line.includes('.mx-score-') || line.includes('mx-mark-') || line.includes('g.note'),
  },
  {
    file: 'src/ui/styles/themes.css',
    reason: 'theme definitions file: declares --mx-shadow-popup with rgba(0,0,0,a)',
    matches: (line) => line.includes('--mx-shadow-popup'),
  },
];

const CSS_NAMED_COLOURS = new Set([
  'black',
  'white',
  'red',
  'green',
  'blue',
  'yellow',
  'orange',
  'purple',
  'pink',
  'gray',
  'grey',
  'cyan',
  'magenta',
  'silver',
  'maroon',
  'navy',
  'olive',
  'teal',
  'aqua',
  'fuchsia',
  'lime',
]);

const HEX_REGEX = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
const FUNC_REGEX = /\b(?:rgb|rgba|hsl|hsla)\([^)]*\)/g;
const PROPERTY_VALUE_REGEX = /:\s*([^;}{]+)[;}]/g;

interface Violation {
  file: string;
  line: number;
  value: string;
  lineContent: string;
}

function findViolationsInCss(relPath: string, content: string, startLineOffset = 0): Violation[] {
  const violations: Violation[] = [];
  const lines = content.split('\n');

  let inBlockComment = false;

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    const lineNum = idx + 1 + startLineOffset;
    let line = rawLine;

    // Handle multi-line comments
    if (inBlockComment) {
      const endComment = line.indexOf('*/');
      if (endComment !== -1) {
        inBlockComment = false;
        line = line.slice(endComment + 2);
      } else {
        continue;
      }
    }

    while (line.includes('/*')) {
      const startComment = line.indexOf('/*');
      const endComment = line.indexOf('*/', startComment + 2);
      if (endComment !== -1) {
        line = line.slice(0, startComment) + line.slice(endComment + 2);
      } else {
        inBlockComment = true;
        line = line.slice(0, startComment);
        break;
      }
    }

    // Ignore lines that only set custom property fallbacks to transparent/inherit/currentColor
    // or pure comments / empty lines
    if (!line.trim()) continue;

    // Check hex
    const hexMatches = [...line.matchAll(HEX_REGEX)];
    for (const m of hexMatches) {
      const val = m[0];
      const isAllowed = ALLOWLIST.some(
        (rule) => relPath.replace(/\\/g, '/').endsWith(rule.file) && rule.matches(line, val, lineNum),
      );
      if (!isAllowed) {
        violations.push({ file: relPath, line: lineNum, value: val, lineContent: rawLine.trim() });
      }
    }

    // Check rgb/rgba/hsl/hsla
    const funcMatches = [...line.matchAll(FUNC_REGEX)];
    for (const m of funcMatches) {
      const val = m[0];
      const isAllowed = ALLOWLIST.some(
        (rule) => relPath.replace(/\\/g, '/').endsWith(rule.file) && rule.matches(line, val, lineNum),
      );
      if (!isAllowed) {
        violations.push({ file: relPath, line: lineNum, value: val, lineContent: rawLine.trim() });
      }
    }

    // Check named colors in property declarations
    for (const propMatch of line.matchAll(PROPERTY_VALUE_REGEX)) {
      const valText = propMatch[1];
      const words = valText.toLowerCase().split(/[\s,()/]+/);
      for (const word of words) {
        if (CSS_NAMED_COLOURS.has(word)) {
          const isAllowed = ALLOWLIST.some(
            (rule) => relPath.replace(/\\/g, '/').endsWith(rule.file) && rule.matches(line, word, lineNum),
          );
          if (!isAllowed) {
            violations.push({ file: relPath, line: lineNum, value: word, lineContent: rawLine.trim() });
          }
        }
      }
    }
  }

  return violations;
}

describe('No hardcoded colours in chrome stylesheets (T016)', () => {
  const root = resolve(process.cwd(), 'src/ui');

  it('scans all stylesheets and element shadow roots, reporting hardcoded colours', () => {
    const allViolations: Violation[] = [];

    // Scan src/ui/styles/*.css (except tokens.css, themes.css)
    const styleFiles = readdirSync(join(root, 'styles'))
      .filter((f) => f.endsWith('.css') && f !== 'tokens.css' && f !== 'themes.css')
      .map((f) => join('src/ui/styles', f));

    for (const relFile of styleFiles) {
      const absPath = resolve(process.cwd(), relFile);
      const content = readFileSync(absPath, 'utf8');
      allViolations.push(...findViolationsInCss(relFile, content));
    }

    // Scan <style> inside src/ui/elements/*.ts
    const elementFiles = readdirSync(join(root, 'elements'))
      .filter((f) => f.endsWith('.ts'))
      .map((f) => join('src/ui/elements', f));

    for (const relFile of elementFiles) {
      const absPath = resolve(process.cwd(), relFile);
      const content = readFileSync(absPath, 'utf8');
      // Match style tags: <style>...</style>
      const styleRegex = /<style>([\s\S]*?)<\/style>/g;
      for (const match of content.matchAll(styleRegex)) {
        const styleContent = match[1] ?? '';
        // Calculate line offset
        const prefix = content.slice(0, match.index);
        const lineOffset = prefix.split('\n').length - 1;
        allViolations.push(...findViolationsInCss(relFile, styleContent, lineOffset));
      }
    }

    // Report findings clearly
    if (allViolations.length > 0) {
      const report = allViolations.map((v) => `  ${v.file}:${v.line} -> ${v.value} (${v.lineContent})`).join('\n');
      console.warn(`Found ${allViolations.length} hardcoded colour occurrences:\n${report}`);
    }

    expect(
      allViolations,
      `Expected zero hardcoded colours, but found:\n${allViolations
        .map((v) => `${v.file}:${v.line} ${v.value}`)
        .join('\n')}`,
    ).toEqual([]);
  });
});
