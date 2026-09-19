export interface NoteIdParams {
  part: string;
  measure: string;
  voice: string;
  onset: { num: number; den: number };
  pitch: string;
  isGrace?: boolean;
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

  const safeVoice = p.voice.replace(/[^A-Za-z0-9]/g, '');

  let id = `n-${p.part}-M${p.measure}-V${safeVoice}-O${onsetStr}-${p.pitch}`;
  if (p.isGrace) id += '-g';
  if (p.duplicateIndex !== undefined) id += `-d${p.duplicateIndex}`;

  return id;
}

export function parseNoteId(id: string): NoteIdParams {
  const parts = id.split('-');
  const part = parts[1];
  const measure = parts[2].substring(1);
  const voice = parts[3].substring(1);

  const onsetParts = parts[4].substring(1).split('_');
  const num = parseInt(onsetParts[0], 10);
  const den = onsetParts.length > 1 ? parseInt(onsetParts[1], 10) : 1;

  const pitch = parts[5];

  const params: NoteIdParams = { part, measure, voice, onset: { num, den }, pitch };

  if (parts.length > 6) {
    for (let i = 6; i < parts.length; i++) {
      if (parts[i] === 'g') {
        params.isGrace = true;
      } else if (parts[i].startsWith('d')) {
        params.duplicateIndex = parseInt(parts[i].substring(1), 10);
      }
    }
  }

  return params;
}

export interface MeasureIdParams {
  part: string;
  measure: string;
}

export function buildMeasureId(p: MeasureIdParams): string {
  return `m-${p.part}-M${p.measure}`;
}

export function parseMeasureId(id: string): MeasureIdParams {
  const parts = id.split('-');
  return { part: parts[1], measure: parts[2].substring(1) };
}
