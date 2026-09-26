import { describe, expect, it } from 'vitest';
import {
  displayKeyName,
  KEYS,
  keyBySlug,
  keySlug,
  RELATIVE_OF_F_SHARP_MAJOR,
} from '../../../../src/core/library/exercise/keys.js';

// Feature 011 research R2 (circle order, F# major paired with Eb minor), data-model §5 (tonic octave).

const CIRCLE = [
  'c-major',
  'a-minor',
  'g-major',
  'e-minor',
  'd-major',
  'b-minor',
  'a-major',
  'f-sharp-minor',
  'e-major',
  'c-sharp-minor',
  'b-major',
  'g-sharp-minor',
  'f-sharp-major',
  'e-flat-minor',
  'd-flat-major',
  'b-flat-minor',
  'a-flat-major',
  'f-minor',
  'e-flat-major',
  'c-minor',
  'b-flat-major',
  'g-minor',
  'f-major',
  'd-minor',
];

describe('the 24-key table', () => {
  it('has 24 keys in the circle-of-fifths order of research R2', () => {
    expect(KEYS.map((k) => k.slug)).toEqual(CIRCLE);
    expect(KEYS.map((k) => k.circleIndex)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
  });

  it('follows every major key with its relative minor', () => {
    for (let i = 0; i < KEYS.length; i += 2) {
      const major = KEYS[i];
      const minor = KEYS[i + 1];
      expect(major?.mode).toBe('major');
      expect(minor?.mode).toBe('minor');
      expect(major?.relativeSlug).toBe(minor?.slug);
      expect(minor?.relativeSlug).toBe(major?.slug);
    }
  });

  it('pairs F sharp major with E flat minor (D sharp minor needs a double sharp in its dominant)', () => {
    expect(RELATIVE_OF_F_SHARP_MAJOR).toBe('e-flat-minor');
    expect(keyBySlug('f-sharp-major')?.relativeSlug).toBe('e-flat-minor');
  });

  it('key signatures are those of the keys (F sharp major 6 sharps, E flat minor 6 flats)', () => {
    const fifths = Object.fromEntries(KEYS.map((k) => [k.slug, k.fifths]));
    expect(fifths['c-major']).toBe(0);
    expect(fifths['a-minor']).toBe(0);
    expect(fifths['g-major']).toBe(1);
    expect(fifths['e-minor']).toBe(1);
    expect(fifths['f-sharp-minor']).toBe(3);
    expect(fifths['g-sharp-minor']).toBe(5);
    expect(fifths['f-sharp-major']).toBe(6);
    expect(fifths['e-flat-minor']).toBe(-6);
    expect(fifths['d-flat-major']).toBe(-5);
    expect(fifths['b-flat-minor']).toBe(-5);
    expect(fifths['f-major']).toBe(-1);
    expect(fifths['d-minor']).toBe(-1);
  });

  it("slugs equal the generator's keySlug and display names carry the sharp and flat signs", () => {
    for (const key of KEYS) {
      expect(keySlug({ tonic: key.tonic, mode: key.mode })).toBe(key.slug);
      expect(displayKeyName({ tonic: key.tonic, mode: key.mode })).toBe(key.displayName);
    }
    expect(keyBySlug('f-sharp-major')?.displayName).toBe('F♯ major');
    expect(keyBySlug('e-flat-minor')?.displayName).toBe('E♭ minor');
    expect(keyBySlug('c-major')?.displayName).toBe('C major');
    expect(keyBySlug('nonsense')).toBeUndefined();
  });

  it('tonic octave by tonic pitch class, in both modes (data-model §5)', () => {
    const octave4 = [
      'c-major',
      'c-minor',
      'd-flat-major',
      'c-sharp-minor',
      'd-major',
      'd-minor',
      'e-flat-major',
      'e-flat-minor',
      'e-major',
      'e-minor',
      'f-major',
      'f-minor',
    ];
    const octave3 = [
      'f-sharp-major',
      'f-sharp-minor',
      'g-major',
      'g-minor',
      'a-flat-major',
      'g-sharp-minor',
      'a-major',
      'a-minor',
      'b-flat-major',
      'b-flat-minor',
      'b-major',
      'b-minor',
    ];
    for (const slug of octave4) expect(keyBySlug(slug)?.tonicOctave, slug).toBe(4);
    for (const slug of octave3) expect(keyBySlug(slug)?.tonicOctave, slug).toBe(3);
    expect(octave4.length + octave3.length).toBe(24);
  });

  it('tonic spelling is a letter with an optional # or b', () => {
    for (const key of KEYS) expect(key.tonic).toMatch(/^[A-G](#|b)?$/);
  });
});
