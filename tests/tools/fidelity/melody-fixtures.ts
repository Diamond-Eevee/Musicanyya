// Test-only builder for two-staff MusicXML fixtures used by melody-rules.test.ts (T005). It writes plain
// score-partwise XML by hand - no import from src/core/library/exercise/ - so the melody rule check's own tests stay
// independent of the generator it is meant to catch mistakes in (research R8).
export type Letter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export type FixtureValue = 'whole' | 'half' | 'quarter' | 'eighth' | 'dotted-half' | 'dotted-quarter';

const DIVISIONS = 4;
const TICKS: Record<FixtureValue, number> = {
  whole: 16,
  half: 8,
  quarter: 4,
  eighth: 2,
  'dotted-half': 12,
  'dotted-quarter': 6,
};
const TYPE: Record<FixtureValue, string> = {
  whole: 'whole',
  half: 'half',
  quarter: 'quarter',
  eighth: 'eighth',
  'dotted-half': 'half',
  'dotted-quarter': 'quarter',
};
const DOTTED: ReadonlySet<FixtureValue> = new Set(['dotted-half', 'dotted-quarter']);

export interface FixturePitch {
  step: Letter;
  alter?: number;
  octave: number;
}

/** One right-hand event: a single melody note, or a rest, of `value`. */
export interface FixtureMelodyEvent extends Partial<FixturePitch> {
  value: FixtureValue;
  rest?: true;
  fingering?: number;
}

/** One left-hand event: a block chord (two or more simultaneous notes), or a rest, of `value`. */
export interface FixtureChordEvent {
  notes: FixturePitch[];
  value: FixtureValue;
  rest?: true;
}

export interface FixtureBar {
  /** Written only when present; the first bar of a fixture must set one. */
  key?: { fifths: number; mode: 'major' | 'minor' };
  /** A words direction above staff 1 at the bar's first beat (a roman numeral or a key name). */
  wordsAbove?: string;
  /** A words direction below staff 2 at the bar's first beat. */
  wordsBelow?: string;
  barline?: 'regular' | 'light-light' | 'light-heavy';
  right: FixtureMelodyEvent[];
  left: FixtureChordEvent[];
}

export interface FixtureOptions {
  title?: string;
  metre?: string;
}

const escapeXml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function pitchXml(p: FixturePitch): string {
  const alter = p.alter ? `<alter>${p.alter}</alter>` : '';
  return `<pitch><step>${p.step}</step>${alter}<octave>${p.octave}</octave></pitch>`;
}

function noteXml(
  pitch: FixturePitch | undefined,
  value: FixtureValue,
  staff: 1 | 2,
  voice: number,
  chordMark: boolean,
  fingering?: number,
): string {
  const duration = TICKS[value];
  const dot = DOTTED.has(value) ? '<dot/>' : '';
  const notations = fingering
    ? `<notations><technical><fingering>${fingering}</fingering></technical></notations>`
    : '';
  if (!pitch)
    return `<note><rest/><duration>${duration}</duration><voice>${voice}</voice><type>${TYPE[value]}</type>${dot}<staff>${staff}</staff></note>`;
  const chord = chordMark ? '<chord/>' : '';
  return `<note>${chord}${pitchXml(pitch)}<duration>${duration}</duration><voice>${voice}</voice><type>${TYPE[value]}</type>${dot}<staff>${staff}</staff>${notations}</note>`;
}

function wordsXml(text: string, placement: 'above' | 'below', staff: 1 | 2): string {
  return `<direction placement="${placement}"><direction-type><words>${escapeXml(text)}</words></direction-type><staff>${staff}</staff></direction>`;
}

/** Builds a two-staff MusicXML fixture: staff 1 (voice 1) a right-hand melody or rests, staff 2 (voice 5) left-hand
 *  block chords or rests, matching the shape `src/core/library/exercise/generate.ts` writes (DIVISIONS = 4). */
export function buildMelodyFixture(bars: readonly FixtureBar[], options: FixtureOptions = {}): string {
  const metre = options.metre ?? '4/4';
  const [beatsStr, beatTypeStr] = metre.split('/');
  const title = options.title ?? 'Melody rule check fixture';
  const measures = bars
    .map((bar, index) => {
      const barNumber = index + 1;
      let attributes = '';
      if (index === 0 || bar.key) {
        const key = bar.key;
        const keyXml = key ? `<key><fifths>${key.fifths}</fifths><mode>${key.mode}</mode></key>` : '';
        const staves = index === 0 ? '<staves>2</staves>' : '';
        const clefs =
          index === 0
            ? '<clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef>'
            : '';
        const divisions = index === 0 ? `<divisions>${DIVISIONS}</divisions>` : '';
        const time = index === 0 ? `<time><beats>${beatsStr}</beats><beat-type>${beatTypeStr}</beat-type></time>` : '';
        attributes = `<attributes>${divisions}${keyXml}${time}${staves}${clefs}</attributes>`;
      }
      const above = bar.wordsAbove ? wordsXml(bar.wordsAbove, 'above', 1) : '';
      const rightTicks = bar.right.reduce((sum, e) => sum + TICKS[e.value], 0);
      const rightNotes = bar.right
        .map((e) => noteXml(e.rest ? undefined : (e as FixturePitch), e.value, 1, 1, false, e.fingering))
        .join('');
      const backup = `<backup><duration>${rightTicks}</duration></backup>`;
      const below = bar.wordsBelow ? wordsXml(bar.wordsBelow, 'below', 2) : '';
      const leftNotes = bar.left
        .map((e) =>
          e.rest
            ? noteXml(undefined, e.value, 2, 5, false)
            : e.notes.map((n, i) => noteXml(n, e.value, 2, 5, i > 0)).join(''),
        )
        .join('');
      const barline = bar.barline ? `<barline location="right"><bar-style>${bar.barline}</bar-style></barline>` : '';
      return `<measure number="${barNumber}">${attributes}${above}${rightNotes}${backup}${below}${leftNotes}${barline}</measure>`;
    })
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<score-partwise version="4.0">' +
    `<work><work-title>${escapeXml(title)}</work-title></work>` +
    '<identification><creator type="composer">Musicanyya practice material</creator>' +
    '<encoding><software>Musicanyya</software></encoding></identification>' +
    '<part-list><score-part id="P1"><part-name>Piano</part-name>' +
    '<score-instrument id="P1-I1"><instrument-name>Acoustic Grand Piano</instrument-name></score-instrument>' +
    '<midi-instrument id="P1-I1"><midi-channel>1</midi-channel><midi-program>1</midi-program>' +
    '<volume>80</volume><pan>0</pan></midi-instrument></score-part></part-list>' +
    `<part id="P1">${measures}</part>` +
    '</score-partwise>'
  );
}
