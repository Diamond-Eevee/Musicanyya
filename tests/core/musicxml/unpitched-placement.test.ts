import { describe, expect, it } from 'vitest';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import { createRenderCopy } from '../../../src/core/musicxml/render-copy.js';
import { unpitchedDisplayRewrites } from '../../../src/core/musicxml/unpitched-placement.js';

/**
 * 017 T047 (follow-up of T045): Verovio 6.3 turns an unpitched note's display-step/-octave into a staff position as if
 * the clef were G2 (tests/verovio/unpitched-clef.test.ts). The render copy moves the display pitch by the distance between
 * the clef in force and G2, so Verovio's treble reading lands where the written clef puts the note. Positions: 0 is the
 * bottom line; under F4, E3 is 5 (third space) and B3 is 9 (above the top line); under G2 those are C5 and G5.
 */

const unpitched = (step: string, octave: number, extra = '') =>
  `<note><unpitched><display-step>${step}</display-step><display-octave>${octave}</display-octave></unpitched><duration>1</duration><type>quarter</type>${extra}</note>`;

function document(clef: string, body: string): string {
  return `<?xml version="1.0"?><score-partwise><part-list><score-part id="P1"><part-name>Drums</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time>${clef}</attributes>${body}</measure></part></score-partwise>`;
}

/** The display pitches in the render copy, in order, as "E3". */
function renderedDisplay(xml: string): string[] {
  const { doc } = readXml(xml);
  const { score } = buildScore(doc);
  const copy = createRenderCopy(xml, { notes: [], measures: [], rewrites: unpitchedDisplayRewrites(xml, score) });
  return [...copy.matchAll(/<display-step>([A-G])<\/display-step><display-octave>(-?\d+)<\/display-octave>/g)].map(
    (m) => `${m[1]}${m[2]}`,
  );
}

const F4 = '<clef><sign>F</sign><line>4</line></clef>';

describe('unpitched notes under a clef other than G2 are placed for Verovio (017 T047)', () => {
  it('F4 clef: E3 (third space) -> C5 and B3 (above the top line) -> G5', () => {
    expect(
      renderedDisplay(document(F4, `${unpitched('E', 3)}${unpitched('B', 3)}${unpitched('E', 3)}${unpitched('B', 3)}`)),
    ).toEqual(['C5', 'G5', 'C5', 'G5']);
  });

  it('alto C3 clef: E3 (just below the bottom line) -> D4', () => {
    const C3 = '<clef><sign>C</sign><line>3</line></clef>';
    expect(renderedDisplay(document(C3, unpitched('E', 3).repeat(4)))[0]).toBe('D4');
  });

  it('G2 and percussion clefs are left as written', () => {
    const G2 = '<clef><sign>G</sign><line>2</line></clef>';
    const perc = '<clef><sign>percussion</sign></clef>';
    expect(renderedDisplay(document(G2, unpitched('E', 3).repeat(4)))).toEqual(['E3', 'E3', 'E3', 'E3']);
    expect(renderedDisplay(document(perc, unpitched('E', 4).repeat(4)))).toEqual(['E4', 'E4', 'E4', 'E4']);
  });

  it('a clef change inside the part applies from where it stands', () => {
    const body = `${unpitched('E', 3)}${unpitched('E', 3)}<attributes><clef><sign>G</sign><line>2</line></clef></attributes>${unpitched('E', 3)}${unpitched('E', 3)}`;
    expect(renderedDisplay(document(F4, body))).toEqual(['C5', 'C5', 'E3', 'E3']);
  });

  it('pitched notes and an unpitched note without a display pitch are untouched', () => {
    const pitched =
      '<note><pitch><step>E</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>';
    const bare = '<note><unpitched/><duration>1</duration><type>quarter</type></note>';
    const xml = document(F4, `${pitched}${bare}${pitched}${bare}`);
    const { score } = buildScore(readXml(xml).doc);
    expect(unpitchedDisplayRewrites(xml, score)).toEqual([]);
  });
});
