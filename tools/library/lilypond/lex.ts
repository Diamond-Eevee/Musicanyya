export interface LyToken {
  type: 'command' | 'string' | 'number' | 'word' | 'symbol' | 'eof';
  value: string;
  line: number;
  column: number;
}

export function lexLilyPond(source: string): LyToken[] {
  const tokens: LyToken[] = [];
  let i = 0;
  let line = 1;
  let column = 1;

  function advance(n = 1) {
    for (let j = 0; j < n; j++) {
      if (source[i]! === '\n') {
        line++;
        column = 1;
      } else {
        column++;
      }
      i++;
    }
  }

  while (i < source.length) {
    const char = source[i]!;

    // Whitespace
    if (/\s/.test(char!)) {
      advance();
      continue;
    }

    // Block comment
    if (char! === '%' && source[i + 1] === '{') {
      advance(2);
      while (i < source.length && !(source[i]! === '%' && source[i + 1] === '}')) {
        advance();
      }
      if (i < source.length) advance(2);
      continue;
    }

    // Line comment
    if (char! === '%') {
      while (i < source.length && source[i]! !== '\n') {
        advance();
      }
      continue;
    }

    // Command
    if (char! === '\\') {
      const startLine = line;
      const startCol = column;
      advance();
      
      // Special single-char commands
      if (source[i]! === '\\' || source[i]! === '!' || source[i]! === '>' || source[i]! === '<') {
        tokens.push({ type: 'command', value: '\\' + source[i]!, line: startLine, column: startCol });
        advance();
        continue;
      }

      let cmd = '\\';
      while (i < source.length && /[a-zA-Z]/.test(source[i]!)) {
        cmd += source[i]!;
        advance();
      }
      tokens.push({ type: 'command', value: cmd, line: startLine, column: startCol });
      continue;
    }

    // String
    if (char! === '"') {
      const startLine = line;
      const startCol = column;
      advance();
      let str = '';
      while (i < source.length && source[i]! !== '"') {
        if (source[i]! === '\\' && source[i + 1] === '"') {
          str += '"';
          advance(2);
        } else {
          str += source[i]!;
          advance();
        }
      }
      if (i < source.length) advance(); // consume closing quote
      tokens.push({ type: 'string', value: str, line: startLine, column: startCol });
      continue;
    }

    // Numbers (can be fractions like 3/2 for tuplets, or integers)
    // Actually, it's easier to lex words and let the parser decide, or lex digits.
    if (/[0-9]/.test(char!)) {
      const startLine = line;
      const startCol = column;
      let num = '';
      while (i < source.length && /[0-9]/.test(source[i]!)) {
        num += source[i]!;
        advance();
      }
      tokens.push({ type: 'number', value: num, line: startLine, column: startCol });
      continue;
    }

    // Multi-char symbols
    if (char! === '<' && source[i + 1] === '<') {
      tokens.push({ type: 'symbol', value: '<<', line, column });
      advance(2);
      continue;
    }
    if (char! === '>' && source[i + 1] === '>') {
      tokens.push({ type: 'symbol', value: '>>', line, column });
      advance(2);
      continue;
    }

    // Single-char symbols
    if ('{}<>[|]=~^-_/#.'.includes(char!)) {
      tokens.push({ type: 'symbol', value: char, line, column });
      advance();
      continue;
    }

    // Words (notes, variables, markup)
    // A word can have letters, numbers, ', ,, .
    // Wait, numbers at the end of a note are durations! e.g. c4.
    // So a word might be cisis'4.
    // But it's easier to lex words as contiguous non-space non-symbol chars.
    const startLine = line;
    const startCol = column;
    let word = '';
    while (i < source.length && !/\s/.test(source[i]!) && !'{}<>[|]=~^-_/#%".\\'.includes(source[i]!)) {
      word += source[i]!;
      advance();
    }
    if (word.length > 0) {
      tokens.push({ type: 'word', value: word, line: startLine, column: startCol });
    } else {
      // Fallback
      advance();
    }
  }

  tokens.push({ type: 'eof', value: '', line, column });
  return tokens;
}
