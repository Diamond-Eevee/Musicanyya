/** The minimal MusicXML writer (contracts/exercise-definition.md §2): score-partwise, parts,
 *  attributes, notes and chords, `<backup>`, directions with `<words>`, fingering. Used only by
 *  `tools/library/build-exercises.ts` and `src/core/library/exercise/` to turn a generated exercise
 *  into a file this app's own `readXml` + `buildScore` can load - never `<harmony>` (data-model.md §4
 *  correction A: it is not in `build.ts`'s `supportedElements` and would raise a notice on every
 *  item). Dev-only generation code, guarded out of the shipped bundle by
 *  `tests/architecture/layers.test.ts` (tasks.md T086).
 *
 *  Feature 007 (research R13) added optional fields for pieces converted from LilyPond by the
 *  library tools' converter: endings, grace notes, tuplets, octave shifts, mid-bar attributes, slurs,
 *  articulations, ornaments, arpeggios, dynamics, hairpins, pedal marks, rights and source. An exercise
 *  never sets them, so its output stays byte-identical (the exercise goldens are the guard). */

export type WriteDuration = 'breve' | 'whole' | 'half' | 'quarter' | 'eighth' | '16th' | '32nd' | '64th';

export interface WritePitch {
  step: string;
  /** Semitone alteration; 2 = double sharp, -2 = double flat. */
  alter?: number;
  octave: number;
}

export type WriteArticulation = 'staccato' | 'accent' | 'tenuto';
export type WriteOrnament = 'trill-mark' | 'mordent' | 'inverted-mordent' | 'turn';

export interface WriteNote {
  rest?: boolean;
  /** A whole-bar rest (`<rest measure="yes"/>`). */
  measureRest?: boolean;
  pitch?: WritePitch;
  /** In the measure's `<divisions>` units. Not written for a grace note, which takes no time. */
  duration: number;
  voice: string;
  type: WriteDuration;
  dot?: boolean;
  /** Number of dots; overrides `dot` when set. */
  dots?: number;
  staff?: number;
  /** This note sounds with the previous one (`<chord/>`), rather than advancing the cursor. */
  chord?: boolean;
  /** 1-5; omitted when the note carries no fingering. */
  fingering?: number;
  tie?: { start?: boolean; stop?: boolean };
  grace?: { slash?: boolean };
  /** `actual` notes in the time of `normal` ones (3:2 for a triplet). */
  timeModification?: { actual: number; normal: number };
  tuplet?: { type: 'start' | 'stop'; bracket?: boolean; showNumber?: 'actual' | 'none' };
  slurs?: { type: 'start' | 'stop'; number: number }[];
  articulations?: WriteArticulation[];
  ornament?: WriteOrnament;
  fermata?: boolean;
  /** A written arpeggio (rolled chord); set on every member of the chord. */
  arpeggiate?: boolean;
}

export interface WriteDirection {
  words?: string;
  /** The words are printed bold (a tempo word). */
  bold?: boolean;
  /** The words are printed in italics (an expression such as "dolce"). */
  italic?: boolean;
  metronome?: { beatUnit: WriteDuration; perMinute: number };
  /** `<sound tempo="...">`, in quarter notes per minute regardless of `metronome.beatUnit`. */
  tempo?: number;
  /** A dynamic mark such as `pp` or `sf`. */
  dynamics?: string;
  wedge?: 'crescendo' | 'diminuendo' | 'stop';
  /** Written pedal marking; `line="no"` prints "Ped." and the release sign. */
  pedal?: 'start' | 'stop' | 'change';
  /** 8va is `down` (the notes are printed an octave lower than their `<pitch>`), 8vb is `up`. */
  octaveShift?: { type: 'up' | 'down' | 'stop'; size: number };
  staff?: number;
  placement?: 'above' | 'below';
}

export interface WriteBarline {
  location?: 'left' | 'right';
  barStyle?: string;
  repeat?: { direction: 'forward' | 'backward'; times?: number };
  /** A volta bracket; `text` is what is printed ("1."). */
  ending?: { number: string; type: 'start' | 'stop' | 'discontinue'; text?: string };
}

export type WriteEvent =
  | { kind: 'note'; note: WriteNote }
  | { kind: 'backup'; duration: number }
  | { kind: 'forward'; duration: number }
  | ({ kind: 'direction' } & WriteDirection)
  | ({ kind: 'barline' } & WriteBarline)
  /** A clef, key or time change after the start of the measure. */
  | ({ kind: 'attributes' } & WriteMeasureAttributes);

export interface WriteClef {
  number: number;
  sign: string;
  line: number;
}

export interface WriteMeasureAttributes {
  divisions?: number;
  key?: { fifths: number; mode?: string };
  time?: { beats: string; beatType: number };
  staves?: number;
  clefs?: WriteClef[];
}

export interface WriteMeasure {
  number: string;
  implicit?: boolean;
  attributes?: WriteMeasureAttributes;
  events: WriteEvent[];
}

export interface WritePart {
  id: string;
  name: string;
  measures: WriteMeasure[];
}

export interface WriteScore {
  title?: string;
  composer?: string;
  /** `<rights>`: the licence and credit line of a converted piece. */
  rights?: string;
  /** `<source>`: where a converted piece came from. */
  source?: string;
  parts: WritePart[];
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function writeNoteXml(note: WriteNote): string {
  const parts: string[] = ['<note>'];
  // MusicXML's order: grace, chord, pitch/rest, duration, tie, voice, type, dot, time-modification, staff, notations.
  if (note.grace) parts.push(note.grace.slash ? '<grace slash="yes"/>' : '<grace/>');
  if (note.chord) parts.push('<chord/>');
  if (note.rest) {
    parts.push(note.measureRest ? '<rest measure="yes"/>' : '<rest/>');
  } else if (note.pitch) {
    const { step, alter, octave } = note.pitch;
    parts.push('<pitch>', `<step>${esc(step)}</step>`);
    if (alter) parts.push(`<alter>${alter}</alter>`);
    parts.push(`<octave>${octave}</octave>`, '</pitch>');
  }
  if (!note.grace) parts.push(`<duration>${note.duration}</duration>`);
  if (note.tie?.start) parts.push('<tie type="start"/>');
  if (note.tie?.stop) parts.push('<tie type="stop"/>');
  parts.push(`<voice>${esc(note.voice)}</voice>`, `<type>${note.type}</type>`);
  const dots = note.dots ?? (note.dot ? 1 : 0);
  for (let i = 0; i < dots; i++) parts.push('<dot/>');
  if (note.timeModification) {
    const { actual, normal } = note.timeModification;
    parts.push(
      `<time-modification><actual-notes>${actual}</actual-notes><normal-notes>${normal}</normal-notes></time-modification>`,
    );
  }
  if (note.staff !== undefined) parts.push(`<staff>${note.staff}</staff>`);
  const notations: string[] = [];
  if (note.tie?.start) notations.push('<tied type="start"/>');
  if (note.tie?.stop) notations.push('<tied type="stop"/>');
  for (const slur of note.slurs ?? []) notations.push(`<slur type="${slur.type}" number="${slur.number}"/>`);
  if (note.tuplet) {
    const { type, bracket, showNumber } = note.tuplet;
    const attrs = [`type="${type}"`];
    if (bracket !== undefined) attrs.push(`bracket="${bracket ? 'yes' : 'no'}"`);
    if (showNumber !== undefined) attrs.push(`show-number="${showNumber}"`);
    notations.push(`<tuplet ${attrs.join(' ')}/>`);
  }
  if (note.articulations?.length) {
    notations.push(`<articulations>${note.articulations.map((a) => `<${a}/>`).join('')}</articulations>`);
  }
  if (note.fingering !== undefined) {
    notations.push(`<technical><fingering>${note.fingering}</fingering></technical>`);
  }
  if (note.ornament) notations.push(`<ornaments><${note.ornament}/></ornaments>`);
  if (note.fermata) notations.push('<fermata/>');
  if (note.arpeggiate) notations.push('<arpeggiate/>');
  if (notations.length > 0) parts.push(`<notations>${notations.join('')}</notations>`);
  parts.push('</note>');
  return parts.join('');
}

function writeDirectionXml(d: WriteDirection): string {
  const attrs = d.placement ? ` placement="${d.placement}"` : '';
  const typeParts: string[] = [];
  if (d.metronome) {
    typeParts.push(
      `<metronome><beat-unit>${d.metronome.beatUnit}</beat-unit><per-minute>${d.metronome.perMinute}</per-minute></metronome>`,
    );
  }
  if (d.words !== undefined) {
    const style = `${d.bold ? ' font-weight="bold"' : ''}${d.italic ? ' font-style="italic"' : ''}`;
    typeParts.push(`<words${style}>${esc(d.words)}</words>`);
  }
  if (d.dynamics !== undefined) typeParts.push(`<dynamics><${esc(d.dynamics)}/></dynamics>`);
  if (d.wedge !== undefined) typeParts.push(`<wedge type="${d.wedge}"/>`);
  if (d.pedal !== undefined) typeParts.push(`<pedal type="${d.pedal}" line="no"/>`);
  if (d.octaveShift) typeParts.push(`<octave-shift type="${d.octaveShift.type}" size="${d.octaveShift.size}"/>`);
  const sound = d.tempo !== undefined ? `<sound tempo="${d.tempo}"/>` : '';
  const staff = d.staff !== undefined ? `<staff>${d.staff}</staff>` : '';
  return `<direction${attrs}><direction-type>${typeParts.join('')}</direction-type>${sound}${staff}</direction>`;
}

function writeBarlineXml(b: WriteBarline): string {
  const attrs = b.location ? ` location="${b.location}"` : '';
  const style = b.barStyle ? `<bar-style>${b.barStyle}</bar-style>` : '';
  let ending = '';
  if (b.ending) {
    const { number, type, text } = b.ending;
    const open = `<ending number="${esc(number)}" type="${type}"`;
    ending = text !== undefined ? `${open}>${esc(text)}</ending>` : `${open}/>`;
  }
  const repeat = b.repeat
    ? `<repeat direction="${b.repeat.direction}"${b.repeat.times !== undefined ? ` times="${b.repeat.times}"` : ''}/>`
    : '';
  return `<barline${attrs}>${style}${ending}${repeat}</barline>`;
}

function writeAttributesXml(a: WriteMeasureAttributes): string {
  const parts: string[] = ['<attributes>'];
  if (a.divisions !== undefined) parts.push(`<divisions>${a.divisions}</divisions>`);
  if (a.key) {
    const mode = a.key.mode !== undefined ? `<mode>${esc(a.key.mode)}</mode>` : '';
    parts.push(`<key><fifths>${a.key.fifths}</fifths>${mode}</key>`);
  }
  if (a.time) parts.push(`<time><beats>${a.time.beats}</beats><beat-type>${a.time.beatType}</beat-type></time>`);
  if (a.staves !== undefined) parts.push(`<staves>${a.staves}</staves>`);
  for (const clef of a.clefs ?? []) {
    parts.push(`<clef number="${clef.number}"><sign>${clef.sign}</sign><line>${clef.line}</line></clef>`);
  }
  parts.push('</attributes>');
  return parts.join('');
}

function writeMeasureXml(m: WriteMeasure): string {
  const attrs = [`number="${esc(m.number)}"`];
  if (m.implicit) attrs.push('implicit="yes"');
  const parts: string[] = [`<measure ${attrs.join(' ')}>`];
  if (m.attributes) parts.push(writeAttributesXml(m.attributes));
  for (const event of m.events) {
    if (event.kind === 'note') parts.push(writeNoteXml(event.note));
    else if (event.kind === 'backup') parts.push(`<backup><duration>${event.duration}</duration></backup>`);
    else if (event.kind === 'forward') parts.push(`<forward><duration>${event.duration}</duration></forward>`);
    else if (event.kind === 'direction') parts.push(writeDirectionXml(event));
    else if (event.kind === 'barline') parts.push(writeBarlineXml(event));
    else if (event.kind === 'attributes') parts.push(writeAttributesXml(event));
  }
  parts.push('</measure>');
  return parts.join('');
}

function writePartXml(p: WritePart): string {
  const measures = p.measures.map(writeMeasureXml).join('');
  return `<part id="${esc(p.id)}">${measures}</part>`;
}

/** Writes a complete `score-partwise` MusicXML document. Deterministic: the same `WriteScore` always
 *  produces byte-identical output (contracts/exercise-definition.md §2.5 - what makes the golden
 *  snapshots mean something). No comment is ever placed between the XML declaration and the root
 *  element (tasks.md T031's real bug: Verovio's format-sniffer cannot parse past one). */
export function writeScoreXml(score: WriteScore): string {
  const parts: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', '<score-partwise version="4.0">'];
  if (score.title) parts.push(`<work><work-title>${esc(score.title)}</work-title></work>`);
  parts.push('<identification>');
  if (score.composer) parts.push(`<creator type="composer">${esc(score.composer)}</creator>`);
  if (score.rights) parts.push(`<rights>${esc(score.rights)}</rights>`);
  parts.push('<encoding><software>Musicanyya</software></encoding>');
  if (score.source) parts.push(`<source>${esc(score.source)}</source>`);
  parts.push('</identification>');
  parts.push('<part-list>');
  for (const p of score.parts) {
    parts.push(
      `<score-part id="${esc(p.id)}"><part-name>${esc(p.name)}</part-name>` +
        `<score-instrument id="${esc(p.id)}-I1"><instrument-name>Acoustic Grand Piano</instrument-name></score-instrument>` +
        `<midi-instrument id="${esc(p.id)}-I1"><midi-channel>1</midi-channel><midi-program>1</midi-program><volume>80</volume><pan>0</pan></midi-instrument>` +
        '</score-part>',
    );
  }
  parts.push('</part-list>');
  for (const p of score.parts) parts.push(writePartXml(p));
  parts.push('</score-partwise>');
  return parts.join('\n');
}
