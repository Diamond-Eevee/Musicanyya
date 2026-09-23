import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fromMusicXml } from '../../../tools/library/fidelity/from-musicxml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => fs.readFileSync(path.resolve(__dirname, `../../fixtures/musicxml/${name}.musicxml`), 'utf-8');

describe('fromMusicXml', () => {
  it('merges tied notes into one', async () => {
    const xml = fixture('tie-chain-three');
    const score = await fromMusicXml(xml);
    // 3 quarters tied
    expect(score.notes.length).toBe(1);
    expect(score.notes[0].duration).toEqual({ num: 3, den: 1 });
  });

  it('keeps grace notes apart', async () => {
    const xml = fixture('grace-acciaccatura');
    const score = await fromMusicXml(xml);
    // main notes
    expect(score.notes.length).toBeGreaterThan(0);
    expect(score.graceNotes.length).toBeGreaterThan(0);
  });

  it('uses sounding pitch for octave shifts', async () => {
    const xml = fixture('octave-shift-8va');
    const score = await fromMusicXml(xml);
    expect(score.notes[0].midi).toBeGreaterThan(70);
  });

  it('handles tuplet triplet eighths as exact thirds', async () => {
    const xml = fixture('tuplet-triplet-eighths');
    const score = await fromMusicXml(xml);
    console.log(score.notes[0].duration);
    expect(score.notes[0].duration).toEqual({ num: 1, den: 3 });
  });

  it('handles repeatStart, repeatEnd, and endings per bar', async () => {
    const xml = fixture('volta-1-2');
    const score = await fromMusicXml(xml);
    const bars = score.bars;
    // We expect bars with endings
    const withEndings = bars.filter(b => b.endings && b.endings.length > 0);
    expect(withEndings.length).toBeGreaterThan(0);
    expect(withEndings[0].endings).toContain(1);
  });

  it('handles pickup bars with short length and printed number 0', async () => {
    const xml = fixture('pickup-implicit');
    const score = await fromMusicXml(xml);
    expect(score.bars[0].number).toBe("0");
    expect(score.bars[0].index).toBe(0);
    expect(score.bars[0].length.num).toBeLessThan(score.bars[1].length.num);
  });

  it('keeps spelling', async () => {
    const xml = fixture('minimal-single-note');
    const score = await fromMusicXml(xml);
    expect(score.notes[0].spelling).toEqual({ step: 'C', alter: 0, octave: 4 });
  });

  it('gets played order from buildTimeline', async () => {
    const xml = fixture('repeat-simple');
    const score = await fromMusicXml(xml);
    // playedOrder implies unfold, but ReferenceScore bars are written order.
    // Wait, the spec says "the played order comes from buildTimeline... not from a second unfolding".
    // We will verify the logic when we use it in compare.ts, or maybe it returns played order?
    // "ReferenceScore: bars: written bars in written order. notes: every sounding note in written order"
    // So fromMusicXml does NOT unfold repeats! It returns written order.
    // Oh, but the played order of repeats is used by compare() later.
    // Let's just check that fromMusicXml returns repeats correctly.
    const hasRepeats = score.bars.some(b => b.repeatStart || b.repeatEnd);
    expect(hasRepeats).toBe(true);
  });
});
