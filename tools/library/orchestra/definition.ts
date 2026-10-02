// The orchestration definition (feature 019, contracts/orchestration-definition.md section 1, data-model 6.2): which instruments
// double which of the piano's notes in which bars. Content, not code: `content/library/orchestra/<item-slug>.json`, reviewed by
// the `music-domain-expert` role. Dev-time only.

export interface OrchestraInstrument {
  id: string;
  name: string;
  /** General MIDI program, 1-based as in `<midi-program>`. */
  program: number;
  /** `<sound dynamics>` for its passages, in percent of forte. */
  dynamics: number;
  /** Every generated note must lie inside it (MIDI keys). */
  range: { low: number; high: number };
}

export interface Passage {
  instrument: string;
  /** 1-based printed bar numbers, inclusive. */
  bars: { from: number; to: number };
  doubles: { staff: 1 | 2; pick: 'top' | 'bottom' | 'all' };
  /** Only notes at least this many quarter notes long. */
  minQuarters?: number;
  /** One doubled note per entry: a whole-octave shift in -2..2. */
  octaves: number[];
  /** True: a shifted note outside the range moves by whole octaves into it; false: such a note is an error. */
  fitRange: boolean;
  /** Overrides the instrument's `dynamics` for this passage. */
  dynamics?: number;
}

export interface OrchestrationDefinition {
  version: 1;
  itemId: string;
  reviewedBy: string;
  reviewedOn: string;
  instruments: OrchestraInstrument[];
  passages: Passage[];
}

export class DefinitionError extends Error {
  constructor(detail: string) {
    super(`orchestration definition: ${detail}`);
    this.name = 'DefinitionError';
  }
}

type Obj = Record<string, unknown>;

function object(value: unknown, what: string): Obj {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new DefinitionError(`${what} must be an object`);
  return value as Obj;
}
function text(value: unknown, what: string): string {
  if (typeof value !== 'string' || value === '') throw new DefinitionError(`${what} must be a non-empty string`);
  return value;
}
function integer(value: unknown, what: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max)
    throw new DefinitionError(`${what} must be a whole number from ${min} to ${max}`);
  return value;
}

/** Reads and checks a definition from parsed JSON. Everything a file can get wrong that does not need the piece itself. */
export function parseDefinition(json: unknown): OrchestrationDefinition {
  const root = object(json, 'the file');
  if (root.version !== 1) throw new DefinitionError('version must be 1');
  const itemId = text(root.itemId, 'itemId');
  const reviewedBy = text(root.reviewedBy, 'reviewedBy');
  const reviewedOn = text(root.reviewedOn, 'reviewedOn');
  if (!Array.isArray(root.instruments) || root.instruments.length < 1 || root.instruments.length > 8)
    throw new DefinitionError('instruments must list 1 to 8 instruments');
  const instruments = root.instruments.map((raw, i): OrchestraInstrument => {
    const at = `instruments[${i}]`;
    const o = object(raw, at);
    const range = object(o.range, `${at}.range`);
    const low = integer(range.low, `${at}.range.low`, 0, 127);
    const high = integer(range.high, `${at}.range.high`, 0, 127);
    if (low > high) throw new DefinitionError(`${at}.range: low ${low} is above high ${high}`);
    return {
      id: text(o.id, `${at}.id`),
      name: text(o.name, `${at}.name`),
      program: integer(o.program, `${at}.program`, 1, 128),
      dynamics: integer(o.dynamics, `${at}.dynamics`, 1, 141),
      range: { low, high },
    };
  });
  const ids = new Set<string>();
  for (const instrument of instruments) {
    if (ids.has(instrument.id)) throw new DefinitionError(`instrument id "${instrument.id}" is used twice`);
    ids.add(instrument.id);
  }
  if (!Array.isArray(root.passages)) throw new DefinitionError('passages must be a list');
  const passages = root.passages.map((raw, i): Passage => {
    const at = `passages[${i}]`;
    const o = object(raw, at);
    const instrument = text(o.instrument, `${at}.instrument`);
    if (!ids.has(instrument)) throw new DefinitionError(`${at}: unknown instrument "${instrument}"`);
    const bars = object(o.bars, `${at}.bars`);
    const from = integer(bars.from, `${at}.bars.from`, 1, 100000);
    const to = integer(bars.to, `${at}.bars.to`, 1, 100000);
    if (to < from) throw new DefinitionError(`${at}.bars: to ${to} is before from ${from}`);
    const doubles = object(o.doubles, `${at}.doubles`);
    if (doubles.staff !== 1 && doubles.staff !== 2) throw new DefinitionError(`${at}.doubles.staff must be 1 or 2`);
    if (doubles.pick !== 'top' && doubles.pick !== 'bottom' && doubles.pick !== 'all')
      throw new DefinitionError(`${at}.doubles.pick must be "top", "bottom" or "all"`);
    if (!Array.isArray(o.octaves) || o.octaves.length < 1 || o.octaves.length > 3)
      throw new DefinitionError(`${at}.octaves must list 1 to 3 shifts`);
    const octaves = o.octaves.map((shift) => integer(shift, `${at}.octaves`, -2, 2));
    if (typeof o.fitRange !== 'boolean') throw new DefinitionError(`${at}.fitRange must be true or false`);
    const passage: Passage = {
      instrument,
      bars: { from, to },
      doubles: { staff: doubles.staff, pick: doubles.pick },
      octaves,
      fitRange: o.fitRange,
    };
    if (o.minQuarters !== undefined) {
      if (typeof o.minQuarters !== 'number' || !Number.isFinite(o.minQuarters) || o.minQuarters < 0)
        throw new DefinitionError(`${at}.minQuarters must be a number of quarter notes, 0 or more`);
      passage.minQuarters = o.minQuarters;
    }
    if (o.dynamics !== undefined) passage.dynamics = integer(o.dynamics, `${at}.dynamics`, 1, 141);
    return passage;
  });
  for (let i = 0; i < passages.length; i++) {
    for (let j = i + 1; j < passages.length; j++) {
      const a = passages[i] as Passage;
      const b = passages[j] as Passage;
      if (a.instrument === b.instrument && a.bars.from <= b.bars.to && b.bars.from <= a.bars.to)
        throw new DefinitionError(
          `passages ${i} and ${j} of "${a.instrument}" overlap (bars ${a.bars.from}-${a.bars.to} and ${b.bars.from}-${b.bars.to})`,
        );
    }
  }
  return { version: 1, itemId, reviewedBy, reviewedOn, instruments, passages };
}
