import { describe, expect, it } from 'vitest';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import { type WriteEvent, type WriteMeasure, type WriteNote, writeScoreXml } from '../../../src/core/musicxml/write.js';

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

  describe('optional elements for converted pieces (research R13, tasks.md T027)', () => {
    const load = (measures: WriteMeasure[]) => {
      const xml = writeScoreXml({ parts: [{ id: 'P1', name: 'Piano', measures }] });
      const { doc } = readXml(xml);
      const { score, report } = buildScore(doc);
      // Nothing the writer emits may raise a notice (defaultTempo only when no tempo is written).
      const notices = report.entries.filter((e) => e.code !== 'defaultTempo');
      return { xml, score, notices, notes: score.parts[0]?.notes ?? [] };
    };
    const note = (
      step: string,
      octave: number,
      duration: number,
      type: WriteNote['type'],
      extra: Partial<WriteNote> = {},
    ) => ({ kind: 'note', note: { pitch: { step, octave }, duration, voice: '1', type, ...extra } }) as const;
    const first = (events: WriteEvent[], attributes: WriteMeasure['attributes'] = {}): WriteMeasure => ({
      number: '1',
      attributes: { divisions: 4, time: { beats: '4', beatType: 4 }, ...attributes },
      events,
    });

    it('writes a forward repeat, a first and a second ending that the reader turns into navigation marks', () => {
      const { xml, score, notices } = load([
        first([note('C', 4, 16, 'whole')]),
        {
          number: '2',
          events: [
            { kind: 'barline', location: 'left', barStyle: 'heavy-light', repeat: { direction: 'forward' } },
            note('D', 4, 16, 'whole'),
          ],
        },
        {
          number: '3',
          events: [
            { kind: 'barline', location: 'left', ending: { number: '1', type: 'start', text: '1.' } },
            note('E', 4, 16, 'whole'),
            {
              kind: 'barline',
              location: 'right',
              barStyle: 'light-heavy',
              ending: { number: '1', type: 'stop' },
              repeat: { direction: 'backward' },
            },
          ],
        },
        {
          number: '4',
          events: [
            { kind: 'barline', location: 'left', ending: { number: '2', type: 'start', text: '2.' } },
            note('F', 4, 16, 'whole'),
            { kind: 'barline', location: 'right', ending: { number: '2', type: 'discontinue' } },
          ],
        },
      ]);
      expect(notices).toEqual([]);
      expect(xml).toContain('<ending number="1" type="start">1.</ending>');
      expect(xml).toContain('<ending number="2" type="discontinue"/>');
      expect(score.navigation.repeats).toEqual([
        { measureIndex: 1, direction: 'forward', times: 2 },
        { measureIndex: 2, direction: 'backward', times: 2 },
      ]);
      expect(score.navigation.endings).toEqual([
        { measureIndex: 2, type: 'start', numbers: [1] },
        { measureIndex: 2, type: 'stop', numbers: [1] },
        { measureIndex: 3, type: 'start', numbers: [2] },
        { measureIndex: 3, type: 'discontinue', numbers: [2] },
      ]);
    });

    it('writes grace notes with no duration, apart from the principal note they precede', () => {
      const { xml, notes, notices, score } = load([
        first([note('D', 5, 0, '16th', { grace: { slash: true } }), note('C', 5, 16, 'whole')]),
      ]);
      expect(notices).toEqual([]);
      expect(xml).toContain('<note><grace slash="yes"/><pitch><step>D</step><octave>5</octave></pitch><voice>');
      expect(notes).toHaveLength(2);
      const [grace, principal] = notes.sort((a, b) => (a.grace ? -1 : b.grace ? 1 : 0));
      expect(grace?.grace).toMatchObject({ slash: true, index: 1 });
      expect(grace?.durationTicks).toBe(0);
      expect(principal?.grace).toBeNull();
      expect(principal?.onsetInMeasure).toBe(0);
      expect(score.measures[0]?.lengthTicks).toBe(score.measures[0]?.nominalTicks);
    });

    it('writes triplets with <time-modification> and tuplet brackets, at exact thirds of a beat', () => {
      const triplet = (step: string, tuplet?: 'start' | 'stop') =>
        note(step, 4, 2, 'eighth', {
          timeModification: { actual: 3, normal: 2 },
          ...(tuplet ? { tuplet: { type: tuplet } } : {}),
        });
      const { xml, notes, notices, score } = load([
        first([triplet('C', 'start'), triplet('D'), triplet('E', 'stop'), note('F', 4, 18, 'half', { dot: true })], {
          divisions: 6,
        }),
      ]);
      expect(notices).toEqual([]);
      expect(xml).toContain(
        '<type>eighth</type><time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>',
      );
      expect(xml).toContain('<tuplet type="start"/>');
      expect(xml).toContain('<tuplet type="stop"/>');
      const ppq = score.ppq;
      expect(notes.map((n) => n.onsetInMeasure)).toEqual([0, ppq / 3, (2 * ppq) / 3, ppq]);
      expect(notes.slice(0, 3).map((n) => n.durationTicks)).toEqual([ppq / 3, ppq / 3, ppq / 3]);
    });

    it('writes an 8va <octave-shift> whose notes keep their sounding pitch', () => {
      const { xml, notes, notices } = load([
        first([
          { kind: 'direction', octaveShift: { type: 'down', size: 8 }, staff: 1 },
          note('C', 6, 8, 'half'),
          note('E', 6, 8, 'half'),
          { kind: 'direction', octaveShift: { type: 'stop', size: 8 }, staff: 1 },
        ]),
      ]);
      expect(notices).toEqual([]);
      expect(xml).toContain('<direction-type><octave-shift type="down" size="8"/></direction-type>');
      expect(xml).toContain('<direction-type><octave-shift type="stop" size="8"/></direction-type>');
      expect(notes.map((n) => n.soundingKey)).toEqual([84, 88]);
    });

    it('writes a clef, key and time change mid-piece, and a clef change in the middle of a bar', () => {
      const { xml, score, notices, notes } = load([
        first([note('C', 4, 16, 'whole')], {
          key: { fifths: 0, mode: 'major' },
          staves: 1,
          clefs: [{ number: 1, sign: 'G', line: 2 }],
        }),
        {
          number: '2',
          attributes: { key: { fifths: -3, mode: 'minor' }, time: { beats: '3', beatType: 4 } },
          events: [
            note('C', 4, 4, 'quarter'),
            { kind: 'attributes', clefs: [{ number: 1, sign: 'F', line: 4 }] },
            note('C', 3, 8, 'half'),
          ],
        },
      ]);
      expect(notices).toEqual([]);
      expect(xml).toContain('<key><fifths>-3</fifths><mode>minor</mode></key>');
      expect(xml).toContain(
        '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note><attributes><clef number="1"><sign>F</sign><line>4</line></clef></attributes>',
      );
      expect(score.measures[1]?.time).toEqual({ beats: '3', beatType: 4 });
      expect(score.measures[1]?.nominalTicks).toBe(3 * score.ppq);
      expect(notes.map((n) => [n.measureIndex, n.onsetInMeasure, n.soundingKey])).toEqual([
        [0, 0, 60],
        [1, 0, 60],
        [1, score.ppq, 48],
      ]);
    });

    it('writes 16th and 32nd notes, double dots and a whole-bar rest', () => {
      const { xml, notes, notices, score } = load([
        first(
          [
            note('C', 5, 2, '16th'),
            note('D', 5, 1, '32nd'),
            note('E', 5, 1, '32nd'),
            note('F', 5, 28, 'half', { dots: 2 }),
          ],
          { divisions: 8 },
        ),
        {
          number: '2',
          events: [{ kind: 'note', note: { rest: true, measureRest: true, duration: 32, voice: '1', type: 'whole' } }],
        },
      ]);
      expect(notices).toEqual([]);
      expect(xml).toContain('<type>32nd</type>');
      expect(xml).toContain('<type>half</type><dot/><dot/>');
      expect(xml).toContain('<rest measure="yes"/>');
      const ppq = score.ppq;
      expect(notes.map((n) => n.durationTicks)).toEqual([ppq / 4, ppq / 8, ppq / 8, (7 * ppq) / 2]);
      expect(score.measures[1]?.lengthTicks).toBe(4 * ppq);
    });

    it('writes slurs by number, articulations, fermatas and ornaments as notations', () => {
      const { xml, notes, notices } = load([
        first([
          note('C', 4, 4, 'quarter', { slurs: [{ type: 'start', number: 1 }], articulations: ['staccato'] }),
          note('D', 4, 4, 'quarter', { articulations: ['accent', 'tenuto'] }),
          note('E', 4, 4, 'quarter', { slurs: [{ type: 'stop', number: 1 }], ornament: 'trill-mark' }),
          note('F', 4, 4, 'quarter', { fermata: true }),
        ]),
      ]);
      expect(notices).toEqual([]);
      expect(xml).toContain(
        '<notations><slur type="start" number="1"/><articulations><staccato/></articulations></notations>',
      );
      expect(xml).toContain('<articulations><accent/><tenuto/></articulations>');
      expect(xml).toContain(
        '<notations><slur type="stop" number="1"/><ornaments><trill-mark/></ornaments></notations>',
      );
      expect(xml).toContain('<notations><fermata/></notations>');
      expect(notes.map((n) => [n.soundingKey, n.accent, n.ornament])).toEqual([
        [60, false, null],
        [62, true, null],
        [64, false, 'trill'],
        [65, false, null],
      ]);
    });

    it('writes dynamics and hairpins that the reader records per part', () => {
      const { xml, score, notices } = load([
        first([
          { kind: 'direction', dynamics: 'pp', placement: 'below', staff: 1 },
          note('C', 4, 8, 'half'),
          { kind: 'direction', wedge: 'crescendo', placement: 'below', staff: 1 },
          note('D', 4, 8, 'half'),
        ]),
        {
          number: '2',
          events: [{ kind: 'direction', wedge: 'stop', staff: 1 }, note('E', 4, 16, 'whole')],
        },
      ]);
      expect(notices).toEqual([]);
      expect(xml).toContain(
        '<direction placement="below"><direction-type><dynamics><pp/></dynamics></direction-type><staff>1</staff></direction>',
      );
      expect(score.parts[0]?.dynamics).toEqual([{ measureIndex: 0, onsetInMeasure: 0, type: 'pp' }]);
      expect(score.parts[0]?.wedges).toEqual([
        { measureIndex: 0, onsetInMeasure: 2 * score.ppq, type: 'crescendo', number: 1 },
        { measureIndex: 1, onsetInMeasure: 0, type: 'stop', number: 1 },
      ]);
    });

    it('writes pedal marks, which leave the notes untouched', () => {
      const { xml, notes, notices, score } = load([
        first([
          { kind: 'direction', pedal: 'start', placement: 'below', staff: 1 },
          note('C', 4, 8, 'half'),
          { kind: 'direction', pedal: 'stop', placement: 'below', staff: 1 },
          note('D', 4, 8, 'half'),
        ]),
      ]);
      expect(notices).toEqual([]);
      expect(xml).toContain('<direction-type><pedal type="start" line="no"/></direction-type>');
      expect(xml).toContain('<direction-type><pedal type="stop" line="no"/></direction-type>');
      const half = 2 * score.ppq;
      expect(notes.map((n) => [n.onsetInMeasure, n.durationTicks, n.soundingKey])).toEqual([
        [0, half, 60],
        [half, half, 62],
      ]);
    });

    it('writes a tempo word in bold with <sound tempo> and no metronome mark', () => {
      const { xml, score, notices } = load([
        first([
          { kind: 'direction', words: 'Poco moto.', bold: true, tempo: 72, placement: 'above', staff: 1 },
          note('C', 4, 16, 'whole'),
        ]),
      ]);
      expect(notices).toEqual([]);
      expect(xml).toContain(
        '<direction placement="above"><direction-type><words font-weight="bold">Poco moto.</words></direction-type><sound tempo="72"/><staff>1</staff></direction>',
      );
      expect(score.defaultTempoUsed).toBe(false);
      expect(score.tempoMarks).toEqual([{ measureIndex: 0, onsetInMeasure: 0, qpmNum: 7200, qpmDen: 100 }]);
    });

    it('writes an expression word in italics and a written arpeggio on every chord member', () => {
      const { xml, notes, notices } = load([
        first([
          { kind: 'direction', words: 'dolce', italic: true, placement: 'above', staff: 1 },
          note('C', 4, 16, 'whole', { arpeggiate: true }),
          note('E', 4, 16, 'whole', { chord: true, arpeggiate: true }),
        ]),
      ]);
      expect(notices).toEqual([]);
      expect(xml).toContain('<words font-style="italic">dolce</words>');
      expect(notes.map((n) => n.arpeggiate)).toEqual([true, true]);
    });

    it('writes the rights and source lines of a converted piece', () => {
      const xml = writeScoreXml({
        title: 'T',
        rights: 'Public domain. Converted from Mutopia & friends.',
        source: 'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=5',
        parts: [{ id: 'P1', name: 'Piano', measures: [first([note('C', 4, 16, 'whole')])] }],
      });
      expect(xml).toContain(
        '<identification>\n<rights>Public domain. Converted from Mutopia &amp; friends.</rights>\n<encoding><software>Musicanyya</software></encoding>\n<source>https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=5</source>\n</identification>',
      );
      const { report } = buildScore(readXml(xml).doc);
      expect(report.entries.filter((e) => e.code !== 'defaultTempo')).toEqual([]);
    });
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
