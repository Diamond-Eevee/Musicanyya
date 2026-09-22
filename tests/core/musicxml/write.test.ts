import { describe, expect, it } from 'vitest';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import { writeScoreXml } from '../../../src/core/musicxml/write.js';

describe('writeScoreXml (contracts/exercise-definition.md - the minimal writer)', () => {
  it('round-trips a two-staff, two-measure score with a backup and fingering on every note', () => {
    const xml = writeScoreXml({
      title: 'Round-trip fixture',
      composer: 'Musicanyya practice material',
      parts: [
        {
          id: 'P1',
          name: 'Piano',
          measures: [
            {
              number: '1',
              attributes: {
                divisions: 4,
                key: { fifths: 0 },
                time: { beats: '4', beatType: 4 },
                staves: 2,
                clefs: [
                  { number: 1, sign: 'G', line: 2 },
                  { number: 2, sign: 'F', line: 4 },
                ],
              },
              events: [
                {
                  kind: 'direction',
                  metronome: { beatUnit: 'quarter', perMinute: 66 },
                  tempo: 66,
                  staff: 1,
                },
                {
                  kind: 'direction',
                  words: 'I',
                  staff: 1,
                },
                {
                  kind: 'note',
                  note: {
                    pitch: { step: 'C', octave: 4 },
                    duration: 16,
                    voice: '1',
                    type: 'whole',
                    staff: 1,
                    fingering: 1,
                  },
                },
                {
                  kind: 'note',
                  note: {
                    pitch: { step: 'E', octave: 4 },
                    duration: 16,
                    voice: '1',
                    type: 'whole',
                    staff: 1,
                    chord: true,
                    fingering: 3,
                  },
                },
                {
                  kind: 'note',
                  note: {
                    pitch: { step: 'G', octave: 4 },
                    duration: 16,
                    voice: '1',
                    type: 'whole',
                    staff: 1,
                    chord: true,
                    fingering: 5,
                  },
                },
                { kind: 'backup', duration: 16 },
                {
                  kind: 'note',
                  note: {
                    pitch: { step: 'C', octave: 3 },
                    duration: 16,
                    voice: '5',
                    type: 'whole',
                    staff: 2,
                    fingering: 5,
                  },
                },
                {
                  kind: 'note',
                  note: {
                    pitch: { step: 'E', octave: 3 },
                    duration: 16,
                    voice: '5',
                    type: 'whole',
                    staff: 2,
                    chord: true,
                    fingering: 3,
                  },
                },
                {
                  kind: 'note',
                  note: {
                    pitch: { step: 'G', octave: 3 },
                    duration: 16,
                    voice: '5',
                    type: 'whole',
                    staff: 2,
                    chord: true,
                    fingering: 1,
                  },
                },
              ],
            },
            {
              number: '2',
              events: [
                {
                  kind: 'note',
                  note: {
                    pitch: { step: 'C', octave: 4 },
                    duration: 16,
                    voice: '1',
                    type: 'whole',
                    staff: 1,
                    fingering: 1,
                  },
                },
                { kind: 'backup', duration: 16 },
                {
                  kind: 'note',
                  note: {
                    pitch: { step: 'C', octave: 3 },
                    duration: 16,
                    voice: '5',
                    type: 'whole',
                    staff: 2,
                    fingering: 5,
                  },
                },
                { kind: 'barline', location: 'right', barStyle: 'light-heavy' },
              ],
            },
          ],
        },
      ],
    });

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    // Constitution III / T031's real bug: no comment between the declaration and the root element -
    // Verovio's format-sniffer cannot parse past one even though our own reader tolerates it.
    expect(xml.slice(40, 200)).not.toContain('<!--');

    const { doc } = readXml(xml);
    const { score, report } = buildScore(doc);

    expect(report.entries.filter((e) => e.severity !== 'info' || e.code !== 'defaultTempo')).toEqual([]);
    expect(score.title).toBe('Round-trip fixture');
    expect(score.composer).toBe('Musicanyya practice material');
    expect(score.measures).toHaveLength(2);
    expect(score.tempoMarks[0]).toMatchObject({ qpmNum: 6600, qpmDen: 100 });

    const notes = score.parts[0]?.notes ?? [];
    expect(notes).toHaveLength(8);
    expect(notes.every((n) => n.fingerings.length === 1)).toBe(true);

    const m1 = notes.filter((n) => n.measureIndex === 0);
    const rhChord = m1.filter((n) => n.staff === 1);
    const lhChord = m1.filter((n) => n.staff === 2);
    expect(rhChord.map((n) => n.soundingKey).sort((a, b) => a - b)).toEqual([60, 64, 67]); // C4 E4 G4
    expect(lhChord.map((n) => n.soundingKey).sort((a, b) => a - b)).toEqual([48, 52, 55]); // C3 E3 G3
    // every chord note after the first in a staff shares the first note's onset
    expect(new Set(rhChord.map((n) => n.onsetInMeasure)).size).toBe(1);
    expect(new Set(lhChord.map((n) => n.onsetInMeasure)).size).toBe(1);

    const m2 = notes.filter((n) => n.measureIndex === 1);
    expect(m2.map((n) => n.soundingKey).sort((a, b) => a - b)).toEqual([48, 60]); // C3 whole, C4 whole
  });

  it('is deterministic: the same spec writes byte-identical XML every time', () => {
    const spec = {
      title: 'Determinism check',
      parts: [
        {
          id: 'P1',
          name: 'Piano',
          measures: [
            {
              number: '1',
              attributes: { divisions: 4, time: { beats: '4', beatType: 4 } },
              events: [
                {
                  kind: 'note' as const,
                  note: {
                    pitch: { step: 'C', octave: 4 },
                    duration: 16,
                    voice: '1',
                    type: 'whole' as const,
                    fingering: 1,
                  },
                },
              ],
            },
          ],
        },
      ],
    };
    expect(writeScoreXml(spec)).toBe(writeScoreXml(spec));
  });

  it('writes a rest as <rest/> with no pitch, and round-trips ties', () => {
    const xml = writeScoreXml({
      parts: [
        {
          id: 'P1',
          name: 'Piano',
          measures: [
            {
              number: '1',
              attributes: { divisions: 4, time: { beats: '4', beatType: 4 } },
              events: [
                {
                  kind: 'note',
                  note: {
                    pitch: { step: 'C', octave: 4 },
                    duration: 8,
                    voice: '1',
                    type: 'half',
                    tie: { start: true },
                  },
                },
                {
                  kind: 'note',
                  note: { pitch: { step: 'C', octave: 4 }, duration: 8, voice: '1', type: 'half', tie: { stop: true } },
                },
              ],
            },
            {
              number: '2',
              events: [{ kind: 'note', note: { rest: true, duration: 16, voice: '1', type: 'whole' } }],
            },
          ],
        },
      ],
    });

    const { doc } = readXml(xml);
    const { score } = buildScore(doc);
    const notes = score.parts[0]?.notes ?? [];
    expect(notes).toHaveLength(2); // the rest is not a Note
    expect(notes[0]?.tie).toEqual({ start: true, stop: false });
    expect(notes[1]?.tie).toEqual({ start: false, stop: true });
  });

  it('writes a backward repeat barline that the reader turns into a RepeatMark', () => {
    const xml = writeScoreXml({
      parts: [
        {
          id: 'P1',
          name: 'Piano',
          measures: [
            {
              number: '1',
              attributes: { divisions: 4, time: { beats: '4', beatType: 4 } },
              events: [
                { kind: 'note', note: { pitch: { step: 'C', octave: 4 }, duration: 16, voice: '1', type: 'whole' } },
              ],
            },
            {
              number: '2',
              events: [
                { kind: 'note', note: { pitch: { step: 'D', octave: 4 }, duration: 16, voice: '1', type: 'whole' } },
                { kind: 'barline', location: 'right', repeat: { direction: 'backward' } },
              ],
            },
          ],
        },
      ],
    });
    const { doc } = readXml(xml);
    const { score } = buildScore(doc);
    expect(score.navigation.repeats).toEqual([{ measureIndex: 1, direction: 'backward', times: 2 }]);
  });

  it('escapes XML-significant characters in text content', () => {
    const xml = writeScoreXml({
      title: 'A & B < C',
      parts: [
        {
          id: 'P1',
          name: 'Piano',
          measures: [
            {
              number: '1',
              attributes: { divisions: 4 },
              events: [
                { kind: 'direction', words: 'I <-> V & back' },
                { kind: 'note', note: { pitch: { step: 'C', octave: 4 }, duration: 4, voice: '1', type: 'quarter' } },
              ],
            },
          ],
        },
      ],
    });
    expect(xml).toContain('A &amp; B &lt; C');
    expect(xml).toContain('I &lt;-&gt; V &amp; back');
    const { doc } = readXml(xml);
    expect(() => buildScore(doc)).not.toThrow();
  });
});
