export type Ticks = number;
export type NoteId = string;
export type MeasureId = string;

export interface Score {
  title: string | null;
  composer: string | null;
  ppq: number;
  parts: Part[];
  measures: MeasureInfo[];
  tempoMarks: TempoMark[];
  navigation: NavigationMarks;
  defaultTempoUsed: boolean;
}

export interface MeasureInfo {
  index: number;
  id: MeasureId;
  label: string;
  startTick: Ticks;
  lengthTicks: Ticks;
  nominalTicks: Ticks;
  implicit: boolean;
  beatOffsetTicks: Ticks;
  time: { beats: string; beatType: number } | null;
}

export interface Part {
  index: number;
  xmlId: string;
  name: string;
  staves: number;
  instruments: Instrument[];
  notes: Note[];
  dynamics: DynamicMark[];
  wedges: Wedge[];
  transpositions: Transposition[];
}

export interface Instrument {
  xmlId: string;
  name: string;
  program: number;
  bank: number | null;
  channelHint: number | null;
  percussion: boolean;
  unpitchedKey: number | null;
  volume: number | null;
  pan: number | null;
  fallback: boolean;
}

export interface Note {
  id: NoteId;
  part: number;
  staff: number;
  voice: string;
  measureIndex: number;
  onsetInMeasure: Ticks;
  onsetQuarters: { num: number; den: number };
  durationTicks: Ticks;
  writtenKey: number;
  soundingKey: number;
  unpitched: boolean;
  grace: null | { index: number; slash: boolean; stealPrevious: number | null; stealFollowing: number | null; makeTime: number | null };
  tie: { start: boolean; stop: boolean };
  chord: boolean;
  instrument: string | null;
  velocityOverride: number | null;
  accent: boolean;
  fingerings: Fingering[];
  printed: boolean;
  source: { start: number; end: number };
}

export interface Fingering {
  text: string;
  finger: 1 | 2 | 3 | 4 | 5 | null;
  substitution: boolean;
  alternate: boolean;
  placement: "above" | "below" | null;
}

export interface TempoMark {
  measureIndex: number;
  onsetInMeasure: Ticks;
  qpmNum: number;
  qpmDen: number;
}

export interface NavigationMarks {
  repeats: RepeatMark[];
  endings: EndingMark[];
  targets: JumpTarget[];
  jumps: Jump[];
}

export interface RepeatMark { measureIndex: number; direction: 'forward' | 'backward'; times?: number }
export interface EndingMark { measureIndex: number; type: 'start' | 'stop' | 'discontinue'; numbers: number[] }
export interface JumpTarget { measureIndex: number; type: 'segno' | 'coda' | 'fine' }
export interface Jump { measureIndex: number; type: 'da-capo' | 'dal-segno' | 'to-coda'; al?: 'fine' | 'coda' }
export interface DynamicMark { measureIndex: number; onsetInMeasure: Ticks; type: string }
export interface Wedge { measureIndex: number; onsetInMeasure: Ticks; type: 'crescendo' | 'diminuendo' | 'stop' }
export interface Transposition { measureIndex: number; onsetInMeasure: Ticks; chromatic: number; diatonic?: number; octaveChange?: number }
