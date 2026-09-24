// Parser for the LilyPond subset (contract fidelity-tools.md §3.1). It builds a music tree and resolves what
// LilyPond itself resolves while parsing: durations carried over from the previous note, in source order. Octaves
// under \relative are resolved later (read.ts), after variables are expanded, as LilyPond does. Every construct
// outside the subset throws LyUnsupportedError with its line and column.
import { type QuarterTime, q } from '../fidelity/time';
import { LyUnsupportedError } from './errors';
import { type LyToken, lexLilyPond } from './lex';

export { LyUnsupportedError } from './errors';

export interface Pos {
  line: number;
  column: number;
}

/** A pitch as written: letter 0-6 from C, alteration, octave marks (' = +1, , = -1), and an optional octave check. */
export interface LyPitch {
  letter: number;
  alter: -2 | -1 | 0 | 1 | 2;
  marks: number;
  check?: number;
  /** The absolute octave (C4 = middle C), filled in by read.ts after \relative is resolved. */
  octave?: number;
}

export interface LyDuration {
  /** 1, 2, 4 ... 128 for whole, half, quarter ...; 0.5 for \breve. */
  base: number;
  dots: number;
  factor: QuarterTime;
  /** The resolved length in quarter notes. */
  length: QuarterTime;
}

export type LyPost =
  | 'tie'
  | 'articulation'
  | 'ornament'
  | 'dynamic'
  | 'slur'
  | 'phrasingSlur'
  | 'beam'
  | 'fingering'
  | 'text'
  | 'pedal'
  | 'other';

/**
 * A post-event in detail, for the converter (contract §3.3): which slur end, which dynamic, which finger. `name` is
 * the command without its backslash, or the shorthand after '-', '^' or '_' ("." for staccato). `placement` is set
 * when the source forces it with '^' (above) or '_' (below).
 */
export type LyMark = (
  | { type: 'slur'; start: boolean; phrasing: boolean }
  | { type: 'dynamic'; name: string }
  | { type: 'pedal'; name: string }
  | { type: 'articulation'; name: string }
  | { type: 'ornament'; name: string }
  | { type: 'fingering'; finger: number }
  /** A string script ("dolce"); `text` is absent for \markup, whose content is not read. */
  | { type: 'text'; text?: string }
) & { placement?: 'above' | 'below' };

export interface LyChordNote {
  pitch: LyPitch;
  tie: boolean;
  post: LyPost[];
  marks: LyMark[];
}

export type LyMusic =
  | { kind: 'seq'; items: LyMusic[]; pos: Pos }
  | { kind: 'sim'; branches: LyMusic[]; voices: boolean; pos: Pos }
  | { kind: 'note'; pitch: LyPitch; duration: LyDuration; tie: boolean; post: LyPost[]; marks: LyMark[]; pos: Pos }
  | {
      kind: 'chord';
      notes: LyChordNote[];
      duration: LyDuration;
      tie: boolean;
      post: LyPost[];
      marks: LyMark[];
      pos: Pos;
    }
  | {
      kind: 'rest';
      rest: 'r' | 'R' | 's';
      duration: LyDuration;
      marks: LyMark[];
      /** A rest placed at a pitch (e4\rest): the pitch sets the staff position and counts for \relative. */
      pitch?: LyPitch;
      pos: Pos;
    }
  | { kind: 'barCheck'; pos: Pos }
  | { kind: 'relative'; ref: LyPitch; body: LyMusic; pos: Pos }
  /** \transpose from to { ... }: every pitch inside moves by the interval from -> to (read.ts). */
  | { kind: 'transpose'; from: LyPitch; to: LyPitch; body: LyMusic; pos: Pos }
  | { kind: 'tuplet'; factor: QuarterTime; body: LyMusic; pos: Pos }
  | { kind: 'grace'; command: string; body: LyMusic; pos: Pos }
  | { kind: 'repeat'; mode: 'volta' | 'unfold'; times: number; body: LyMusic; alternatives: LyMusic[]; pos: Pos }
  | { kind: 'unfoldRepeats'; body: LyMusic; pos: Pos }
  | { kind: 'articulate'; body: LyMusic; pos: Pos }
  | { kind: 'context'; type: string; name?: string; body: LyMusic; pos: Pos }
  | { kind: 'changeStaff'; name: string; pos: Pos }
  | { kind: 'time'; num: number; den: number; pos: Pos }
  | { kind: 'partial'; duration: LyDuration; pos: Pos }
  | { kind: 'key'; tonic: LyPitch; mode: string; pos: Pos }
  | { kind: 'clef'; name: string; pos: Pos }
  | { kind: 'ottava'; octaves: number; pos: Pos }
  | { kind: 'bar'; style: string; pos: Pos }
  | { kind: 'tempo'; text?: string; beat?: LyDuration; bpm?: number; pos: Pos }
  | { kind: 'mark'; post: LyPost; name: string; pos: Pos }
  | { kind: 'variable'; name: string; pos: Pos }
  /** \barNumberCheck #n: LilyPond's own measure number must be n here (read.ts checks it). */
  | { kind: 'barNumberCheck'; n: number; pos: Pos }
  /** A construct that fails only where the music uses it, not where a variable merely defines it. */
  | { kind: 'unsupported'; construct: string; pos: Pos }
  /** \set Timing.measurePosition: the position in the current bar, in quarter notes; negative = before a bar line. */
  | { kind: 'measurePosition'; position: QuarterTime; pos: Pos };

export interface LyScoreBlock {
  music: LyMusic;
  layout: boolean;
  midi: boolean;
}

export interface LyScore {
  header: Record<string, string>;
  variables: Map<string, LyMusic>;
  /** The notation score: the \score with a \layout, or the only one without \midi. */
  music: LyMusic;
  /** What the MIDI score does (research R5): does it unfold repeats, does it use \articulate? */
  midi: { unfoldRepeats: boolean; articulate: boolean };
}

const CONTEXT_TYPES = new Set(['Staff', 'Voice', 'PianoStaff', 'GrandStaff', 'StaffGroup', 'ChoirStaff', 'Dynamics']);

/** Post-event commands after a note (ignored by the comparator; the articulations mark a note that may sound shorter). */
const POST_COMMANDS: Record<string, LyPost> = {};
for (const d of 'p pp ppp pppp ppppp f ff fff ffff fffff mp mf fp sf sff sp spp sfz rfz fz sfp n cresc decresc dim cr decr'.split(
  ' ',
))
  POST_COMMANDS[`\\${d}`] = 'dynamic';
for (const a of 'staccato staccatissimo tenuto accent marcato portato espressivo'.split(' '))
  POST_COMMANDS[`\\${a}`] = 'articulation';
for (const o of 'trill prall mordent turn reverseturn prallprall prallmordent upprall downprall upmordent downmordent pralldown prallup lineprall fermata fermataMarkup shortfermata longfermata verylongfermata segno coda varcoda upbow downbow open stopped flageolet thumb halfopen snappizzicato arpeggio glissando laissezVibrer repeatTie startTrillSpan stopTrillSpan startTextSpan stopTextSpan'.split(
  ' ',
))
  POST_COMMANDS[`\\${o}`] = 'ornament';
for (const s of 'sustainOn sustainOff sostenutoOn sostenutoOff unaCorda treCorde'.split(' '))
  POST_COMMANDS[`\\${s}`] = 'pedal';
Object.assign(POST_COMMANDS, {
  '\\<': 'dynamic',
  '\\>': 'dynamic',
  '\\!': 'dynamic',
  '\\(': 'phrasingSlur',
  '\\)': 'phrasingSlur',
});

/** Articulation shorthands after '-', '^' or '_' (LilyPond's script abbreviations). */
const SHORTHAND: Record<string, LyPost> = {
  '.': 'articulation',
  '-': 'articulation',
  '>': 'articulation',
  '^': 'articulation',
  '+': 'articulation',
  '!': 'articulation',
  _: 'articulation',
};

/** Commands that only change the look of the score; they take no argument. */
const LAYOUT_COMMANDS = new Set(
  `stemUp stemDown stemNeutral voiceOne voiceTwo voiceThree voiceFour oneVoice slurUp slurDown slurNeutral slurDashed
  slurDotted slurSolid tieUp tieDown tieNeutral tieDashed tieDotted tieSolid dynamicUp dynamicDown dynamicNeutral
  phrasingSlurUp phrasingSlurDown phrasingSlurNeutral tupletUp tupletDown tupletNeutral autoBeamOn autoBeamOff shiftOn
  shiftOnn shiftOnnn shiftOff mergeDifferentlyHeadedOn mergeDifferentlyHeadedOff mergeDifferentlyDottedOn
  mergeDifferentlyDottedOff break noBreak pageBreak noPageBreak pageTurn numericTimeSignature defaultTimeSignature
  hideNotes unHideNotes small normalsize tiny teeny large huge breathe arpeggioArrowUp arpeggioArrowDown
  arpeggioNormal arpeggioBracket textLengthOn textLengthOff hideStaffSwitch showStaffSwitch compressFullBarRests
  expandFullBarRests compressEmptyMeasures expandEmptyMeasures newSpacingSection easyHeadsOn easyHeadsOff
  showStaffSwitch pointAndClickOff pointAndClickOn crescHairpin crescTextCresc dimHairpin dimTextDecr dimTextDecresc
  dimTextDim`
    .split(/\s+/)
    .map((c) => `\\${c}`),
);

/** Properties whose change would move notes in pitch or time (contract §3.1: unsupported). */
const TIME_OR_PITCH_PROPERTY =
  /(^|\.)(Timing|measureLength|measurePosition|currentBarNumber|timeSignatureFraction|middleCPosition|middleCClefPosition|middleCOffset|transposition|instrumentTransposition|tempoWholesPerMinute|baseMoment|beatStructure)(\.|$)/;

/** Properties that leave notes out of the printed page. */
const HIDING_PROPERTY = /(^|\.)skipTypesetting$/;

const DUTCH: Record<string, [number, LyPitch['alter']]> = {};
const ENGLISH: Record<string, [number, LyPitch['alter']]> = {};
'cdefgab'.split('').forEach((l, letter) => {
  const add = (table: typeof DUTCH, suffixes: [string, LyPitch['alter']][]) => {
    for (const [s, alter] of suffixes) table[l + s] = [letter, alter];
  };
  add(DUTCH, [
    ['', 0],
    ['is', 1],
    ['isis', 2],
    ['es', -1],
    ['eses', -2],
  ]);
  add(ENGLISH, [
    ['', 0],
    ['s', 1],
    ['sharp', 1],
    ['ss', 2],
    ['x', 2],
    ['sharpsharp', 2],
    ['f', -1],
    ['flat', -1],
    ['ff', -2],
    ['flatflat', -2],
  ]);
});
// Dutch contracted forms: es = e-flat, as = a-flat.
Object.assign(DUTCH, { es: [2, -1], eses: [2, -2], as: [5, -1], ases: [5, -2] });

/** Printed start-repeat bar lines; allowed only where a \repeat volta starts (read.ts checks). */
export const START_REPEAT_BARS = new Set(['.|:', '|:', '[|:']);

export interface LyReadOptions {
  /** 1-based number of the notation \score to read, for a file with one \score per movement (source manifest). */
  score?: number;
}

export function parseLilyPond(source: string, options: LyReadOptions = {}): LyScore {
  const tokens = lexLilyPond(source);
  let pos = 0;
  let pitchNames = DUTCH;
  let lastDuration: LyDuration = duration(4, 0, q(1));
  const variables = new Map<string, LyMusic>();
  const header: Record<string, string> = {};
  const scores: LyScoreBlock[] = [];
  /** Variables holding \markup: text only, used as a script (^\crescendo). */
  const markupVariables = new Set<string>();
  /** Variables holding a post-event (hidePP = \tweak #'stencil ##f \pp), used after a direction mark. */
  const postVariables = new Map<string, { post: LyPost; marks: LyMark[] }>();
  let bookDepth = 0;

  const peek = (k = 0): LyToken => tokens[Math.min(pos + k, tokens.length - 1)] as LyToken;
  const next = (): LyToken => {
    const t = peek();
    if (t.type !== 'eof') pos++;
    return t;
  };
  const at = (t: LyToken): Pos => ({ line: t.line, column: t.column });
  const unsupported = (t: LyToken, construct: string): never => {
    throw new LyUnsupportedError(t.line, t.column, construct);
  };
  const is = (type: LyToken['type'], value?: string, k = 0): boolean => {
    const t = peek(k);
    return t.type === type && (value === undefined || t.value === value);
  };
  const expect = (type: LyToken['type'], value?: string): LyToken => {
    const t = peek();
    if (!is(type, value)) unsupported(t, `expected ${value ?? type}, found '${t.value || t.type}'`);
    return next();
  };
  const skipBlock = (): void => {
    expect('symbol', '{');
    let depth = 1;
    while (depth > 0) {
      const t = next();
      if (t.type === 'eof') unsupported(t, 'unterminated block');
      if (t.type === 'symbol' && t.value === '{') depth++;
      if (t.type === 'symbol' && t.value === '}') depth--;
    }
  };

  // ---- top level ------------------------------------------------------------------------------------------------
  while (!is('eof')) {
    const t = peek();
    if (bookDepth > 0 && is('symbol', '}')) {
      next();
      bookDepth--;
      continue;
    }
    if (t.type === 'command') {
      switch (t.value) {
        case '\\book':
          // A \book only groups its \header, \paper and \score blocks.
          next();
          expect('symbol', '{');
          bookDepth++;
          continue;
        case '\\version':
          next();
          expect('string');
          continue;
        case '\\header':
          next();
          parseHeader(header);
          continue;
        case '\\paper':
        case '\\layout':
        case '\\midi':
          next();
          skipBlock();
          continue;
        case '\\language':
          next();
          setLanguage(expect('string'));
          continue;
        case '\\include': {
          next();
          const file = expect('string');
          if (file.value === 'english.ly') pitchNames = ENGLISH;
          else if (file.value === 'nederlands.ly') pitchNames = DUTCH;
          else unsupported(file, `\\include "${file.value}"`);
          continue;
        }
        case '\\score':
          next();
          scores.push(parseScoreBlock());
          continue;
        case '\\pointAndClickOff':
        case '\\pointAndClickOn':
          next();
          continue;
      }
    }
    if (t.type === 'scheme') {
      if (/^\(set-(global-staff-size|default-paper-size)\b/.test(t.value)) {
        next();
        continue;
      }
      unsupported(t, 'Scheme expression at top level');
    }
    if (t.type === 'word' && is('symbol', '=', 1)) {
      next();
      next();
      parseAssignment(t.value);
      continue;
    }
    scores.push({ music: parseMusic(), layout: false, midi: false });
  }

  if (bookDepth > 0) unsupported(peek(), 'unterminated \\book');
  const notation = scores.filter((s) => s.layout || !s.midi);
  let chosen: LyScoreBlock;
  if (options.score !== undefined) {
    const found = notation[options.score - 1];
    if (!found)
      throw new LyUnsupportedError(1, 1, `score ${options.score} (the file has ${notation.length} notation scores)`);
    chosen = found;
  } else if (notation.length === 1) chosen = notation[0] as LyScoreBlock;
  else
    throw new LyUnsupportedError(
      1,
      1,
      `${notation.length} notation scores (choose one with the source manifest's "score" field)`,
    );
  // The chosen score's own \midi block if it has one, otherwise the file's separate MIDI scores.
  const midiScores = chosen.midi ? [chosen] : scores.filter((s) => s.midi);
  return {
    header,
    variables,
    music: chosen.music,
    midi: {
      unfoldRepeats: midiScores.some((s) => contains(s.music, 'unfoldRepeats')),
      articulate: midiScores.some((s) => contains(s.music, 'articulate')),
    },
  };

  function contains(m: LyMusic, kind: LyMusic['kind']): boolean {
    if (m.kind === kind) return true;
    if (m.kind === 'variable') {
      const v = variables.get(m.name);
      return v !== undefined && contains(v, kind);
    }
    if (m.kind === 'seq') return m.items.some((x) => contains(x, kind));
    if (m.kind === 'sim') return m.branches.some((x) => contains(x, kind));
    if (m.kind === 'repeat') return contains(m.body, kind) || m.alternatives.some((x) => contains(x, kind));
    if ('body' in m) return contains(m.body, kind);
    return false;
  }

  function setLanguage(t: LyToken): void {
    if (t.value === 'english') pitchNames = ENGLISH;
    else if (t.value === 'nederlands') pitchNames = DUTCH;
    else unsupported(t, `\\language "${t.value}"`);
  }

  function parseHeader(into: Record<string, string>): void {
    expect('symbol', '{');
    while (!is('symbol', '}')) {
      const key = expect('word');
      expect('symbol', '=');
      const v = peek();
      if (v.type === 'string') into[key.value] = next().value;
      else if (v.type === 'command' && v.value === '\\markup') {
        next();
        skipMarkup();
      } else if (v.type === 'word' || v.type === 'number' || v.type === 'scheme') next();
      else unsupported(v, `header value for ${key.value}`);
    }
    expect('symbol', '}');
  }

  function parseAssignment(name: string): void {
    const t = peek();
    if (t.type === 'string' || t.type === 'number' || t.type === 'scheme') {
      next();
      return;
    }
    if (t.type === 'command' && t.value === '\\markup') {
      next();
      skipMarkup();
      markupVariables.add(name);
      return;
    }
    if (t.type === 'command' && t.value === '\\tweak') {
      const marks: LyMark[] = [];
      next();
      const post = parseTweak(marks, undefined);
      postVariables.set(name, { post, marks });
      return;
    }
    variables.set(name, parseMusic());
  }

  function parseScoreBlock(): LyScoreBlock {
    expect('symbol', '{');
    let music: LyMusic | undefined;
    let layout = false;
    let midi = false;
    while (!is('symbol', '}')) {
      const t = peek();
      if (t.type === 'command' && (t.value === '\\layout' || t.value === '\\midi')) {
        next();
        skipBlock();
        if (t.value === '\\layout') layout = true;
        else midi = true;
      } else if (t.type === 'command' && t.value === '\\header') {
        next();
        parseHeader({});
      } else {
        if (music) unsupported(t, 'a second music expression in one \\score');
        music = parseMusic();
      }
    }
    const close = expect('symbol', '}');
    if (!music) unsupported(close, '\\score without music');
    return { music: music as LyMusic, layout, midi };
  }

  // ---- music ----------------------------------------------------------------------------------------------------
  function parseMusic(): LyMusic {
    const t = peek();
    const p = at(t);
    if (t.type === 'symbol') {
      switch (t.value) {
        case '{': {
          next();
          const items: LyMusic[] = [];
          while (!is('symbol', '}')) {
            if (is('eof')) unsupported(peek(), 'unterminated { }');
            items.push(parseMusic());
          }
          next();
          return { kind: 'seq', items, pos: p };
        }
        case '<<':
          return parseSimultaneous();
        case '<':
          return parseChord();
        case '|':
          next();
          return { kind: 'barCheck', pos: p };
      }
      unsupported(t, `'${t.value}'`);
    }
    if (t.type === 'word') {
      if (t.value === 'r' || t.value === 'R' || t.value === 's') {
        next();
        const d = parseDurationOrLast();
        const marks: LyMark[] = [];
        parsePostEvents(marks); // e.g. a fermata over a rest, or a dynamic on a spacer
        return { kind: 'rest', rest: t.value, duration: d, marks, pos: p };
      }
      if (t.value in pitchNames) {
        const pitch = parsePitch();
        const d = parseDurationOrLast();
        const marks: LyMark[] = [];
        if (is('command', '\\rest')) {
          next();
          parsePostEvents(marks);
          return { kind: 'rest', rest: 'r', duration: d, marks, pitch, pos: p };
        }
        const post = parsePostEvents(marks);
        return { kind: 'note', pitch, duration: d, tie: post.includes('tie'), post, marks, pos: p };
      }
      unsupported(t, `'${t.value}' (not a note, rest or variable)`);
    }
    if (t.type === 'scheme') unsupported(t, 'Scheme expression in music');
    if (t.type !== 'command') unsupported(t, `'${t.value || t.type}'`);
    return parseCommand();
  }

  function parseSimultaneous(): LyMusic {
    const open = next();
    const branches: LyMusic[] = [];
    let current: LyMusic[] = [];
    let voices = false;
    while (!is('symbol', '>>')) {
      if (is('eof')) unsupported(open, 'unterminated << >>');
      if (is('command', '\\\\')) {
        next();
        voices = true;
        branches.push({ kind: 'seq', items: current, pos: at(open) });
        current = [];
        continue;
      }
      current.push(parseMusic());
    }
    next();
    if (voices) branches.push({ kind: 'seq', items: current, pos: at(open) });
    else branches.push(...current);
    return { kind: 'sim', branches, voices, pos: at(open) };
  }

  function parseChord(): LyMusic {
    const open = next();
    const notes: LyChordNote[] = [];
    while (!is('symbol', '>')) {
      const t = peek();
      if (t.type !== 'word' || !(t.value in pitchNames)) unsupported(t, `'${t.value || t.type}' in a chord`);
      const pitch = parsePitch();
      const noteMarks: LyMark[] = [];
      const post = parsePostEvents(noteMarks);
      notes.push({ pitch, tie: post.includes('tie'), post, marks: noteMarks });
    }
    next();
    if (notes.length === 0) unsupported(open, 'empty chord');
    const d = parseDurationOrLast();
    const marks: LyMark[] = [];
    const post = parsePostEvents(marks);
    return { kind: 'chord', notes, duration: d, tie: post.includes('tie'), post, marks, pos: at(open) };
  }

  function parsePitch(): LyPitch {
    const t = next();
    const [letter, alter] = pitchNames[t.value] as [number, LyPitch['alter']];
    const pitch: LyPitch = { letter, alter, marks: parseOctaveMarks() };
    if ((is('symbol', '!') || is('symbol', '?')) && !peek().spaced) next(); // forced / cautionary accidental: display only
    if (is('symbol', '=') && !peek().spaced) {
      next();
      pitch.check = parseOctaveMarks();
    }
    return pitch;
  }

  function parseOctaveMarks(): number {
    let marks = 0;
    while ((is('symbol', "'") || is('symbol', ',')) && !peek().spaced) marks += next().value === "'" ? 1 : -1;
    return marks;
  }

  function parseDurationOrLast(): LyDuration {
    const d = parseDuration();
    if (d) lastDuration = d;
    return lastDuration;
  }

  /** A written duration: 4, 8., \breve, R1*3, s2*3/4. Returns undefined when none is written. */
  function parseDuration(): LyDuration | undefined {
    const t = peek();
    let base: number;
    if (t.type === 'number') {
      base = Number(t.value);
      if (![1, 2, 4, 8, 16, 32, 64, 128].includes(base)) unsupported(t, `duration ${t.value}`);
    } else if (t.type === 'command' && t.value === '\\breve') base = 0.5;
    else return undefined;
    next();
    let dots = 0;
    while (is('symbol', '.') && !peek().spaced) {
      next();
      dots++;
    }
    let factor = q(1);
    if (is('symbol', '*')) {
      next();
      const num = Number(expect('number').value);
      let den = 1;
      if (is('symbol', '/')) {
        next();
        den = Number(expect('number').value);
      }
      factor = q(num, den);
    }
    return duration(base, dots, factor);
  }

  /** Post-events after a note, chord or rest; their detail goes into `marks` for the converter. */
  function parsePostEvents(marks: LyMark[] = []): LyPost[] {
    const post: LyPost[] = [];
    for (;;) {
      const t = peek();
      if (t.type === 'symbol') {
        if (t.value === '~') post.push('tie');
        else if (t.value === '(' || t.value === ')') {
          post.push('slur');
          marks.push({ type: 'slur', start: t.value === '(', phrasing: false });
        } else if (t.value === '[' || t.value === ']') post.push('beam');
        else if (t.value === ':') unsupported(t, 'tremolo (:)');
        else if (t.value === '-' || t.value === '^' || t.value === '_') {
          next();
          const placement = t.value === '^' ? 'above' : t.value === '_' ? 'below' : undefined;
          post.push(parseDirectedPost(marks, placement));
          continue;
        } else return post;
        next();
        continue;
      }
      if (t.type === 'command' && t.value in POST_COMMANDS) {
        next();
        const kind = POST_COMMANDS[t.value] as LyPost;
        post.push(kind);
        marks.push(commandMark(kind, t.value));
        continue;
      }
      return post;
    }
  }

  /** What follows '-', '^' or '_' on a note. */
  function parseDirectedPost(marks: LyMark[], placement: 'above' | 'below' | undefined): LyPost {
    const t = next();
    const push = (mark: LyMark) => marks.push(placement ? { ...mark, placement } : mark);
    if (t.type === 'symbol' && t.value in SHORTHAND) {
      push({ type: 'articulation', name: t.value });
      return SHORTHAND[t.value] as LyPost;
    }
    if (t.type === 'symbol' && (t.value === '(' || t.value === ')')) {
      push({ type: 'slur', start: t.value === '(', phrasing: false });
      return 'slur';
    }
    if (t.type === 'symbol' && (t.value === '[' || t.value === ']')) return 'beam';
    if (t.type === 'symbol' && t.value === '~') return 'tie';
    if (t.type === 'number') {
      push({ type: 'fingering', finger: Number(t.value) });
      return 'fingering';
    }
    if (t.type === 'string') {
      push({ type: 'text', text: t.value });
      return 'text';
    }
    if (t.type === 'command' && t.value === '\\markup') {
      skipMarkup();
      push({ type: 'text' });
      return 'text';
    }
    if (t.type === 'command' && t.value in POST_COMMANDS) {
      const kind = POST_COMMANDS[t.value] as LyPost;
      push(commandMark(kind, t.value));
      return kind;
    }
    if (t.type === 'command' && t.value === '\\tweak') return parseTweak(marks, placement);
    if (t.type === 'command' && markupVariables.has(t.value.slice(1))) {
      push({ type: 'text' });
      return 'text';
    }
    const stored = t.type === 'command' ? postVariables.get(t.value.slice(1)) : undefined;
    if (stored) {
      for (const m of stored.marks) push(m);
      return stored.post;
    }
    return unsupported(t, `'${t.value}' after a direction mark`);
  }

  /** \tweak property value event: a layout change of one event; the event itself is read as usual. */
  function parseTweak(marks: LyMark[], placement: 'above' | 'below' | undefined): LyPost {
    const t = tokens[pos - 1] as LyToken;
    parsePropertyPath(t);
    parseValue();
    return parseDirectedPost(marks, placement);
  }

  function parseCommand(): LyMusic {
    const t = next();
    const p = at(t);
    const name = t.value;
    if (name in POST_COMMANDS) return { kind: 'mark', post: POST_COMMANDS[name] as LyPost, name, pos: p };
    if (LAYOUT_COMMANDS.has(name)) return { kind: 'seq', items: [], pos: p };
    switch (name) {
      case '\\transpose': {
        const from = peek();
        if (!(from.type === 'word' && from.value in pitchNames)) unsupported(from, '\\transpose pitch');
        const fromPitch = parsePitch();
        const to = peek();
        if (!(to.type === 'word' && to.value in pitchNames)) unsupported(to, '\\transpose pitch');
        const toPitch = parsePitch();
        return { kind: 'transpose', from: fromPitch, to: toPitch, body: parseMusic(), pos: p };
      }
      case '\\relative': {
        if (!(peek().type === 'word' && peek().value in pitchNames)) unsupported(t, '\\relative without a start pitch');
        const ref = parsePitch();
        return { kind: 'relative', ref, body: parseMusic(), pos: p };
      }
      case '\\tuplet':
      case '\\times': {
        const a = Number(expect('number').value);
        expect('symbol', '/');
        const b = Number(expect('number').value);
        if (name === '\\tuplet') parseDuration(); // optional tuplet span: grouping only, no timing effect
        // \tuplet 3/2 plays 3 in the time of 2 (factor 2/3); \times 2/3 states the factor itself.
        const factor = name === '\\tuplet' ? q(b, a) : q(a, b);
        return { kind: 'tuplet', factor, body: parseMusic(), pos: p };
      }
      case '\\grace':
      case '\\acciaccatura':
      case '\\appoggiatura':
      case '\\slashedGrace':
        return { kind: 'grace', command: name, body: parseMusic(), pos: p };
      case '\\repeat': {
        const mode = expect('word');
        if (mode.value !== 'volta' && mode.value !== 'unfold') unsupported(mode, `\\repeat ${mode.value}`);
        const times = Number(expect('number').value);
        const body = parseMusic();
        const alternatives: LyMusic[] = [];
        if (is('command', '\\alternative')) {
          next();
          expect('symbol', '{');
          while (!is('symbol', '}')) alternatives.push(parseMusic());
          next();
        }
        return { kind: 'repeat', mode: mode.value as 'volta' | 'unfold', times, body, alternatives, pos: p };
      }
      case '\\unfoldRepeats':
        return { kind: 'unfoldRepeats', body: parseMusic(), pos: p };
      case '\\articulate':
        return { kind: 'articulate', body: parseMusic(), pos: p };
      case '\\new':
      case '\\context': {
        const type = expect('word');
        if (!CONTEXT_TYPES.has(type.value)) unsupported(type, `${name} ${type.value}`);
        let contextName: string | undefined;
        if (is('symbol', '=')) {
          next();
          const v = next();
          if (v.type !== 'string' && v.type !== 'word') unsupported(v, 'context name');
          contextName = v.value;
        }
        if (is('command', '\\with')) {
          next();
          skipBlock();
        }
        const body = parseMusic();
        return {
          kind: 'context',
          type: type.value,
          ...(contextName !== undefined ? { name: contextName } : {}),
          body,
          pos: p,
        };
      }
      case '\\change': {
        const what = expect('word');
        if (what.value !== 'Staff') unsupported(what, `\\change ${what.value}`);
        expect('symbol', '=');
        const v = next();
        if (v.type !== 'string' && v.type !== 'word') unsupported(v, 'staff name');
        return { kind: 'changeStaff', name: v.value, pos: p };
      }
      case '\\time': {
        const num = Number(expect('number').value);
        expect('symbol', '/');
        const den = Number(expect('number').value);
        return { kind: 'time', num, den, pos: p };
      }
      case '\\partial': {
        const d = parseDuration();
        if (!d) unsupported(peek(), '\\partial without a duration');
        return { kind: 'partial', duration: d as LyDuration, pos: p };
      }
      case '\\key': {
        const tonic = peek();
        if (tonic.type !== 'word' || !(tonic.value in pitchNames)) unsupported(tonic, '\\key tonic');
        const pitch = parsePitch();
        const mode = expect('command');
        return { kind: 'key', tonic: pitch, mode: mode.value.slice(1), pos: p };
      }
      case '\\clef': {
        const v = next();
        if (v.type !== 'string' && v.type !== 'word') unsupported(v, 'clef name');
        return { kind: 'clef', name: v.value, pos: p };
      }
      case '\\ottava': {
        let v = next();
        let sign = 1;
        if (v.type === 'symbol' && v.value === '-') {
          sign = -1;
          v = next();
        }
        const text = v.type === 'scheme' ? v.value : v.type === 'number' ? v.value : '';
        if (!/^-?\d+$/.test(text)) unsupported(v, '\\ottava value');
        return { kind: 'ottava', octaves: sign * Number(text), pos: p };
      }
      case '\\bar': {
        const style = expect('string');
        if (style.value.includes(':') && !START_REPEAT_BARS.has(style.value))
          unsupported(style, `\\bar "${style.value}" (repeats are written with \\repeat)`);
        return { kind: 'bar', style: style.value, pos: p };
      }
      case '\\tempo':
        return parseTempo(p);
      case '\\mark': {
        const v = next();
        if (v.type === 'command' && v.value === '\\markup') skipMarkup();
        else if (
          !(
            v.type === 'string' ||
            v.type === 'number' ||
            v.type === 'scheme' ||
            (v.type === 'command' && v.value === '\\default')
          )
        )
          unsupported(v, '\\mark value');
        return { kind: 'mark', post: 'text', name, pos: p };
      }
      case '\\skip': {
        const d = parseDuration();
        if (!d) unsupported(peek(), '\\skip without a duration');
        return { kind: 'rest', rest: 's', duration: d as LyDuration, marks: [], pos: p };
      }
      case '\\once':
        return parseCommand();
      case '\\set': {
        if (is('word', 'Timing') && is('symbol', '.', 1) && is('word', 'measurePosition', 2)) {
          pos += 3;
          expect('symbol', '=');
          return { kind: 'measurePosition', position: parseMoment(), pos: p };
        }
        const path = parsePropertyPath(t);
        expect('symbol', '=');
        parseValue();
        return layoutOnly(t, path, p);
      }
      case '\\override': {
        const path = parsePropertyPath(t);
        expect('symbol', '=');
        parseValue();
        return layoutOnly(t, path, p);
      }
      case '\\crossStaff':
        // Joins the stems of chords across the two staves (Span_stem_engraver); the notes are as written.
        return parseMusic();
      case '\\shape':
        // \shape #'(offsets) Grob: moves a slur's control points; layout only.
        expect('scheme');
        parsePropertyPath(t);
        return { kind: 'seq', items: [], pos: p };
      case '\\barNumberCheck': {
        const v = expect('scheme');
        if (!/^\d+$/.test(v.value)) unsupported(v, `\\barNumberCheck ${v.value}`);
        return { kind: 'barNumberCheck', n: Number(v.value), pos: p };
      }
      case '\\tupletSpan':
        // Groups tuplet brackets only; no effect on timing.
        if (is('command', '\\default')) next();
        else if (!parseDuration()) unsupported(peek(), '\\tupletSpan without a duration');
        return { kind: 'seq', items: [], pos: p };
      case '\\unset':
        return layoutOnly(t, parsePropertyPath(t), p);
      case '\\revert':
      case '\\omit':
      case '\\hide':
      case '\\accidentalStyle':
        parsePropertyPath(t);
        return { kind: 'seq', items: [], pos: p };
    }
    const variable = name.slice(1);
    if (variables.has(variable)) return { kind: 'variable', name: variable, pos: p };
    return unsupported(t, name);
  }

  function parseTempo(p: Pos): LyMusic {
    const tempo: Extract<LyMusic, { kind: 'tempo' }> = { kind: 'tempo', pos: p };
    if (is('string')) tempo.text = next().value;
    else if (is('command', '\\markup')) {
      next();
      skipMarkup();
    }
    if (is('number')) {
      const beat = parseDuration();
      expect('symbol', '=');
      tempo.bpm = Number(expect('number').value);
      if (beat) tempo.beat = beat;
      if (is('symbol', '-')) {
        next();
        expect('number');
      }
    }
    return tempo;
  }

  /**
   * A \set, \unset or \override: nothing when it only changes the look; an `unsupported` node when the property moves
   * notes in time or pitch, or hides printed music. The node fails where the music uses it, so a variable that
   * defines such a change but is never used (Chopin 468's paperOFF) does not stop the reading.
   */
  function layoutOnly(command: LyToken, path: string, p: Pos): LyMusic {
    if (TIME_OR_PITCH_PROPERTY.test(path) || HIDING_PROPERTY.test(path))
      return { kind: 'unsupported', construct: `${command.value} ${path}`, pos: p };
    return { kind: 'seq', items: [], pos: p };
  }

  /** Context.property or Grob.property / Grob #'property. */
  function parsePropertyPath(command: LyToken): string {
    let path = '';
    for (;;) {
      const t = peek();
      if (t.type === 'word' && (path === '' || path.endsWith('.') || path.endsWith('-'))) path += next().value;
      else if (t.type === 'symbol' && (t.value === '.' || t.value === '-') && !t.spaced && path !== '')
        path += next().value;
      else if (t.type === 'scheme' && t.value.startsWith("'")) path += `.${next().value.slice(1)}`;
      else break;
    }
    if (path === '') unsupported(peek(), `${command.value} without a property`);
    return path;
  }

  /** #(ly:make-moment -1/8) or #(ly:make-moment -1 8): a moment in whole notes, returned in quarter notes. */
  function parseMoment(): QuarterTime {
    const t = expect('scheme');
    const m = /^\(ly:make-moment\s+(-?\d+)(?:\/(\d+)|\s+(\d+))?\s*\)$/.exec(t.value);
    if (!m) return unsupported(t, `measurePosition value ${t.value}`);
    return q(4 * Number(m[1]), Number(m[2] ?? m[3] ?? 1));
  }

  function parseValue(): void {
    const t = next();
    if (t.type === 'scheme' || t.type === 'string' || t.type === 'number' || t.type === 'word') return;
    if (t.type === 'command' && t.value === '\\markup') {
      skipMarkup();
      return;
    }
    unsupported(t, `value '${t.value}'`);
  }

  /** A markup argument: { ... }, a string, a word, or markup commands applied to one. Text only, never music. */
  function skipMarkup(): void {
    const t = peek();
    if (t.type === 'symbol' && t.value === '{') {
      skipBlock();
      return;
    }
    if (t.type === 'string' || t.type === 'word' || t.type === 'scheme') {
      next();
      return;
    }
    if (t.type === 'command') {
      next();
      while (is('scheme')) next();
      if (is('symbol', '{') || is('string') || is('command')) skipMarkup();
      return;
    }
    unsupported(t, 'markup');
  }
}

/** The detailed mark of a post-event command such as \p, \staccato or \sustainOn. */
function commandMark(kind: LyPost, command: string): LyMark {
  const name = command.slice(1);
  if (command === '\\(' || command === '\\)') return { type: 'slur', start: command === '\\(', phrasing: true };
  if (kind === 'dynamic' || kind === 'pedal' || kind === 'articulation' || kind === 'ornament')
    return { type: kind, name };
  return { type: 'text' };
}

function duration(base: number, dots: number, factor: QuarterTime): LyDuration {
  // base 4 = one quarter; each dot adds half of the previous value: length = (4/base) * (2 - 1/2^dots). Numerator
  // and denominator are doubled so that a breve (base 0.5) stays an integer fraction.
  const plain = q(8 * (2 ** (dots + 1) - 1), 2 * base * 2 ** dots);
  return { base, dots, factor, length: q(plain.num * factor.num, plain.den * factor.den) };
}
