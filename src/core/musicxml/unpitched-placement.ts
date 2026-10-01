import { staffContextAt } from '../notation/context.js';
import { isPlaceableClef, LETTERS, type Letter, staffPosition } from '../notation/staff-position.js';
import type { ClefChange, Score } from '../score/model.js';

/** A text replacement in the source MusicXML, for the render copy only. */
export interface TextRewrite {
  start: number;
  end: number;
  text: string;
}

const TREBLE: ClefChange = { staff: 1, sign: 'G', line: 2, octaveChange: 0, measureIndex: 0, onsetInMeasure: 0 };
const DISPLAY = /<display-step>\s*([A-G])\s*<\/display-step>\s*<display-octave>\s*(-?\d+)\s*<\/display-octave>/;

/**
 * Verovio 6.3 turns an unpitched note's display-step/-octave into a staff position as if the clef were G2, whatever
 * clef is in force (017 T045, tests/verovio/unpitched-clef.test.ts). For every unpitched note under a G, F or C clef
 * other than plain G2 this gives the display pitch that lands, read in G2, on the staff position the written clef
 * gives - e.g. E3 under F4 (third space) becomes C5. Only the render copy is changed: the file, the Score model and the
 * note's sound (its instrument's percussion key) are not. Percussion, TAB and other clefs are left as written. (017 T047)
 */
export function unpitchedDisplayRewrites(xml: string, score: Score): TextRewrite[] {
  const rewrites: TextRewrite[] = [];
  for (const part of score.parts) {
    for (const note of part.notes) {
      if (note.step !== '' || note.source.start <= 0) continue; // pitched, or not from the file
      const body = xml.slice(note.source.start, note.source.end);
      const unpitchedAt = body.indexOf('<unpitched>');
      if (unpitchedAt < 0) continue;
      const match = DISPLAY.exec(body.slice(unpitchedAt));
      if (!match || match.index === undefined) continue; // no display pitch: Verovio's default place, nothing to move
      const { clef } = staffContextAt(score, part.index, note.staff, note);
      if (!isPlaceableClef(clef) || (clef.sign === 'G' && clef.line === 2 && clef.octaveChange === 0)) continue;

      const letter = match[1] as Letter;
      const octave = Number(match[2]);
      const shift = staffPosition(letter, octave, clef).position - staffPosition(letter, octave, TREBLE).position;
      if (shift === 0) continue;
      const index = octave * 7 + LETTERS.indexOf(letter) + shift;
      const moved = `<display-step>${LETTERS[((index % 7) + 7) % 7]}</display-step><display-octave>${Math.floor(index / 7)}</display-octave>`;
      const start = note.source.start + unpitchedAt + match.index;
      rewrites.push({ start, end: start + match[0].length, text: moved });
    }
  }
  return rewrites.sort((a, b) => a.start - b.start);
}
