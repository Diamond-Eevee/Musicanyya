import type { ReferenceBar, ReferenceGraceNote, ReferenceNote, ReferenceScore } from '../fidelity/midi';
import type { QuarterTime } from '../fidelity/time';
import { add, cmp, q, sub } from '../fidelity/time';
import type { LyNode, LyScore } from './parse';
import { LyUnsupportedError, parseLilyPond } from './parse';

export function readLilyPond(source: string): LyScore {
  return parseLilyPond(source);
}

export function fromLilyPond(score: LyScore): ReferenceScore {
  const bars: ReferenceBar[] = [];
  const notes: ReferenceNote[] = [];
  const graceNotes: ReferenceGraceNote[] = [];

  const variables = new Map<string, LyNode>();
  const activeTies = new Map<number, ReferenceNote>();

  const _currentStaff = 1;
  const _currentVoice = 1;

  // Find variables first
  for (const block of score.blocks) {
    if (block.type === 'assignment') {
      variables.set(block.name, block.value);
    }
  }

  interface State {
    cursor: QuarterTime;
    staff: number;
    voice: number;
    lastDuration: string;
    lastPitchDiatonic: number;
    relative: boolean;
    tupletScale: { num: number; den: number };
    time: { num: number; den: number };
    grace: boolean;
    ottava: number;
    unfoldRepeats: boolean;
    barOffset: QuarterTime;
  }

  const state: State = {
    cursor: q(0, 1),
    staff: 1,
    voice: 1,
    lastDuration: '4', // default
    lastPitchDiatonic: 3 * 7, // middle C is C4 = 3 * 7 = 21 ? let's define C0 = 0. C4 = 28.
    relative: false,
    tupletScale: { num: 1, den: 1 },
    time: { num: 4, den: 4 },
    grace: false,
    ottava: 0,
    unfoldRepeats: false,
    barOffset: q(0, 1),
  };

  const stepToDiatonic: Record<string, number> = { c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6 };
  const stepToMidi: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

  function parsePitch(pitchStr: string): {
    step: string;
    alter: number;
    octave: number;
    diatonic: number;
    midi: number;
  } {
    const match = pitchStr.match(/^([a-g])(is|es|isis|eses)*([',]*)$/);
    if (!match) throw new Error(`Invalid pitch: ${pitchStr}`);
    const step = match[1]!;
    const acc = match[2] || '';
    const oct = match[3] || '';

    let alter = 0;
    if (acc === 'is') alter = 1;
    if (acc === 'isis') alter = 2;
    if (acc === 'es') alter = -1;
    if (acc === 'eses') alter = -2;

    let octaveShift = 0;
    for (const char of oct) {
      if (char === "'") octaveShift++;
      if (char === ',') octaveShift--;
    }

    const stepDiatonic = stepToDiatonic[step as keyof typeof stepToDiatonic] || 0;

    let octave = 3; // LilyPond absolute pitches default to octave 3 (c is C3)

    if (state.relative) {
      const prevDiatonic = state.lastPitchDiatonic;
      const prevStep = prevDiatonic % 7;
      let prevOctave = Math.floor(prevDiatonic / 7);

      const diff = stepDiatonic - prevStep;
      if (diff > 3) prevOctave--;
      else if (diff < -3) prevOctave++;

      octave = prevOctave + octaveShift;
    } else {
      octave = 3 + octaveShift;
    }

    const diatonic = octave * 7 + stepDiatonic;
    const midi = (octave + 1) * 12 + (stepToMidi[step as keyof typeof stepToMidi] || 0) + alter; // C3 is midi 48 (octave 3 + 1 = 4 -> 4*12=48)
    // Wait, LilyPond absolute "c" is C3 (MIDI 48).
    // So octave 3. Midi for C3 = 48 = (3 + 1) * 12. Correct.

    return { step, alter, octave, diatonic, midi };
  }

  function parseDuration(durStr?: string): QuarterTime {
    if (!durStr) durStr = state.lastDuration;
    else state.lastDuration = durStr;

    let dots = 0;
    let base = durStr;
    while (base.endsWith('.')) {
      dots++;
      base = base.slice(0, -1);
    }

    let val: QuarterTime;
    if (base === '\\breve') val = q(8, 1);
    else if (base === '1') val = q(4, 1);
    else if (base === '2') val = q(2, 1);
    else if (base === '4') val = q(1, 1);
    else if (base === '8') val = q(1, 2);
    else if (base === '16') val = q(1, 4);
    else if (base === '32') val = q(1, 8);
    else if (base === '64') val = q(1, 16);
    else val = q(1, 1);

    let multiplier = 1;
    let dotVal = 0.5;
    for (let i = 0; i < dots; i++) {
      multiplier += dotVal;
      dotVal /= 2;
    }

    const num = val.num * multiplier * state.tupletScale.num;
    const den = val.den * state.tupletScale.den;
    return q(num, den);
  }

  let maxCursor = q(0, 1);

  function evaluate(node: LyNode) {
    if (node.type === 'assignment') return;

    if (node.type === 'command' && node.name.startsWith('\\') && variables.has(node.name.slice(1))) {
      evaluate(variables.get(node.name.slice(1))!);
      return;
    }

    if (node.type === 'command') {
      if (node.name === '\\relative') {
        const oldRel = state.relative;
        const oldPitch = state.lastPitchDiatonic;
        state.relative = true;
        if (node.args.length > 0) {
          const p = parsePitch(node.args[0]);
          state.lastPitchDiatonic = p.diatonic;
        } else {
          state.lastPitchDiatonic = 3 * 7; // c' is C4 -> wait, no arg means c'
        }
        // block is handled if it's a block command
        state.relative = oldRel;
        state.lastPitchDiatonic = oldPitch;
      } else if (node.name === '\\ottava') {
        state.ottava = parseInt(node.args[0] || '0', 10);
      } else if (node.name === '\\time') {
        const parts = node.args[0].split('/');
        state.time = { num: parseInt(parts[0], 10), den: parseInt(parts[1], 10) };
      } else if (node.name === '\\partial') {
        const dur = parseDuration(node.args[0]);
        const barLength = q(state.time.num * 4, state.time.den);
        state.barOffset = sub(barLength, dur);
      } else if (node.name === '\\key' || node.name === '\\clef') {
        // ignore for reference score unless we want to track bars.
      } else if (node.name === '\\bar') {
        // check bar check?
      } else if (node.name === '\\change') {
        // \change Staff = "down"
      }
    }

    if (node.type === 'block') {
      if (node.name === '<<>>') {
        const oldCursor = state.cursor;
        let max = state.cursor;
        for (const child of node.body) {
          if (child.type === 'symbol' && child.value === '\\\\') {
            state.cursor = oldCursor;
            state.voice++;
          } else {
            evaluate(child);
            if (cmp(state.cursor, max) > 0) max = state.cursor;
          }
        }
        state.cursor = max;
        state.voice = 1;
      } else if (node.name === '\\new') {
        if (node.args[0] === 'Staff') {
          state.staff++;
          const oldStaff = state.staff;
          const _oldCursor = state.cursor;
          for (const child of node.body) evaluate(child);
          state.staff = oldStaff - 1;
        } else if (node.args[0] === 'Voice') {
          state.voice++;
          const oldVoice = state.voice;
          const _oldCursor = state.cursor;
          for (const child of node.body) evaluate(child);
          state.voice = oldVoice - 1;
        } else {
          for (const child of node.body) evaluate(child);
        }
      } else if (node.name === '\\relative') {
        const oldRel = state.relative;
        const oldPitch = state.lastPitchDiatonic;
        state.relative = true;
        if (node.args.length > 0) {
          const match = node.args[0].match(/^([a-g])(is|es|isis|eses)*([',]*)$/);
          let octaveShift = 0;
          if (match) {
            const oct = match[3] || '';
            for (const char of oct) {
              if (char === "'") octaveShift++;
              if (char === ',') octaveShift--;
            }
          }
          // relative C is C3 (diatonic 21). c' is C4 (28)
          state.lastPitchDiatonic = 21 + octaveShift * 7;
        } else {
          state.lastPitchDiatonic = 21;
        }
        for (const child of node.body) evaluate(child);
        state.relative = oldRel;
        state.lastPitchDiatonic = oldPitch;
      } else if (node.name === '\\tuplet' || node.name === '\\times') {
        const oldScale = { ...state.tupletScale };
        if (node.name === '\\tuplet') {
          const parts = node.args[0].split('/');
          state.tupletScale = { num: parseInt(parts[1], 10), den: parseInt(parts[0], 10) };
        } else {
          const parts = node.args[0].split('/');
          state.tupletScale = { num: parseInt(parts[0], 10), den: parseInt(parts[1], 10) };
        }
        for (const child of node.body) evaluate(child);
        state.tupletScale = oldScale;
      } else if (
        node.name === '\\grace' ||
        node.name === '\\acciaccatura' ||
        node.name === '\\appoggiatura' ||
        node.name === '\\slashedGrace'
      ) {
        const oldGrace = state.grace;
        state.grace = true;
        for (const child of node.body) evaluate(child);
        state.grace = oldGrace;
      } else if (node.name === '\\afterGrace') {
        evaluate(node.body[0]!);
        const oldGrace = state.grace;
        state.grace = true;
        evaluate(node.body[1]!);
        state.grace = oldGrace;
      } else if (node.name === '\\unfoldRepeats') {
        const oldUnfold = state.unfoldRepeats;
        state.unfoldRepeats = true;
        for (const child of node.body) evaluate(child);
        state.unfoldRepeats = oldUnfold;
      } else if (node.name === '\\repeat') {
        if (node.args[0] === 'unfold') {
          const times = parseInt(node.args[1], 10);
          for (let i = 0; i < times; i++) {
            for (const child of node.body) evaluate(child);
          }
        } else if (node.args[0] === 'volta') {
          const times = parseInt(node.args[1], 10);
          if (state.unfoldRepeats) {
            for (let i = 0; i < times; i++) {
              for (const child of node.body) evaluate(child);
            }
          } else {
            for (const child of node.body) evaluate(child);
          }
        }
      }
    }

    if (node.type === 'music_list') {
      for (const child of node.elements) evaluate(child);
    }

    if (node.type === 'symbol') {
      if (node.value === '|') {
        const offsetCursor = add(state.cursor, state.barOffset);
        if ((offsetCursor.num * state.time.den) % (offsetCursor.den * state.time.num * 4) !== 0) {
          throw new LyUnsupportedError(node.line, node.column, 'misplaced bar check');
        }
      }
    }

    if (node.type === 'note') {
      const p = parsePitch(node.pitch);
      state.lastPitchDiatonic = p.diatonic;
      const dur = parseDuration((node as any).duration || '');

      const midi = p.midi + state.ottava * 12; // ottava changes sounding pitch

      if (state.grace) {
        graceNotes.push({
          bar: 0, // bar assignment happens later
          before: state.cursor,
          midi,
          spelling: { step: p.step.toUpperCase() as any, alter: p.alter as any, octave: p.octave },
        });
      } else {
        const newNote = {
          bar: 0,
          onset: state.cursor,
          duration: dur,
          midi,
          spelling: { step: p.step.toUpperCase() as any, alter: p.alter as any, octave: p.octave },
          staff: state.staff,
          voice: String(state.voice),
        };

        // Handle ties
        const activeTie = activeTies.get(midi);
        if (activeTie) {
          activeTie.duration = add(activeTie.duration, dur);
          if (node.ties) {
            activeTies.set(midi, activeTie);
          } else {
            activeTies.delete(midi);
          }
        } else {
          notes.push(newNote);
          if (node.ties) {
            activeTies.set(midi, newNote);
          }
        }

        state.cursor = add(state.cursor, dur);
        if (cmp(state.cursor, maxCursor) > 0) maxCursor = state.cursor;
      }
    }

    if (node.type === 'chord') {
      const dur = parseDuration(node.duration || '');
      let first = true;
      for (const pitchStr of node.notes) {
        const p = parsePitch(pitchStr);
        if (first) {
          state.lastPitchDiatonic = p.diatonic;
          first = false;
        }
        const midi = p.midi + state.ottava * 12; // ottava changes sounding pitch
        if (state.grace) {
          graceNotes.push({
            bar: 0,
            before: state.cursor,
            midi,
            spelling: { step: p.step.toUpperCase() as any, alter: p.alter as any, octave: p.octave },
          });
        } else {
          const newNote = {
            bar: 0,
            onset: state.cursor,
            duration: dur,
            midi,
            spelling: { step: p.step.toUpperCase() as any, alter: p.alter as any, octave: p.octave },
            staff: state.staff,
            voice: String(state.voice),
          };

          const activeTie = activeTies.get(midi);
          if (activeTie) {
            activeTie.duration = add(activeTie.duration, dur);
            if (node.ties) {
              activeTies.set(midi, activeTie);
            } else {
              activeTies.delete(midi);
            }
          } else {
            notes.push(newNote);
            if (node.ties) {
              activeTies.set(midi, newNote);
            }
          }
        }
      }
      if (!state.grace) {
        state.cursor = add(state.cursor, dur);
        if (cmp(state.cursor, maxCursor) > 0) maxCursor = state.cursor;
      }
    }

    if (node.type === 'rest') {
      const dur = parseDuration(node.duration || '');
      state.cursor = add(state.cursor, dur);
      if (cmp(state.cursor, maxCursor) > 0) maxCursor = state.cursor;
    }
  }

  for (const block of score.blocks) {
    evaluate(block);
  }

  // Assign bars
  // A simple pass: group by time signature (default 4/4)
  // Let's assume 4/4 for now, or just one big bar if no barlines.
  bars.push({
    index: 0,
    number: '1',
    start: q(0, 1),
    length: maxCursor,
    repeatStart: false,
    repeatEnd: false,
    endings: [],
  });

  return {
    origin: 'lilypond',
    bars,
    notes,
    graceNotes,
  };
}
