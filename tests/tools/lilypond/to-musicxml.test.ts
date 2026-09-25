// The LilyPond -> MusicXML converter (contract fidelity-tools.md §3.3-3.4, task T028). Every supported fixture must
// convert to MusicXML that the fidelity reader reads back identically on every aspect, and that the app loads with no
// unexpected notice. The marks a printed page carries (slurs, dynamics, pedal, ...) are checked in the output text,
// because the comparison does not look at them.
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildScore } from '../../../src/core/musicxml/build';
import { readXml } from '../../../src/core/musicxml/read';
import { type Aspect, compare } from '../../../tools/library/fidelity/compare';
import { fromMusicXml } from '../../../tools/library/fidelity/from-musicxml';
import { main } from '../../../tools/library/lilypond/cli';
import { fromLilyPond, readLilyPond } from '../../../tools/library/lilypond/read';
import { toMusicXml } from '../../../tools/library/lilypond/to-musicxml';
import { LY, MID, midiOf, SOURCE, writeFile } from '../fidelity/tiny-library';

const DIR = 'tests/fixtures/lilypond';
const ALL: Aspect[] = [
  'barCount',
  'barLengths',
  'repeats',
  'playedOrder',
  'pitch',
  'onset',
  'duration',
  'spelling',
  'graceNotes',
];
/** Fixtures the reader rejects on purpose (T011); there is nothing to convert. */
const REJECTED = new Set(['bar-check-wrong.ly', 'unsupported-transpose.ly']);
/**
 * Fixtures with a bar shorter than its time signature that is not an opening pickup, as the printed page has it:
 * - endings-mid-bar.ly: the first ending completes the pickup bar (two eighths), and the last bar is two eighths;
 * - pianostaff.ly: one quarter note under LilyPond's default 4/4.
 * The app reports such a bar as an information notice (as for the Für Elise item); any other notice is unexpected.
 */
const SHORT_BARS = new Set(['endings-mid-bar.ly', 'pianostaff.ly']);

const fixtures = readdirSync(DIR).filter((f) => f.endsWith('.ly') && !REJECTED.has(f));
const read = (name: string) => readLilyPond(readFileSync(join(DIR, name), 'utf8'));
const convert = (name: string) => toMusicXml(read(name), { title: name });
const measures = (xml: string) => xml.split('<measure ').slice(1);

describe('toMusicXml: every supported fixture round-trips', () => {
  it('covers every fixture the reader accepts', () => {
    expect(fixtures.length).toBe(18);
  });

  for (const name of fixtures) {
    it(`${name}: the MusicXML reading equals the LilyPond reading on every aspect`, () => {
      const score = read(name);
      const { xml } = toMusicXml(score, { title: name });
      expect(compare(fromMusicXml(xml), fromLilyPond(score), ALL, { itemBars: 'all', sourceBars: 'all' })).toEqual([]);
    });

    it(`${name}: the app loads the output with no unexpected notice`, () => {
      const { xml } = convert(name);
      const { report } = buildScore(readXml(xml).doc);
      const codes = [...new Set(report.entries.map((e) => e.code))].filter((c) => c !== 'defaultTempo');
      expect(codes).toEqual(SHORT_BARS.has(name) ? ['measureLengthMismatch'] : []);
    });
  }

  it('is deterministic', () => {
    expect(convert('marks.ly').xml).toBe(convert('marks.ly').xml);
  });
});

describe('toMusicXml: what the printed page shows', () => {
  it('writes the title, composer, rights and source it is given, never the .ly header', () => {
    const { xml } = toMusicXml(read('score-blocks.ly'), {
      title: 'From the sidecar',
      composer: 'Sidecar Composer',
      rights: 'Public domain.',
      source: 'https://example.org/piece',
    });
    expect(xml).toContain('<work-title>From the sidecar</work-title>');
    expect(xml).toContain('<creator type="composer">Sidecar Composer</creator>');
    expect(xml).toContain('<rights>Public domain.</rights>');
    expect(xml).toContain('<source>https://example.org/piece</source>');
    expect(xml).not.toContain('Blocks');
    expect(xml).not.toContain('Own work');
  });

  it('marks.ly: tempo, dynamics, hairpin, slur, articulations, fingering, pedal and text', () => {
    const { xml, dropped } = convert('marks.ly');
    expect(xml).toContain(
      '<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>120</per-minute></metronome><words font-weight="bold">Allegro</words></direction-type><sound tempo="120"/><staff>1</staff></direction>',
    );
    expect(xml).toContain('<direction-type><dynamics><p/></dynamics></direction-type>');
    expect(xml).toContain(
      '<notations><slur type="start" number="1"/><articulations><staccato/></articulations></notations>',
    );
    expect(xml).toContain('<articulations><accent/></articulations>');
    expect(xml).toContain('<articulations><tenuto/></articulations>');
    expect(xml).toContain('<slur type="stop" number="1"/>');
    expect(xml).toContain('<pedal type="start" line="no"/>');
    expect(xml).toContain('<pedal type="stop" line="no"/>');
    expect(xml).toContain('<technical><fingering>1</fingering></technical>');
    // A text script prints in LilyPond's upright text font; \markup \italic prints in italics (T096: markup text is
    // now read, so nothing is dropped).
    expect(xml).toContain('<direction placement="above"><direction-type><words>dolce</words>');
    expect(xml).toContain('<direction placement="below"><direction-type><words font-style="italic">x</words>');
    expect(xml).toContain('<wedge type="crescendo"/>');
    expect(xml).toContain('<wedge type="stop"/>');
    expect(xml).toContain('<tie type="start"/>');
    expect(dropped).toEqual([]);
  });

  it('a hairpin end that no note starts or ends at moves to the next note, and is listed (T096, Chopin 468 bar 9)', () => {
    const { xml, dropped } = toMusicXml(readLilyPond("{ << { c'2 d'2 } \\\\ { s4\\< s8 s8\\! s2 } >> | }"));
    expect(xml).toMatch(
      /<wedge type="stop"\/><\/direction-type><staff>1<\/staff><\/direction><note><pitch><step>D<\/step>/,
    );
    expect(dropped).toEqual(['bar 1, beat 1 1/2: hairpin end moved to beat 2 (no note starts or ends there)']);
  });

  it('a named Voice in each staff converts as two voices (T096, Burgmüller 203)', () => {
    const score = readLilyPond(
      '\\new PianoStaff <<\n  \\new Staff = "up" \\context Voice = "V" { c\'\'2 d\'\' | }\n  \\new Staff = "down" \\context Voice = "V" { \\clef bass c2 d | }\n>>',
    );
    const { xml } = toMusicXml(score);
    expect(compare(fromMusicXml(xml), fromLilyPond(score), ALL, { itemBars: 'all', sourceBars: 'all' })).toEqual([]);
    expect(xml).toMatch(/<voice>1<\/voice>.*<backup>.*<voice>5<\/voice>/);
  });

  it('plays at the source MIDI tempo when the notation has no metronome mark, printing none (T096)', () => {
    const { xml } = toMusicXml(read('relative.ly'), { playbackTempo: 96 });
    expect(xml).not.toContain('<metronome>');
    // <direction-type> needs a child; empty words print nothing.
    expect(xml).toContain('<direction><direction-type><words/></direction-type><sound tempo="96"/><staff>1</staff>');
    const { score } = buildScore(readXml(xml).doc);
    expect(score.defaultTempoUsed).toBe(false);
    expect(score.tempoMarks).toEqual([{ measureIndex: 0, onsetInMeasure: 0, qpmNum: 9600, qpmDen: 100 }]);
    // The notation's own metronome mark wins (marks.ly: 4 = 120).
    const marks = buildScore(readXml(toMusicXml(read('marks.ly'), { playbackTempo: 96 }).xml).doc).score;
    expect(marks.tempoMarks).toEqual([{ measureIndex: 0, onsetInMeasure: 0, qpmNum: 12000, qpmDen: 100 }]);
  });

  it('grace.ly: \\acciaccatura and \\slashedGrace are slashed, \\grace and \\appoggiatura are not', () => {
    const { xml } = convert('grace.ly');
    expect(xml.match(/<grace slash="yes"\/>/g)).toHaveLength(2);
    expect(xml.match(/<grace\/>/g)).toHaveLength(2);
    expect(
      xml.match(
        /<grace[^>]*\/><pitch><step>C<\/step><octave>5<\/octave><\/pitch><voice>1<\/voice><type>eighth<\/type>/g,
      ),
    ).toHaveLength(4);
  });

  it('tuplets.ly: both tuplet commands give 3:2 time modification with a bracket per group', () => {
    const { xml } = convert('tuplets.ly');
    expect(xml.match(/<actual-notes>3<\/actual-notes><normal-notes>2<\/normal-notes>/g)).toHaveLength(6);
    expect(xml.match(/<tuplet type="start"\/>/g)).toHaveLength(2);
    expect(xml.match(/<tuplet type="stop"\/>/g)).toHaveLength(2);
  });

  it('ottava.ly: an 8va over bar 1 that ends after its last note; the notes keep their sounding pitch', () => {
    const { xml } = convert('ottava.ly');
    const [bar1, bar2] = measures(xml);
    expect(bar1).toContain('<direction-type><octave-shift type="down" size="8"/></direction-type>');
    expect(bar1).toMatch(/<step>F<\/step><octave>5<\/octave>.*<octave-shift type="stop" size="8"\/>/);
    expect(bar1).toMatch(
      /^[^>]*>(<attributes>.*?<\/attributes>)?<direction[^>]*><direction-type><octave-shift type="down"/,
    );
    expect(bar2).not.toContain('octave-shift');
    expect(bar1).toContain('<pitch><step>C</step><octave>5</octave></pitch>');
  });

  it('time-key-clef.ly: key, clef and time at the start and changed at bar 2', () => {
    const [bar1, bar2] = measures(convert('time-key-clef.ly').xml);
    expect(bar1).toContain(
      '<attributes><divisions>1</divisions><key><fifths>2</fifths><mode>major</mode></key><time><beats>3</beats><beat-type>4</beat-type></time><staves>1</staves><clef number="1"><sign>F</sign><line>4</line></clef></attributes>',
    );
    expect(bar2).toContain(
      '<attributes><key><fifths>-2</fifths><mode>major</mode></key><time><beats>2</beats><beat-type>4</beat-type></time><clef number="1"><sign>G</sign><line>2</line></clef></attributes>',
    );
  });

  it('rests.ly: a whole-bar rest and a spacer that takes time without printing a rest', () => {
    const [, bar2, bar3] = measures(convert('rests.ly').xml);
    expect(bar2).toContain('<rest measure="yes"/><duration>6</duration>');
    expect(bar3).toMatch(/^[^>]*><forward><duration>4<\/duration><\/forward><note><pitch><step>E<\/step>/);
  });

  it('pianostaff.ly: two staves, treble and bass', () => {
    const [bar1] = measures(convert('pianostaff.ly').xml);
    expect(bar1).toContain(
      '<staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef>',
    );
    expect(bar1).toMatch(/<staff>1<\/staff>.*<backup><duration>1<\/duration><\/backup>.*<staff>2<\/staff>/);
  });

  it('voices.ly: two voices on the upper staff and a cross-staff note that stays in its voice', () => {
    const { xml } = convert('voices.ly');
    const [bar1, bar2] = measures(xml);
    expect(bar1).toMatch(/<voice>1<\/voice>.*<backup>.*<voice>2<\/voice>.*<backup>.*<voice>5<\/voice>/);
    // The \new Voice of bar 2 plays G3 on the lower staff: the note keeps the upper staff's voice number.
    expect(bar2).toMatch(
      /<pitch><step>G<\/step><octave>3<\/octave><\/pitch><duration>1<\/duration><voice>3<\/voice><type>quarter<\/type><staff>2<\/staff>/,
    );
  });

  it('volta.ly: a first ending that closes with a backward repeat, and an open second ending', () => {
    const [, bar2, bar3] = measures(convert('volta.ly').xml);
    expect(bar2).toContain('<barline location="left"><ending number="1" type="start">1.</ending></barline>');
    expect(bar2).toContain(
      '<barline location="right"><bar-style>light-heavy</bar-style><ending number="1" type="stop"/><repeat direction="backward"/></barline>',
    );
    expect(bar3).toContain('<barline location="left"><ending number="2" type="start">2.</ending></barline>');
    expect(bar3).toContain('<ending number="2" type="discontinue"/>');
  });

  it('partial.ly: the pickup is measure 0 and implicit', () => {
    const [bar0, bar1] = convert('partial.ly').xml.split('<measure ').slice(1);
    expect(bar0).toMatch(/^number="0" implicit="yes">/);
    expect(bar1).toMatch(/^number="1">/);
  });
});

// ---- pnpm library:convert-ly (contract §1) --------------------------------------------------------------------------

describe('library:convert-ly', () => {
  let root: string;
  let lines: string[];
  const run = (...args: string[]) => main(args, { root, out: (l) => lines.push(l) });
  const itemPath = () => join(root, 'public/library/repertoire/test/scale.musicxml');
  const sha = (d: string | Uint8Array) => createHash('sha256').update(d).digest('hex');
  const writeSource = (mid: Uint8Array, patch: Record<string, unknown> = {}) => {
    const files = SOURCE.files.map((f) => (f.role === 'sound' ? { ...f, sha256: sha(mid) } : f));
    writeFile(root, 'content/library/sources/test-1/scale.ly', LY);
    writeFile(root, 'content/library/sources/test-1/scale.mid', mid);
    writeFile(root, 'content/library/sources/test-1/source.json', JSON.stringify({ ...SOURCE, files, ...patch }));
  };
  const writeSidecar = (origin: string) =>
    writeFile(
      root,
      'public/library/repertoire/test/scale.json',
      JSON.stringify({ title: 'Scale (sidecar)', composer: 'Anonymous', provenance: { origin, credit: 'CC0.' } }),
    );

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'convert-ly-'));
    lines = [];
    writeFile(root, 'public/library/repertoire/test/scale.musicxml', 'old');
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('converts an approved source into the item, with the sidecar title, and reports the MIDI cross-check', () => {
    writeSource(MID);
    writeSidecar('downloaded');
    expect(run('test-1', 'repertoire/test/scale')).toBe(0);
    const xml = readFileSync(itemPath(), 'utf8');
    expect(xml).toContain('<work-title>Scale (sidecar)</work-title>');
    expect(
      compare(fromMusicXml(xml), fromLilyPond(readLilyPond(LY)), ALL, { itemBars: 'all', sourceBars: 'all' }),
    ).toEqual([]);
    expect(lines.join('\n')).toContain('notation vs sound: 0 differences');
  });

  it('refuses a source without the owner approval', () => {
    const { approvedByOwner: _, ...unapproved } = SOURCE;
    writeSource(MID);
    writeFile(root, 'content/library/sources/test-1/source.json', JSON.stringify(unapproved));
    writeSidecar('downloaded');
    expect(run('test-1', 'repertoire/test/scale')).toBe(1);
    expect(lines.join('\n')).toContain('approvedByOwner');
    expect(readFileSync(itemPath(), 'utf8')).toBe('old');
  });

  it('refuses to overwrite an authored item without --replace, and replaces it with --replace', () => {
    writeSource(MID);
    writeSidecar('authored');
    expect(run('test-1', 'repertoire/test/scale')).toBe(1);
    expect(lines.join('\n')).toContain('--replace');
    expect(readFileSync(itemPath(), 'utf8')).toBe('old');
    expect(run('test-1', 'repertoire/test/scale', '--replace')).toBe(0);
    expect(readFileSync(itemPath(), 'utf8')).toContain('<score-partwise');
  });

  it('refuses when the MIDI cross-check finds a difference, and names it', () => {
    writeSource(midiOf([60, 62, 63, 65])); // E4 planted as E-flat 4 in the MIDI
    writeSidecar('downloaded');
    expect(run('test-1', 'repertoire/test/scale')).toBe(1);
    expect(lines.join('\n')).toMatch(/bar 1, beat 2: pitch E4, source D#4/);
    expect(readFileSync(itemPath(), 'utf8')).toBe('old');
  });

  it("plays the conversion at the MIDI's tempo when the notation has no metronome mark (T096)", () => {
    writeSource(midiOf([60, 62, 64, 65], 600000)); // 100 quarters per minute
    writeSidecar('downloaded');
    expect(run('test-1', 'repertoire/test/scale')).toBe(0);
    expect(readFileSync(itemPath(), 'utf8')).toContain('<sound tempo="100"/>');
    expect(lines.join('\n')).toContain('playback tempo 100 from the source MIDI');
  });

  it('refuses an unknown source or item', () => {
    writeSource(MID);
    writeSidecar('downloaded');
    expect(run('nope', 'repertoire/test/scale')).toBe(1);
    expect(run('test-1', 'repertoire/test/nope')).toBe(1);
    expect(run()).toBe(2);
  });
});
