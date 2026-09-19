export interface NoteIdParams {
  part: number;
  staff: number;
  measure: number;
  voice: string;
  onset: { num: number; den: number };
  pitch: number | string;
  isGrace?: boolean;
  graceIndex?: number;
  duplicateIndex?: number;
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

export function buildNoteId(p: NoteIdParams): string {
  const g = gcd(p.onset.num, p.onset.den);
  const num = p.onset.num / g;
  const den = p.onset.den / g;
  const onsetStr = den === 1 ? `${num}` : `${num}_${den}`;

  const safeVoice = p.voice ? p.voice.replace(/[^A-Za-z0-9]/g, '') : '1';

  let id = `n-p${p.part}-s${p.staff}-m${p.measure}-v${safeVoice}-o${onsetStr}-k${p.pitch}`;
  if (p.isGrace) id += `-g${p.graceIndex || 1}`;
  if (p.duplicateIndex !== undefined) id += `-d${p.duplicateIndex}`;

  return id;
}

export function parseNoteId(id: string): NoteIdParams {
  const parts = id.split('-');
  const part = parseInt(parts[1].substring(1), 10);
  const staff = parseInt(parts[2].substring(1), 10);
  const measure = parseInt(parts[3].substring(1), 10);
  const voice = parts[4].substring(1);

  const onsetParts = parts[5].substring(1).split('_');
  const num = parseInt(onsetParts[0], 10);
  const den = onsetParts.length > 1 ? parseInt(onsetParts[1], 10) : 1;

  const pitchStr = parts[6].substring(1);
  const pitch = pitchStr.startsWith('u') ? pitchStr : parseInt(pitchStr, 10);

  const params: NoteIdParams = { part, staff, measure, voice, onset: { num, den }, pitch };

  if (parts.length > 7) {
    for (let i = 7; i < parts.length; i++) {
      if (parts[i].startsWith('g')) {
        params.isGrace = true;
        params.graceIndex = parseInt(parts[i].substring(1), 10);
      } else if (parts[i].startsWith('d')) {
        params.duplicateIndex = parseInt(parts[i].substring(1), 10);
      }
    }
  }

  return params;
}

export interface MeasureIdParams {
  index: number;
}

export function buildMeasureId(p: MeasureIdParams): string {
  return `ms-${p.index}`;
}

export function parseMeasureId(id: string): MeasureIdParams {
  const parts = id.split('-');
  return { index: parseInt(parts[1], 10) };
}
