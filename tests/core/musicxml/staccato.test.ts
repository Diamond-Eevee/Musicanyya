// Feature 022 (research R9, data-model §8, owner decision OD-3): a written <staccato/> is read into the score model so
// the timeline can sound it short. The fixture is authored for this test (CC0) and written through the library writer.
import { describe, expect, it } from 'vitest';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import { type WriteNote, writeScoreXml } from '../../../src/core/musicxml/write.js';

function quarter(step: string, extra: Partial<WriteNote> = {}): WriteNote {
  return { pitch: { step, octave: 4 }, duration: 1, voice: '1', type: 'quarter', ...extra };
}

describe('Note.staccato (022 data-model §8)', () => {
  it('is true for a note with <articulations><staccato/>, false for every other note', () => {
    const xml = writeScoreXml({
      parts: [
        {
          id: 'P1',
          name: 'Piano',
          measures: [
            {
              number: '1',
              attributes: { divisions: 1, time: { beats: '4', beatType: 4 } },
              events: [
                { kind: 'direction', metronome: { beatUnit: 'quarter', perMinute: 60 }, tempo: 60, placement: 'above' },
                { kind: 'note', note: quarter('C', { articulations: ['staccato'] }) },
                { kind: 'note', note: quarter('D', { articulations: ['accent'] }) },
                { kind: 'note', note: quarter('E', { articulations: ['accent', 'staccato'] }) },
                { kind: 'note', note: quarter('F') },
              ],
            },
          ],
        },
      ],
    });
    const { score, report } = buildScore(readXml(xml).doc);
    expect(report.entries).toEqual([]);
    const notes = score.parts[0]?.notes ?? [];
    expect(notes.map((n) => [n.step, n.staccato, n.accent])).toEqual([
      ['C', true, false],
      ['D', false, true],
      ['E', true, true],
      ['F', false, false],
    ]);
  });
});
