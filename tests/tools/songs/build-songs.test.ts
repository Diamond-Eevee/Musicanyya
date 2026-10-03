// Feature 011 T054 (contract song-definition §2): the song builder. It is exercised on two sources already approved and
// committed for the 007 audit: Mutopia 528 (Ode to Joy, SATB in G major: a soprano line to take, a top voice to extract) and
// Mutopia 1247 (the Greensleeves hymn tune: E minor in 6/8 with a pickup, to transpose up a fourth).
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { handStretches } from '../../../src/core/library/playability';
import { buildScore } from '../../../src/core/musicxml/build';
import { planEngraving } from '../../../src/core/musicxml/engraving/plan';
import { readXml } from '../../../src/core/musicxml/read';
import { buildTimeline } from '../../../src/core/timeline/timeline';
import { buildSong, buildSongs } from '../../../tools/library/build-songs';
import { compareMelody } from '../../../tools/library/fidelity/compare';
import { fromMusicXml } from '../../../tools/library/fidelity/from-musicxml';
import { loadSources, sourceFile } from '../../../tools/library/fidelity/sources';
import { q } from '../../../tools/library/fidelity/time';
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

// Feature 022 T052 (contract song-definition 1.2.0): left-hand patterns, `simplifies`, and paired songs ordered together.
describe('022: left-hand patterns (song-definition 1.2.0)', () => {
  const amazing = (pattern: 'waltz' | 'repeated' | 'broken' | 'block'): SongDefinition => ({
    ...(JSON.parse(readFileSync('content/library/songs/amazing-grace.json', 'utf8')) as SongDefinition),
    leftHand: { pattern },
  });
  const left = (xml: string) => {
    const { score } = buildScore(readXml(xml).doc);
    const notes = (score.parts[0]?.notes ?? []).filter((n) => n.staff === 2);
    const onsets = new Map<string, number[]>();
    for (const n of notes) {
      if (n.tie.stop) continue;
      const key = `${n.measureIndex}:${n.onsetInMeasure}`;
      onsets.set(key, [...(onsets.get(key) ?? []), n.soundingKey]);
    }
    return { score, notes, onsets };
  };
  const strikesInBar = (onsets: Map<string, number[]>, measure: number) =>
    [...onsets.entries()]
      .filter(([k]) => Number(k.split(':')[0]) === measure)
      .sort((a, b) => Number(a[0].split(':')[1]) - Number(b[0].split(':')[1]))
      .map(([, keys]) => [...keys].sort((x, y) => x - y));
  const melodyAt = (score: ReturnType<typeof left>['score']) =>
    (score.parts[0]?.notes ?? []).filter((n) => n.staff === 1);
  /** No left-hand strike shares a key with a melody note sounding at the same time. */
  const clearOfMelody = (xml: string) => {
    const { score, notes } = left(xml);
    const at = (n: (typeof notes)[number]) => (score.measures[n.measureIndex]?.startTick ?? 0) + n.onsetInMeasure;
    const melody = melodyAt(score);
    return notes.every(
      (l) =>
        !melody.some(
          (m) => m.soundingKey === l.soundingKey && at(m) < at(l) + l.durationTicks && at(l) < at(m) + m.durationTicks,
        ),
    );
  };
  const comfortable = (xml: string) => {
    const { score } = buildScore(readXml(xml).doc);
    return handStretches(score, buildTimeline(score).timeline, 'comfortable');
  };

  it('block (the default) writes the same song as no leftHand at all', () => {
    const plain = JSON.parse(readFileSync('content/library/songs/amazing-grace.json', 'utf8')) as SongDefinition;
    expect(buildSong(amazing('block'), options).xml).toBe(buildSong(plain, options).xml);
  });

  it('waltz in 3/4: the bass alone on beat 1, the other two chord notes on beats 2 and 3', () => {
    const { xml } = buildSong(amazing('waltz'), options);
    const { onsets } = left(xml);
    const bar = strikesInBar(onsets, 1); // bar 1 (index 1: index 0 is the pickup), a G chord
    expect(bar.map((keys) => keys.length)).toEqual([1, 2, 2]);
    const [bass, second, third] = bar as [number[], number[], number[]];
    expect(second).toEqual(third);
    expect(Math.min(...second)).toBeGreaterThan(bass[0] as number);
    expect([bass[0], ...second].map((k) => k % 12).sort((a, b) => a - b)).toEqual([2, 7, 11]); // G B D
    expect(clearOfMelody(xml)).toBe(true);
    expect(comfortable(xml)).toEqual([]);
  });

  it('repeated: the chord struck on every beat, each a beat long', () => {
    const { xml } = buildSong(amazing('repeated'), options);
    const { onsets } = left(xml);
    const bar = strikesInBar(onsets, 1);
    expect(bar.map((keys) => keys.length)).toEqual([3, 3, 3]);
    expect(clearOfMelody(xml)).toBe(true);
    expect(comfortable(xml)).toEqual([]);
  });

  it('repeated in 6/8: one strike per dotted beat', () => {
    const def = { ...greensleeves(), leftHand: { pattern: 'repeated' as const } };
    const { xml } = buildSong(def, options);
    const bar = strikesInBar(left(xml).onsets, 1);
    expect(bar.map((keys) => keys.length)).toEqual([3, 3]);
    expect(comfortable(xml)).toEqual([]);
  });

  it('broken: root, fifth, third, fifth in eighths', () => {
    const def = { ...ode(), leftHand: { pattern: 'broken' as const } };
    const { xml } = buildSong(def, options);
    const bar = strikesInBar(left(xml).onsets, 0); // a G chord
    expect(bar.map((keys) => keys.length)).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
    const pcs = bar.map((keys) => (keys[0] as number) % 12);
    expect(pcs).toEqual([7, 2, 11, 2, 7, 2, 11, 2]); // G D B D twice
    expect(clearOfMelody(xml)).toBe(true);
    expect(comfortable(xml)).toEqual([]);
  });
});

describe('022: simplified songs and their order (song-definition 1.2.0)', () => {
  it('writes simplifies into the sidecar', () => {
    const def = ode({
      id: 'learning/keys/g-major/song-ode-to-joy-simplified',
      title: 'Song - Ode to Joy (simplified)',
      simplifies: 'learning/keys/g-major/song-ode-to-joy',
    });
    expect(buildSong(def, options).sidecar.simplifies).toBe('learning/keys/g-major/song-ode-to-joy');
  });

  it('orders unpaired songs first (Beginner, then Intermediate, by title), then each pair, simplified first', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'songs-pairs-'));
    try {
      const contentDir = join(dir, 'songs');
      const libraryRoot = join(dir, 'library');
      const { mkdirSync } = await import('node:fs');
      mkdirSync(contentDir, { recursive: true });
      const id = (slug: string) => `learning/keys/g-major/song-${slug}`;
      const defs = [
        ode({ id: id('zed'), title: 'Song - Zed' }),
        ode({ id: id('alpha'), title: 'Song - Alpha', meta: { ...META, level: 'intermediate' } }),
        ode({ id: id('beta'), title: 'Song - Beta', meta: { ...META, level: 'intermediate' } }),
        ode({ id: id('beta-simplified'), title: 'Song - Beta (simplified)', simplifies: id('beta') }),
        ode({ id: id('aaa'), title: 'Song - Aaa', meta: { ...META, level: 'intermediate' } }),
        ode({ id: id('aaa-simplified'), title: 'Song - Aaa (simplified)', simplifies: id('aaa') }),
      ];
      defs.forEach((d, i) => {
        writeFileSync(join(contentDir, `${i}.json`), JSON.stringify(d));
      });
      await buildSongs(contentDir, libraryRoot, SOURCES_ROOT, '2026-10-03');
      const order = (slug: string) =>
        (JSON.parse(readFileSync(join(libraryRoot, `${id(slug)}.json`), 'utf8')) as { stepOrder: number }).stepOrder;
      expect(['zed', 'alpha', 'aaa-simplified', 'aaa', 'beta-simplified', 'beta'].map(order)).toEqual([
        10, 20, 30, 40, 50, 60,
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('the 10 existing songs keep their stepOrder', async () => {
    const pinned: Record<string, number> = {
      'learning/keys/a-minor/song-greensleeves': 10,
      'learning/keys/b-flat-major/song-silent-night': 10,
      'learning/keys/c-major/song-au-clair-de-la-lune': 10,
      'learning/keys/d-major/song-joy-to-the-world': 10,
      'learning/keys/e-minor/song-o-come-o-come-emmanuel': 10,
      'learning/keys/f-major/song-the-holly-and-the-ivy': 10,
      'learning/keys/g-major/song-amazing-grace': 10,
      'learning/keys/g-major/song-good-king-wenceslas': 20,
      'learning/keys/g-major/song-o-come-all-ye-faithful': 30,
      'learning/keys/g-major/song-ode-to-joy': 40,
    };
    const dir = mkdtempSync(join(tmpdir(), 'songs-pinned-'));
    try {
      await buildSongs('content/library/songs', dir, SOURCES_ROOT, '2026-10-03');
      for (const [songId, stepOrder] of Object.entries(pinned)) {
        const sidecar = JSON.parse(readFileSync(join(dir, `${songId}.json`), 'utf8')) as { stepOrder: number };
        expect(sidecar.stepOrder, songId).toBe(stepOrder);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// Feature 022 T077 (contract song-definition 1.2.0, melody.joinShortBars): Leoni (Mutopia 525) prints its phrase ends as
// double bar lines inside 4/4 bars, so the reading has written bars of 3 and 1 beats in the middle of the piece.
describe('022: joining a bar split by a phrase line (melody.joinShortBars)', () => {
  const leoni = (join?: boolean): SongDefinition => ({
    version: 1,
    id: 'learning/keys/e-minor/song-leoni',
    title: 'Song - Leoni',
    source: 'mutopia-525-leoni',
    melody: {
      staff: 1,
      voice: 'staff1:voice:sop',
      bars: 'all',
      ...(join === undefined ? {} : { joinShortBars: join }),
    },
    key: { tonic: 'E', mode: 'minor', fifths: 1 },
    tempoBpm: 84,
    chords: Array.from({ length: 17 }, (_, bar) => ({ bar, degree: 'i' })),
    meta: { ...META, level: 'intermediate' },
  });

  it('without it, the short bar inside the piece is refused, as before', () => {
    expect(() => buildSong(leoni(), options)).toThrow(/source bar 2 is not a full bar/);
    expect(() => buildSong(leoni(false), options)).toThrow(/source bar 2 is not a full bar/);
  });

  it('with it, each 3-beat bar and the 1-beat bar after it are one 4/4 bar: a pickup, 15 full bars, a short last bar', () => {
    const bars = fromMusicXml(buildSong(leoni(true), options).xml).bars;
    expect(bars.map((b) => b.number)).toEqual(Array.from({ length: 17 }, (_, i) => String(i)));
    expect(bars.map((b) => b.length)).toEqual([q(1), ...Array.from({ length: 15 }, () => q(4)), q(3)]);
  });

  it('the melody is still the source soprano note for note: 0 differences', () => {
    const result = compareMelody(
      fromMusicXml(buildSong(leoni(true), options).xml),
      notationOf('mutopia-525-leoni'),
      { itemBars: 'all', sourceBars: 'all', staff: 1, sourceStaff: 1, sourceVoice: 'staff1:voice:sop' },
      { allowRhythm: false, spelling: true },
    );
    expect(result.differences).toEqual([]);
  });

  it('the joined bars load with no notices (no bar shorter than the metre but the pickup and the last)', () => {
    const { report } = buildScore(readXml(buildSong(leoni(true), options).xml).doc);
    expect(report.entries).toEqual([]);
  });
});
