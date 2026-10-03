// Feature 011 T054 (contract song-definition §2): the song builder. It is exercised on two sources already approved and
// committed for the 007 audit: Mutopia 528 (Ode to Joy, SATB in G major: a soprano line to take, a top voice to extract) and
// Mutopia 1247 (the Greensleeves hymn tune: E minor in 6/8 with a pickup, to transpose up a fourth).
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildScore } from '../../../src/core/musicxml/build';
import { planEngraving } from '../../../src/core/musicxml/engraving/plan';
import { readXml } from '../../../src/core/musicxml/read';
import { buildSong, buildSongs } from '../../../tools/library/build-songs';
import { compareMelody } from '../../../tools/library/fidelity/compare';
import { fromMusicXml } from '../../../tools/library/fidelity/from-musicxml';
import { loadSources, sourceFile } from '../../../tools/library/fidelity/sources';
import { fromLilyPond, readLilyPond } from '../../../tools/library/lilypond/read';
import type { SongDefinition } from '../../../tools/library/songs/definition';

const SOURCES_ROOT = 'content/library/sources';
const sources = loadSources(SOURCES_ROOT);

const notationOf = (id: string) => {
  const manifest = sources.get(id);
  if (!manifest) throw new Error(`no source ${id}`);
  const file = sourceFile(SOURCES_ROOT, manifest, 'notation');
  if (!file) throw new Error(`no notation in ${id}`);
  return fromLilyPond(readLilyPond(new TextDecoder().decode(file.bytes)));
};

const options = { sources, sourcesRoot: SOURCES_ROOT, generatedOn: '2026-09-26', stepOrder: 10 };

const META = {
  level: 'beginner' as const,
  trains: 'A familiar tune in the right hand over block chords in the left.',
  reviewedBy: 'claude-sonnet-5',
  reviewedOn: '2026-09-26',
};

/** Ode to Joy: 16 bars in G major, chords I I IV V per four bars would be too clever - one chord per bar is enough here. */
const ODE_CHORDS = ['I', 'I', 'V', 'I', 'I', 'I', 'V', 'I', 'IV', 'I', 'IV', 'I', 'V', 'I', 'V', 'I'].map(
  (degree, i) => ({
    bar: i + 1,
    degree,
  }),
);

const ode = (over: Partial<SongDefinition> = {}): SongDefinition => ({
  version: 1,
  id: 'learning/keys/g-major/song-ode-to-joy',
  title: 'Song - Ode to Joy',
  source: 'mutopia-528-ode-to-joy',
  melody: { staff: 1, voice: 'staff1:voice:sop', bars: 'all' },
  key: { tonic: 'G', mode: 'major', fifths: 1 },
  tempoBpm: 84,
  chords: ODE_CHORDS,
  meta: { ...META },
  ...over,
});

const greensleeves = (): SongDefinition => ({
  version: 1,
  id: 'learning/keys/a-minor/song-greensleeves',
  title: 'Song - Greensleeves',
  source: 'mutopia-1247-greensleeves-hymntune',
  melody: { staff: 1, voice: 'staff1.1', bars: 'all', transpose: '+P4' },
  key: { tonic: 'A', mode: 'minor', fifths: 0 },
  tempoBpm: 96,
  chords: Array.from({ length: 17 }, (_, bar) => ({ bar, degree: 'i' })),
  meta: { ...META, level: 'intermediate', departures: ['Transposed up a perfect fourth, from E minor to A minor.'] },
});

const staff2 = (xml: string) => fromMusicXml(xml).notes.filter((n) => n.staff === 2);

describe('buildSong: the melody', () => {
  it('refuses a source that is not approved (not among the loaded sources)', () => {
    expect(() => buildSong(ode({ source: 'mutopia-9999-nothing' }), options)).toThrow(/mutopia-9999-nothing/);
  });

  it('takes the melody from the named staff and voice: 0 differences against the source soprano', () => {
    const { xml } = buildSong(ode(), options);
    const result = compareMelody(
      fromMusicXml(xml),
      notationOf('mutopia-528-ode-to-joy'),
      { itemBars: 'all', sourceBars: 'all', staff: 1, sourceStaff: 1, sourceVoice: 'staff1:voice:sop' },
      { allowRhythm: false, spelling: true },
    );
    expect(result.differences).toEqual([]);
  });

  it('takes a bar range and numbers the item from bar 1', () => {
    const { xml } = buildSong(
      ode({ melody: { staff: 1, voice: 'staff1:voice:sop', bars: '5-8' }, chords: ODE_CHORDS.slice(0, 4) }),
      options,
    );
    expect(fromMusicXml(xml).bars.map((b) => b.number)).toEqual(['1', '2', '3', '4']);
    const result = compareMelody(
      fromMusicXml(xml),
      notationOf('mutopia-528-ode-to-joy'),
      { itemBars: '1-4', sourceBars: '5-8', staff: 1, sourceStaff: 1, sourceVoice: 'staff1:voice:sop' },
      { allowRhythm: false, spelling: true },
    );
    expect(result.differences).toEqual([]);
  });

  it('topVoice takes the highest note of each chord of the named voice (a guitar source)', () => {
    const guitar = { staff: 1, voice: 'staff1:voice:A', bars: 'all' };
    const def = ode({
      source: 'mutopia-1111-au-clair-de-la-lune',
      melody: { ...guitar, topVoice: true },
      key: { tonic: 'C', mode: 'major', fifths: 0 },
      id: 'learning/keys/c-major/song-x',
      chords: Array.from({ length: 16 }, (_, i) => ({ bar: i + 1, degree: 'I' })),
    });
    expect(() => buildSong({ ...def, melody: guitar }, options)).toThrow(/topVoice/);
    const { xml } = buildSong(def, options);
    const result = compareMelody(
      fromMusicXml(xml),
      notationOf('mutopia-1111-au-clair-de-la-lune'),
      { itemBars: 'all', sourceBars: 'all', staff: 1, sourceStaff: 1, sourceVoice: 'staff1:voice:A' },
      { allowRhythm: false, spelling: false },
    );
    expect(result.differences).toEqual([]);
  });

  it('transposes E minor to A minor with the spelling of A minor (+P4), keeping the pickup', () => {
    const { xml } = buildSong(greensleeves(), options);
    const result = compareMelody(
      fromMusicXml(xml),
      notationOf('mutopia-1247-greensleeves-hymntune'),
      { itemBars: 'all', sourceBars: 'all', staff: 1, sourceStaff: 1, sourceVoice: 'staff1.1', transpose: '+P4' },
      { allowRhythm: false, spelling: true },
    );
    expect(result.differences).toEqual([]);
    expect(xml).toContain('<fifths>0</fifths>');
    expect(xml).toContain('<mode>minor</mode>');
    expect(fromMusicXml(xml).bars[0]?.number).toBe('0');
  });
});

describe('buildSong: the left hand', () => {
  const bar = (xml: string, n: number) => fromMusicXml(xml).bars[n - 1];
  const inBar = (xml: string, n: number) =>
    staff2(xml)
      .filter((note) => note.bar === n - 1)
      .map((note) => note.midi);

  it('writes one block triad per chord, close position, the root in C3-B3', () => {
    const { xml } = buildSong(ode(), options);
    expect(bar(xml, 1)).toBeDefined();
    expect(inBar(xml, 1)).toEqual([55, 59, 62]); // I = G3 B3 D4
    expect(inBar(xml, 3)).toEqual([50, 54, 57]); // V = D3 F#3 A3
    expect(inBar(xml, 9)).toEqual([48, 52, 55]); // IV = C3 E3 G3
  });

  it('a chord that would pass E4 is written an octave lower, and an inversion keeps its bass note lowest', () => {
    const { xml } = buildSong(
      ode({
        chords: [{ bar: 1, degree: 'V', inversion: 1 }, { bar: 2, degree: 'I', inversion: 2 }, ...ODE_CHORDS.slice(2)],
      }),
      options,
    );
    expect(inBar(xml, 1)).toEqual([54, 57, 62]); // V6 = F#3 A3 D4
    expect(inBar(xml, 2)).toEqual([50, 55, 59]); // I64 = D3 G3 B3 (the top would be D4 + ... = passes E4 an octave up)
  });

  it('holds each chord until the next, tied across barlines', () => {
    const { xml } = buildSong(
      ode({ chords: [{ bar: 1, degree: 'I', until: '3:1' }, ...ODE_CHORDS.slice(2)] }),
      options,
    );
    // bars 1-2 hold I: the same three notes in both bars, each tied over the barline (the reader below keeps the ties apart)
    const { doc } = readXml(xml);
    const left = (buildScore(doc).score.parts[0]?.notes ?? []).filter((n) => n.staff === 2);
    const keys = (measure: number) => left.filter((n) => n.measureIndex === measure).map((n) => n.soundingKey);
    expect(keys(0)).toEqual([55, 59, 62]);
    expect(keys(1)).toEqual([55, 59, 62]);
    expect(xml.match(/<tie type="start"\/>/g)?.length).toBe(3);
    expect(xml.match(/<tie type="stop"\/>/g)?.length).toBe(3);
  });

  it('fingers the left hand 5-3-1, and 5-2-1 in second inversion', () => {
    const { xml } = buildSong(
      ode({ chords: [{ bar: 1, degree: 'I' }, { bar: 2, degree: 'I', inversion: 2 }, ...ODE_CHORDS.slice(2)] }),
      options,
    );
    const { doc } = readXml(xml);
    const { score } = buildScore(doc);
    const left = (score.parts[0]?.notes ?? []).filter((n) => n.staff === 2);
    const fingers = (measure: number) =>
      left.filter((n) => n.measureIndex === measure).map((n) => n.fingerings[0]?.finger);
    expect(fingers(0)).toEqual([5, 3, 1]);
    expect(fingers(1)).toEqual([5, 2, 1]);
  });

  it('prints chord names as words above staff 1, never as <harmony>', () => {
    const { xml } = buildSong(ode(), options);
    expect(xml).toContain('<words>G</words>');
    expect(xml).toContain('<words>D</words>');
    expect(xml).not.toContain('<harmony');
  });

  it('names a minor chord "m" and reads the degrees of a minor key: i, VII in A minor', () => {
    const def = greensleeves();
    const { xml } = buildSong(
      { ...def, chords: def.chords.map((c, i) => (i === 3 ? { ...c, degree: 'VII' } : c)) },
      options,
    );
    expect(xml).toContain('<words>Am</words>');
    expect(xml).toContain('<words>G</words>');
  });

  it('refuses a plan that leaves a full bar without a chord, naming the bar', () => {
    expect(() => buildSong(ode({ chords: ODE_CHORDS.slice(2) }), options)).toThrow(/bar 1/);
    expect(() =>
      buildSong(ode({ chords: [{ bar: 1, degree: 'I', until: '2:1' }, ...ODE_CHORDS.slice(2)] }), options),
    ).toThrow(/bar 2/);
  });
});

describe('buildSong: the file and the sidecar', () => {
  it('loads with no notices and needs no engraving inserts', () => {
    for (const def of [ode(), greensleeves()]) {
      const { xml } = buildSong(def, options);
      const { doc } = readXml(xml);
      const { report } = buildScore(doc);
      expect(report.entries, def.id).toEqual([]);
      expect(planEngraving(doc, 'library').inserts, def.id).toEqual([]);
    }
  });

  it('writes the sidecar of contract §2 step 6', () => {
    const { sidecar } = buildSong(greensleeves(), { ...options, stepOrder: 20 });
    expect(sidecar).toMatchObject({
      version: 1,
      title: 'Song - Greensleeves',
      kind: 'piece',
      level: 'intermediate',
      step: 'song',
      stepOrder: 20,
      arrangement: true,
      hands: 'both',
      tags: ['chords', 'hands-together'],
      reviewedBy: 'claude-sonnet-5',
      reviewedOn: '2026-09-26',
    });
    const provenance = sidecar.provenance as Record<string, string>;
    expect(provenance).toMatchObject({
      origin: 'authored',
      licence: 'CC0-1.0',
      author: 'claude-sonnet-5',
      created: '2026-09-26',
    });
    expect(provenance.basedOn).toContain('mutopia-1247-greensleeves-hymntune');
    expect(provenance.note).toMatch(
      /^Melody from .*\(https:\/\/www\.mutopiaproject\.org.*\), public domain; left-hand chords our own \(CC0\)/,
    );
    const departures = sidecar.departures as string[];
    expect(departures[0]).toBe('Left-hand block chords are our own (CC0).');
    expect(departures.some((d) => /perfect fourth/.test(d))).toBe(true);
  });

  it('writes meta.raisedBecause into the sidecar, and nothing when it is absent (song-definition 1.2.0)', () => {
    const raised = greensleeves();
    raised.meta.raisedBecause = 'Why it sits higher.';
    expect(buildSong(raised, options).sidecar.raisedBecause).toBe('Why it sits higher.');
    expect(buildSong(greensleeves(), options).sidecar).not.toHaveProperty('raisedBecause');
  });

  it('a song without a transposition departs only in its left hand', () => {
    const { sidecar } = buildSong(ode(), options);
    expect(sidecar.departures).toEqual(['Left-hand block chords are our own (CC0).']);
  });
});

describe('buildSongs: a folder of definitions', () => {
  const dir = mkdtempSync(join(tmpdir(), 'songs-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('writes each song and gives stepOrder 10 x position: beginner first, then intermediate, each by title', async () => {
    const contentDir = join(dir, 'songs');
    const libraryRoot = join(dir, 'library');
    const { mkdirSync } = await import('node:fs');
    mkdirSync(contentDir, { recursive: true });
    const a = ode({ id: 'learning/keys/g-major/song-b-second', title: 'Song - B second' });
    const b = ode({ id: 'learning/keys/g-major/song-a-first', title: 'Song - A first' });
    const c = ode({
      id: 'learning/keys/g-major/song-c-intermediate',
      title: 'Song - C intermediate',
      meta: { ...META, level: 'intermediate' },
    });
    for (const [name, def] of [
      ['1', a],
      ['2', b],
      ['3', c],
    ] as const)
      writeFileSync(join(contentDir, `${name}.json`), JSON.stringify(def));
    const written = await buildSongs(contentDir, libraryRoot, SOURCES_ROOT, '2026-09-26');
    expect(written.map((w) => w.replace(/\\/g, '/')).sort()).toEqual([
      'learning/keys/g-major/song-a-first.musicxml',
      'learning/keys/g-major/song-b-second.musicxml',
      'learning/keys/g-major/song-c-intermediate.musicxml',
    ]);
    const order = (id: string) =>
      (JSON.parse(readFileSync(join(libraryRoot, `${id}.json`), 'utf8')) as { stepOrder: number }).stepOrder;
    expect(order('learning/keys/g-major/song-a-first')).toBe(10);
    expect(order('learning/keys/g-major/song-b-second')).toBe(20);
    expect(order('learning/keys/g-major/song-c-intermediate')).toBe(30);
  });
});

describe('buildSong: the left hand stays off the melody (music review of 2026-09-26)', () => {
  // Good King Wenceslas in G major: bar 2's melody is D4 (a half note), which a root-position G chord (G3 B3 D4) would share.
  const wenceslas = (chords: SongDefinition['chords']): SongDefinition => ({
    version: 1,
    id: 'learning/keys/g-major/song-good-king-wenceslas',
    title: 'Song - Good King Wenceslas',
    source: 'mutopia-905-good-king-wenceslas',
    melody: { staff: 1, voice: 'staff1.1', bars: 'all', transpose: '-M2' },
    key: { tonic: 'G', mode: 'major', fifths: 1 },
    tempoBpm: 88,
    chords,
    meta: { ...META, departures: ['Transposed down a major second.'] },
  });
  const tonics = Array.from({ length: 17 }, (_, i) => ({ bar: i + 1, degree: 'I' }));
  const leftKeys = (xml: string, measure: number) => {
    const { doc } = readXml(xml);
    return (buildScore(doc).score.parts[0]?.notes ?? [])
      .filter((n) => n.staff === 2 && n.measureIndex === measure)
      .map((n) => n.soundingKey);
  };

  it('keeps root position where the melody is high, and re-voices the chord under a melody note it would share', () => {
    const { xml } = buildSong(wenceslas(tonics), options);
    expect(leftKeys(xml, 0)).toEqual([55, 59, 62]); // bar 1: G3 B3 D4, the melody starts on G4
    const bar2 = leftKeys(xml, 1); // bar 2: melody D4 (62) for two beats
    expect(bar2).toHaveLength(3);
    expect(Math.max(...bar2)).toBeLessThan(62);
  });

  it('respects an inversion written in the plan, moving it an octave lower when it would share a key', () => {
    const chords = tonics.map((c) => (c.bar === 2 ? { ...c, inversion: 0 as const } : c));
    const { xml } = buildSong(wenceslas(chords), options);
    expect(leftKeys(xml, 1)).toEqual([43, 47, 50]); // G2 B2 D3: still root position
  });
});
