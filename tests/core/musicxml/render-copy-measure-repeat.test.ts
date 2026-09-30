import { describe, expect, it } from 'vitest';
import { withoutMeasureRepeats } from '../../../src/core/musicxml/render-copy.js';

/**
 * 017 T021 (from 001 T169, Constitution III): a `<measure-repeat>` (the "repeat the previous measure" simile sign) makes
 * Verovio draw one repeat sign instead of the notes the file encodes for that measure. Those notes are played, so they
 * are in the Score model, but no drawn element carried their Note ID - a Grade could never mark them. The render copy
 * leaves the sign out, so the encoded notes are engraved; the file itself is not changed.
 */
describe('withoutMeasureRepeats (render copy only)', () => {
  const note = '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>';

  it('removes a measure-repeat start and the measure-style it leaves empty; the notes stay', () => {
    const xml = `<measure number="2"><attributes><measure-style><measure-repeat type="start">1</measure-repeat></measure-style></attributes>${note}</measure>`;
    const copy = withoutMeasureRepeats(xml);
    expect(copy).not.toContain('measure-repeat');
    expect(copy).not.toContain('measure-style');
    expect(copy).toContain(note);
    expect(copy).toContain('<attributes>');
  });

  it('removes the stop form, self-closing or not, with any attributes and spacing', () => {
    const xml = `<measure-style>\n  <measure-repeat type="stop"/>\n</measure-style><measure-style><measure-repeat slashes="2" type='start' >2</measure-repeat ></measure-style>`;
    expect(withoutMeasureRepeats(xml)).toBe('');
  });

  it('keeps every other measure-style child (a multi-measure rest is engraved as encoded)', () => {
    const xml =
      '<measure-style><multiple-rest>4</multiple-rest><measure-repeat type="start">1</measure-repeat></measure-style>';
    expect(withoutMeasureRepeats(xml)).toBe('<measure-style><multiple-rest>4</multiple-rest></measure-style>');
  });

  it('keeps the sign where the measure encodes no notes - there is nothing to engrave instead (017 T029 audit)', () => {
    const rests = '<note><rest/><duration>4</duration></note>';
    const xml = `<measure number="2"><attributes><measure-style><measure-repeat type="start">1</measure-repeat></measure-style></attributes>${rests}</measure>`;
    expect(withoutMeasureRepeats(xml)).toBe(xml);
    const empty =
      '<measure number="3"><attributes><measure-style><measure-repeat type="start">1</measure-repeat></measure-style></attributes></measure>';
    expect(withoutMeasureRepeats(empty)).toBe(empty);
  });

  it('counts an unpitched note as encoded, and finds the measure when a line break follows `<measure` (017 T029 audit)', () => {
    const sign = '<measure-style><measure-repeat type="start">1</measure-repeat></measure-style>';
    const drum =
      '<note><unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched><duration>4</duration></note>';
    const rests = '<note><rest/><duration>4</duration></note>';
    expect(withoutMeasureRepeats(`<measure number="1"><attributes>${sign}</attributes>${drum}</measure>`)).toBe(
      `<measure number="1"><attributes></attributes>${drum}</measure>`,
    );
    // A pitched measure 1, then a rests-only measure 2 opened with `<measure` and a line break: the sign in measure 2
    // must be judged by measure 2's content, not measure 1's notes
    const xml = `<measure number="1">${note}</measure><measure\n  number="2"><attributes>${sign}</attributes>${rests}</measure>`;
    expect(withoutMeasureRepeats(xml)).toBe(xml);
  });

  it('leaves a document without measure repeats unchanged, byte for byte', () => {
    const xml = `<score-partwise><part id="P1"><measure number="1"><attributes><measure-style><slash type="start"/></measure-style></attributes>${note}</measure></part></score-partwise>`;
    expect(withoutMeasureRepeats(xml)).toBe(xml);
  });
});
