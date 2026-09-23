import type { LyToken } from './lex';
import { lexLilyPond } from './lex';

export class LyUnsupportedError extends Error {
  constructor(
    public line: number,
    public column: number,
    public construct: string,
  ) {
    super(`Unsupported LilyPond construct at ${line}:${column}: ${construct}`);
    this.name = 'LyUnsupportedError';
  }
}

export type LyNode = LyCommand | LyBlock | LyNote | LyChord | LyRest | LyAssignment | LyMusicList | LySymbol;

export interface LyCommand {
  type: 'command';
  name: string;
  args: any[];
  line: number;
  column: number;
}

export interface LyBlock {
  type: 'block';
  name: string;
  args: any[];
  body: LyNode[];
  line: number;
  column: number;
}

export interface LyNote {
  type: 'note';
  pitch: string;
  duration?: string;
  ties: boolean;
  line: number;
  column: number;
}

export interface LyChord {
  type: 'chord';
  notes: string[];
  duration?: string;
  ties: boolean;
  line: number;
  column: number;
}

export interface LyRest {
  type: 'rest';
  kind: 'r' | 's' | 'R';
  duration?: string;
  line: number;
  column: number;
}

export interface LyAssignment {
  type: 'assignment';
  name: string;
  value: LyNode;
  line: number;
  column: number;
}

export interface LyMusicList {
  type: 'music_list';
  elements: LyNode[];
  line: number;
  column: number;
}

export interface LySymbol {
  type: 'symbol';
  value: string;
  line: number;
  column: number;
}

export interface LyScore {
  header: Record<string, string>;
  blocks: LyNode[];
}

export function parseLilyPond(source: string): LyScore {
  const tokens = lexLilyPond(source);
  let pos = 0;

  function peek(): LyToken {
    return tokens[pos]!;
  }

  function advance(): LyToken {
    if (pos < tokens.length - 1) pos++;
    return tokens[pos - 1]!;
  }

  function match(type: string, value?: string): boolean {
    const t = peek();
    if (t.type === type && (value === undefined || t.value === value)) {
      advance();
      return true;
    }
    return false;
  }

  function expect(type: string, value?: string): LyToken {
    const t = peek();
    if (t.type === type && (value === undefined || t.value === value)) {
      return advance();
    }
    throw new LyUnsupportedError(t.line, t.column, `Expected ${type} ${value || ''}, got ${t.type} ${t.value}`);
  }

  function parseHeader(): Record<string, string> {
    const header: Record<string, string> = {};
    expect('symbol', '{');
    while (peek().type !== 'eof' && !(peek().type === 'symbol' && peek().value === '}')) {
      if (peek().type === 'word') {
        const key = advance().value;
        if (match('symbol', '=')) {
          if (
            peek().type === 'string' ||
            peek().type === 'number' ||
            peek().type === 'word' ||
            peek().type === 'command'
          ) {
            let val = advance().value;
            // sometimes there's a markup block, we just skip it or record it as string
            if (val === '\\markup') {
              expect('symbol', '{');
              while (peek().type !== 'eof' && !(peek().type === 'symbol' && peek().value === '}')) {
                advance();
              }
              expect('symbol', '}');
              val = 'markup';
            }
            header[key] = val;
          } else {
            advance(); // ignore whatever is there
          }
        }
      } else {
        advance();
      }
    }
    expect('symbol', '}');
    return header;
  }

  function parseMusicList(): LyMusicList {
    const t = expect('symbol', '{');
    const elements: LyNode[] = [];
    while (peek().type !== 'eof' && !(peek().type === 'symbol' && peek().value === '}')) {
      elements.push(parseMusic());
    }
    expect('symbol', '}');
    return { type: 'music_list', elements, line: t.line, column: t.column };
  }

  function parseMusic(): LyNode {
    const t = peek();

    if (t.type === 'symbol' && t.value === '{') {
      return parseMusicList();
    }

    if (t.type === 'symbol' && t.value === '<<') {
      advance();
      const elements: LyNode[] = [];
      while (peek().type !== 'eof' && !(peek().type === 'symbol' && peek().value === '>>')) {
        if (peek().type === 'symbol' && peek().value === '\\\\') {
          elements.push({ type: 'symbol', value: '\\\\', line: peek().line, column: peek().column });
          advance();
        } else {
          elements.push(parseMusic());
        }
      }
      expect('symbol', '>>');
      return { type: 'block', name: '<<>>', args: [], body: elements, line: t.line, column: t.column };
    }

    if (t.type === 'symbol' && t.value === '<') {
      advance();
      const notes: string[] = [];
      while (peek().type !== 'eof' && !(peek().type === 'symbol' && peek().value === '>')) {
        if (peek().type === 'word') notes.push(advance().value);
        else advance();
      }
      expect('symbol', '>');
      let duration: string | undefined;
      let ties = false;
      if (peek().type === 'number') {
        duration = advance().value;
        while (peek().type === 'symbol' && peek().value === '.') {
          duration += '.';
          advance();
        }
      }
      if (peek().type === 'symbol' && peek().value === '~') {
        ties = true;
        advance();
      }
      return { type: 'chord', notes, ...(duration ? { duration } : {}), ties, line: t.line, column: t.column };
    }

    if (t.type === 'command') {
      advance();
      const name = t.value;
      if (name === '\\afterGrace') {
        const mainMusic = parseMusic();
        const graceMusic = parseMusic();
        return { type: 'block', name, args: [], body: [mainMusic, graceMusic], line: t.line, column: t.column };
      }
      if (
        name === '\\relative' ||
        name === '\\repeat' ||
        name === '\\unfoldRepeats' ||
        name === '\\alternative' ||
        name === '\\tuplet' ||
        name === '\\times' ||
        name === '\\new' ||
        name === '\\context' ||
        name === '\\grace' ||
        name === '\\acciaccatura' ||
        name === '\\appoggiatura' ||
        name === '\\slashedGrace'
      ) {
        const args: any[] = [];
        let body: LyNode[] = [];

        // consume args before block
        while (peek().type !== 'eof' && peek().type !== 'symbol' && peek().value !== '{') {
          if (peek().type === 'command' && (name === '\\repeat' || name === '\\alternative' || name === '\\new')) {
            if (peek().value === '\\alternative') break; // alternative is a separate block, handled in reader
          }
          if (peek().value === '<' || peek().value === '<<') break; // block start
          if (name === '\\grace' || name === '\\acciaccatura' || name === '\\appoggiatura' || name === '\\slashedGrace')
            break;
          if (peek().type === 'number') {
            let val = advance().value;
            if (peek().type === 'symbol' && peek().value === '/') {
              val += advance().value;
              if (peek().type === 'number') val += advance().value;
            }
            args.push(val);
          } else {
            args.push(advance().value);
          }
        }

        if (peek().type === 'symbol' && peek().value === '{') {
          body = [parseMusicList()];
        } else if (peek().type === 'symbol' && peek().value === '<<') {
          body = [parseMusic()]; // Parses the << ... >>
        } else {
          body = [parseMusic()];
        }
        return { type: 'block', name, args, body, line: t.line, column: t.column };
      }

      // non-block commands
      const args: any[] = [];
      if (
        name === '\\time' ||
        name === '\\key' ||
        name === '\\clef' ||
        name === '\\ottava' ||
        name === '\\partial' ||
        name === '\\bar' ||
        name === '\\change' ||
        name === '\\set' ||
        name === '\\override' ||
        name === '\\markup' ||
        name === '\\tempo'
      ) {
        if (name === '\\time') {
          if (peek().type === 'number') {
            let val = advance().value;
            if (peek().type === 'symbol' && peek().value === '/') {
              val += advance().value;
              if (peek().type === 'number') val += advance().value;
            }
            args.push(val);
          } else {
            args.push(expect('number').value);
          }
        } else if (name === '\\key') {
          args.push(expect('word').value);
          if (peek().type === 'command') args.push(advance().value); // \major \minor
        } else if (name === '\\clef') {
          if (peek().type === 'string' || peek().type === 'word') {
            args.push(advance().value);
          } else {
            throw new LyUnsupportedError(t.line, t.column, `Expected string/word, got ${peek().type}`);
          }
        } else if (name === '\\ottava') {
          // could be number or symbol # and number
          if (peek().type === 'symbol' && peek().value === '#') advance();
          args.push(expect('number').value);
        } else if (name === '\\partial') {
          args.push(expect('number').value); // actually duration
          while (peek().type === 'symbol' && peek().value === '.') {
            args[0] += '.';
            advance();
          }
        } else if (name === '\\bar') {
          args.push(expect('string').value);
        } else {
          // just read one arg
          if (peek().type !== 'eof' && peek().type !== 'symbol') args.push(advance().value);
        }
      } else if (name === '\\include' || name === '\\transpose') {
        throw new LyUnsupportedError(t.line, t.column, name);
      }
      return { type: 'command', name, args, line: t.line, column: t.column };
    }

    if (t.type === 'word') {
      const val = advance().value;
      if (val === 'r' || val === 'R' || val === 's') {
        let duration: string | undefined;
        if (peek().type === 'number') {
          duration = advance().value;
          while (peek().type === 'symbol' && peek().value === '.') {
            duration += '.';
            advance();
          }
        }
        return { type: 'rest', kind: val, ...(duration ? { duration } : {}), line: t.line, column: t.column };
      }

      // It's a note or variable
      if (match('symbol', '=')) {
        const valNode = parseMusic();
        return { type: 'assignment', name: val, value: valNode, line: t.line, column: t.column };
      }

      // It's a note
      let duration: string | undefined;
      // Duration might be part of the word if lexer grabbed it, e.g. "c4."
      // Let's split pitch and duration.
      let pitch = val;
      const durMatch = val.match(/^([a-z]+[',]*)([0-9]+\.*)$/);
      if (durMatch) {
        pitch = durMatch[1]!;
        duration = durMatch[2];
      } else if (peek().type === 'number') {
        duration = advance().value;
        while (peek().type === 'symbol' && peek().value === '.') {
          duration += '.';
          advance();
        }
      }

      let ties = false;
      if (peek().type === 'symbol' && peek().value === '~') {
        ties = true;
        advance();
      }
      return { type: 'note', pitch, ...(duration ? { duration } : {}), ties, line: t.line, column: t.column };
    }

    if (t.type === 'symbol') {
      if (t.value === '|') {
        advance();
        return { type: 'symbol', value: '|', line: t.line, column: t.column };
      }
      if (t.value === '-') {
        advance();
        if (peek().type === 'symbol' || peek().type === 'word' || peek().type === 'number') {
          advance(); // articulation like -. or -^
        }
        return { type: 'symbol', value: '-', line: t.line, column: t.column };
      }
      if (t.value === '(' || t.value === ')' || t.value === '[' || t.value === ']') {
        advance();
        return { type: 'symbol', value: t.value, line: t.line, column: t.column };
      }
      if (t.value === '#') {
        advance();
        advance(); // skip scheme literal
        return { type: 'symbol', value: '#', line: t.line, column: t.column };
      }
    }

    // Skip unhandled tokens for now to be robust against markings
    const skipped = advance();
    return { type: 'symbol', value: skipped.value, line: t.line, column: t.column };
  }

  const score: LyScore = { header: {}, blocks: [] };

  while (peek().type !== 'eof') {
    const t = peek();
    if (t.type === 'command' && t.value === '\\header') {
      advance();
      score.header = parseHeader();
    } else if (
      t.type === 'command' &&
      (t.value === '\\version' || t.value === '\\paper' || t.value === '\\layout' || t.value === '\\midi')
    ) {
      advance();
      if (peek().type === 'symbol' && peek().value === '{') {
        // skip block
        expect('symbol', '{');
        let open = 1;
        while (peek().type !== 'eof' && open > 0) {
          if (peek().type === 'symbol' && peek().value === '{') open++;
          if (peek().type === 'symbol' && peek().value === '}') open--;
          advance();
        }
      } else {
        if (peek().type === 'string') advance();
      }
    } else {
      score.blocks.push(parseMusic());
    }
  }

  return score;
}
