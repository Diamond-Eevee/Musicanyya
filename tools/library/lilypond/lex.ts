// Tokeniser for the LilyPond subset (contract fidelity-tools.md §3.1). Every character is either consumed into a
// token or rejected with its line and column: nothing is skipped silently except whitespace and comments.
import { LyUnsupportedError } from './errors';

export type LyTokenType = 'command' | 'string' | 'number' | 'word' | 'scheme' | 'symbol' | 'eof';

export interface LyToken {
  type: LyTokenType;
  value: string;
  line: number;
  column: number;
  /** True when whitespace or a comment separates this token from the previous one. */
  spaced: boolean;
}

const SYMBOLS2 = ['<<', '>>'];
const SYMBOLS1 = "{}<>|~()[]-^_.=',!?*/:";
const WORD = /[A-Za-z\u0080-￿]/;
/** Commands whose braced block is lyric text: syllables, hyphens and punctuation that are no music, so the block is skipped
 *  whole and the parser sees an empty pair of braces. Lyrics carry no note, so nothing the reader compares is lost. */
const LYRIC_COMMANDS = new Set(['\\lyricmode', '\\addlyrics', '\\lyrics']);

export function lexLilyPond(source: string): LyToken[] {
  const tokens: LyToken[] = [];
  let i = 0;
  let line = 1;
  let column = 1;
  let spaced = true;

  const advance = (n = 1): void => {
    for (let k = 0; k < n; k++) {
      if (source[i] === '\n') {
        line++;
        column = 1;
      } else column++;
      i++;
    }
  };
  const push = (type: LyTokenType, value: string, l: number, c: number): void => {
    tokens.push({ type, value, line: l, column: c, spaced });
    spaced = false;
  };

  while (i < source.length) {
    const ch = source[i] as string;
    const l = line;
    const c = column;
    if (/\s/.test(ch) || ch === '﻿') {
      advance();
      spaced = true;
      continue;
    }
    if (ch === '%') {
      if (source[i + 1] === '{') {
        const end = source.indexOf('%}', i + 2);
        if (end < 0) throw new LyUnsupportedError(l, c, 'unterminated block comment');
        advance(end + 2 - i);
      } else {
        while (i < source.length && source[i] !== '\n') advance();
      }
      spaced = true;
      continue;
    }
    if (ch === '\\') {
      const next = source[i + 1] ?? '';
      if (/[A-Za-z]/.test(next)) {
        let name = '\\';
        advance();
        // LilyPond identifiers may contain single '-' or '_' between letters (e.g. \override-lyrics is not one,
        // but \voiceOne and \RemoveEmptyStaves are); keep letters only, which covers the supported commands.
        while (i < source.length && /[A-Za-z]/.test(source[i] as string)) {
          name += source[i];
          advance();
        }
        push('command', name, l, c);
        if (LYRIC_COMMANDS.has(name)) skipLyricBlock();
      } else if ('\\()<>![]'.includes(next) && next !== '') {
        advance(2);
        push('command', `\\${next}`, l, c);
      } else {
        throw new LyUnsupportedError(l, c, `backslash followed by '${next}'`);
      }
      continue;
    }
    if (ch === '"') {
      let value = '';
      advance();
      while (i < source.length && source[i] !== '"') {
        if (source[i] === '\\' && i + 1 < source.length) {
          value += source[i + 1];
          advance(2);
        } else {
          value += source[i];
          advance();
        }
      }
      if (i >= source.length) throw new LyUnsupportedError(l, c, 'unterminated string');
      advance();
      push('string', value, l, c);
      continue;
    }
    if (ch === '#') {
      push('scheme', readScheme(), l, c);
      continue;
    }
    if (ch === '$') throw new LyUnsupportedError(l, c, 'Scheme expression ($)');
    if (/[0-9]/.test(ch)) {
      let value = '';
      while (i < source.length && /[0-9]/.test(source[i] as string)) {
        value += source[i];
        advance();
      }
      push('number', value, l, c);
      continue;
    }
    // Words are ASCII letters, plus any non-ASCII character: those only occur in markup text ("Gymnopédie", the "•"
    // of Mutopia taglines), and in music such a word is rejected by the parser as not a note.
    if (WORD.test(ch)) {
      let value = '';
      while (i < source.length && WORD.test(source[i] as string)) {
        value += source[i];
        advance();
      }
      push('word', value, l, c);
      continue;
    }
    const two = source.slice(i, i + 2);
    if (SYMBOLS2.includes(two)) {
      advance(2);
      push('symbol', two, l, c);
      continue;
    }
    if (SYMBOLS1.includes(ch)) {
      advance();
      push('symbol', ch, l, c);
      continue;
    }
    throw new LyUnsupportedError(l, c, `character '${ch}'`);
  }
  tokens.push({ type: 'eof', value: '', line, column, spaced: true });
  return tokens;

  /** After a lyric command: the `{ ... }` block that follows it, replaced by an empty pair of brace tokens. */
  function skipLyricBlock(): void {
    while (i < source.length && /\s/.test(source[i] as string)) advance();
    if (source[i] !== '{') return;
    const l = line;
    const c = column;
    push('symbol', '{', l, c);
    advance();
    let depth = 1;
    while (depth > 0) {
      const x = source[i];
      if (x === undefined) throw new LyUnsupportedError(l, c, 'unterminated lyrics block');
      if (x === '"') {
        advance();
        while (i < source.length && source[i] !== '"') advance(source[i] === '\\' ? 2 : 1);
      } else if (x === '{') depth++;
      else if (x === '}') depth--;
      if (depth === 0) break;
      advance();
    }
    push('symbol', '}', line, column);
    advance();
  }

  /** One Scheme datum after '#', as source text (without the '#'): a number, string, boolean, symbol or list. */
  function readScheme(): string {
    const l = line;
    const c = column;
    advance(); // '#'
    let text = '';
    while (source[i] === "'" || source[i] === '`') {
      text += source[i];
      advance();
    }
    const ch = source[i] ?? '';
    if (ch === '(') {
      let depth = 0;
      do {
        const x = source[i];
        if (x === undefined) throw new LyUnsupportedError(l, c, 'unterminated Scheme list');
        if (x === '"') {
          text += x;
          advance();
          while (i < source.length && source[i] !== '"') {
            if (source[i] === '\\') {
              text += source[i];
              advance();
            }
            text += source[i];
            advance();
          }
        } else if (x === '(') depth++;
        else if (x === ')') depth--;
        text += source[i];
        advance();
      } while (depth > 0);
      return text;
    }
    if (ch === '"') {
      text += ch;
      advance();
      while (i < source.length && source[i] !== '"') {
        if (source[i] === '\\') {
          text += source[i];
          advance();
        }
        text += source[i];
        advance();
      }
      text += '"';
      advance();
      return text;
    }
    while (i < source.length && !/[\s{}()"]/.test(source[i] as string)) {
      text += source[i];
      advance();
    }
    if (text === '' || text === "'") throw new LyUnsupportedError(l, c, 'empty Scheme expression');
    return text;
  }
}
