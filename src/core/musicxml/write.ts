/** The minimal MusicXML writer (contracts/exercise-definition.md §2): score-partwise, parts,
 *  attributes, notes and chords, `<backup>`, directions with `<words>`, fingering. Used only by
 *  `tools/library/build-exercises.ts` and `src/core/library/exercise/` to turn a generated exercise
 *  into a file this app's own `readXml` + `buildScore` can load - never `<harmony>` (data-model.md §4
 *  correction A: it is not in `build.ts`'s `supportedElements` and would raise a notice on every
 *  item). Dev-only generation code, guarded out of the shipped bundle by
 *  `tests/architecture/layers.test.ts` (tasks.md T086). */

export type WriteDuration = 'whole' | 'half' | 'quarter' | 'eighth' | '16th';

export interface WritePitch {
  step: string;
  /** Semitone alteration; 2 = double sharp, -2 = double flat. */
  alter?: number;
  octave: number;
}

export interface WriteNote {
  rest?: boolean;
  pitch?: WritePitch;
  /** In the measure's `<divisions>` units. */
  duration: number;
  voice: string;
  type: WriteDuration;
  dot?: boolean;
  staff?: number;
  /** This note sounds with the previous one (`<chord/>`), rather than advancing the cursor. */
  chord?: boolean;
  /** 1-5; omitted when the note carries no fingering. */
  fingering?: number;
  tie?: { start?: boolean; stop?: boolean };
}

export interface WriteDirection {
  words?: string;
  metronome?: { beatUnit: WriteDuration; perMinute: number };
  /** `<sound tempo="...">`, in quarter notes per minute regardless of `metronome.beatUnit`. */
  tempo?: number;
  staff?: number;
  placement?: 'above' | 'below';
}

export interface WriteBarline {
  location?: 'left' | 'right';
  barStyle?: string;
  repeat?: { direction: 'forward' | 'backward'; times?: number };
}

export type WriteEvent =
  | { kind: 'note'; note: WriteNote }
  | { kind: 'backup'; duration: number }
  | { kind: 'forward'; duration: number }
  | ({ kind: 'direction' } & WriteDirection)
  | ({ kind: 'barline' } & WriteBarline);

export interface WriteClef {
  number: number;
  sign: string;
  line: number;
}

export interface WriteMeasureAttributes {
  divisions?: number;
  key?: { fifths: number };
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
  parts: WritePart[];
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function writeNoteXml(note: WriteNote): string {
  const parts: string[] = ['<note>'];
  if (note.chord) parts.push('<chord/>');
  if (note.rest) {
    parts.push('<rest/>');
  } else if (note.pitch) {
    const { step, alter, octave } = note.pitch;
    parts.push('<pitch>', `<step>${esc(step)}</step>`);
    if (alter) parts.push(`<alter>${alter}</alter>`);
    parts.push(`<octave>${octave}</octave>`, '</pitch>');
  }
  parts.push(`<duration>${note.duration}</duration>`);
  if (note.tie?.start) parts.push('<tie type="start"/>');
  if (note.tie?.stop) parts.push('<tie type="stop"/>');
  parts.push(`<voice>${esc(note.voice)}</voice>`, `<type>${note.type}</type>`);
  if (note.dot) parts.push('<dot/>');
  if (note.staff !== undefined) parts.push(`<staff>${note.staff}</staff>`);
  const notations: string[] = [];
  if (note.tie?.start) notations.push('<tied type="start"/>');
  if (note.tie?.stop) notations.push('<tied type="stop"/>');
  if (note.fingering !== undefined) {
    notations.push(`<technical><fingering>${note.fingering}</fingering></technical>`);
  }
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
  if (d.words !== undefined) typeParts.push(`<words>${esc(d.words)}</words>`);
  const sound = d.tempo !== undefined ? `<sound tempo="${d.tempo}"/>` : '';
  const staff = d.staff !== undefined ? `<staff>${d.staff}</staff>` : '';
  return `<direction${attrs}><direction-type>${typeParts.join('')}</direction-type>${sound}${staff}</direction>`;
}

function writeBarlineXml(b: WriteBarline): string {
  const attrs = b.location ? ` location="${b.location}"` : '';
  const style = b.barStyle ? `<bar-style>${b.barStyle}</bar-style>` : '';
  const repeat = b.repeat
    ? `<repeat direction="${b.repeat.direction}"${b.repeat.times !== undefined ? ` times="${b.repeat.times}"` : ''}/>`
    : '';
  return `<barline${attrs}>${style}${repeat}</barline>`;
}

function writeAttributesXml(a: WriteMeasureAttributes): string {
  const parts: string[] = ['<attributes>'];
  if (a.divisions !== undefined) parts.push(`<divisions>${a.divisions}</divisions>`);
  if (a.key) parts.push(`<key><fifths>${a.key.fifths}</fifths></key>`);
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
  parts.push('<encoding><software>Musicanyya</software></encoding>', '</identification>');
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
