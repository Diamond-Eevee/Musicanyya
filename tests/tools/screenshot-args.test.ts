import { describe, expect, it } from 'vitest';
import { parseScreenshotArgs, VALID_THEMES } from '../../tools/dev/screenshot.js';

describe('screenshot args parsing (feature 016 T004)', () => {
  it('defines the 7 valid theme ids', () => {
    expect(VALID_THEMES).toEqual(['auto', 'paper', 'ivory', 'slate', 'night', 'walnut', 'midnight']);
  });

  it('parses valid theme choices', () => {
    for (const theme of VALID_THEMES) {
      const opts = parseScreenshotArgs(['--theme', theme]);
      expect(opts.theme).toBe(theme);
    }
  });

  it('rejects an unknown theme and lists all valid ids', () => {
    expect(() => parseScreenshotArgs(['--theme', 'neon'])).toThrowError(
      /Unknown theme "neon".*Valid themes:.*auto.*paper.*ivory.*slate.*night.*walnut.*midnight/,
    );
  });

  it('parses --clip with a selector', () => {
    const opts = parseScreenshotArgs(['--clip', '.mx-score-stack']);
    expect(opts.clip).toBe('.mx-score-stack');
  });

  it('parses --compare with a file path', () => {
    const opts = parseScreenshotArgs(['--compare', 'tests/.generated/baseline.png']);
    expect(opts.compare).toBe('tests/.generated/baseline.png');
  });

  it('parses --theme, --clip, and --compare together with existing options', () => {
    const opts = parseScreenshotArgs([
      '--',
      '--item',
      'repertoire/intermediate/fur-elise-theme',
      '--theme',
      'paper',
      '--clip',
      '.mx-score-stack',
      '--compare',
      'tests/.generated/016-baseline/fur-elise.png',
      '--width',
      '1280',
      '--height',
      '800',
    ]);
    expect(opts.item).toBe('repertoire/intermediate/fur-elise-theme');
    expect(opts.theme).toBe('paper');
    expect(opts.clip).toBe('.mx-score-stack');
    expect(opts.compare).toBe('tests/.generated/016-baseline/fur-elise.png');
    expect(opts.width).toBe('1280');
    expect(opts.height).toBe('800');
  });
});
