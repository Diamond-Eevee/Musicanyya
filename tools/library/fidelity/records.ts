// Audit records (contract audit-record.md): content/library/audit/<item-id>.json. Loading validates each record by
// hand against the contract's schema; runRecord re-runs its checks from the committed files; checkRecord applies the
// rules of §2 (re-run, outcome, claims, reviewer, sources).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fromLilyPond, readLilyPond } from '../lilypond/read';
import { type Alignment, type Aspect, compare, compareMelody, compareSound, type Difference } from './compare';
import { ClaimError, claimForItem } from './exercise-claims';
import { fromMusicXml } from './from-musicxml';
import { fromMidi, readMidi } from './midi';
import type { ReferenceScore } from './reference';
import { date, type SourceManifest, sourceFile } from './sources';
import { checkExercise } from './theory';

export type Claim = 'original' | 'excerpt' | 'arrangement' | 'exercise';
export type Outcome = 'verified' | 'fixed' | 'replaced' | 'relabelled' | 'removed';

export interface MechanicalCheck {
  method: 'mechanical';
  source: string;
  sourceFiles: ('notation' | 'sound')[];
  aspects: Aspect[];
  alignment: Alignment;
  expectedDifferences: number;
  differenceNotes?: string[];
  /** Melody checks only: "allowedByDeparture" when the item's departures name a rhythmic change (research R7). */
  melodyRhythm?: 'compared' | 'allowedByDeparture';
}
export interface TheoryCheck {
  method: 'theory';
  ruleSet: 'exercise-theory-v1';
  expectedDifferences: 0;
}
export interface VisualCheck {
  method: 'visual';
  source: string;
  bars: string;
  result: string;
  differences: string[];
}
export type Check = MechanicalCheck | TheoryCheck | VisualCheck;

export interface AuditRecord {
  version: 1;
  itemId: string;
  claim: Claim;
  claimText: string;
  checks: Check[];
  outcome: Outcome;
  outcomeNote: string;
  checkedBy: string;
  date: string;
  previous?: { title: string; level: 'beginner' | 'intermediate' | 'advanced'; bars: number; notes: number };
}

export interface RunContext {
  sources: Map<string, SourceManifest>;
  /** content/library/sources */
  sourcesRoot: string;
  /** public/library: <item-id>.musicxml, <item-id>.json and README.md */
  libraryRoot: string;
  /** Run the item's checks against this MusicXML file instead of the shelf file (planted-error checks). */
  itemFile?: string;
}

export interface CheckResult {
  check: Check;
  differences: Difference[];
  /** Melody checks: rhythm differences the record allows (listed in the report, not counted). */
  allowed: Difference[];
  reproduced: boolean;
  /** What was compared, e.g. "item vs notation: 0 differences; notation vs sound: 0 differences". */
  detail: string;
}

const ASPECTS: Aspect[] = [
  'barCount',
  'barLengths',
  'repeats',
  'playedOrder',
  'pitch',
  'onset',
  'duration',
  'spelling',
  'graceNotes',
  'melody',
];
const ORIGINAL_ASPECTS: Aspect[] = ['barCount', 'repeats', 'pitch', 'onset', 'duration'];
/** A melody check compares one line; only its spelling may be added (the other aspects need a check of their own). */
const MELODY_ASPECTS: Aspect[] = ['melody', 'spelling'];

// ---- schema --------------------------------------------------------------------------------------------------------

export function validateRecord(json: unknown, where: string): AuditRecord {
  const fail = (detail: string): never => {
    throw new Error(`${where}: ${detail}`);
  };
  const r = object(json, 'record', fail);
  only(
    r,
    ['version', 'itemId', 'claim', 'claimText', 'checks', 'outcome', 'outcomeNote', 'checkedBy', 'date', 'previous'],
    'record',
    fail,
  );
  if (r.version !== 1) fail('version must be 1');
  const itemId = string(r.itemId, 'itemId', fail);
  if (!/^[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(itemId)) fail(`itemId "${itemId}" is not a library item id`);
  oneOf(r.claim, ['original', 'excerpt', 'arrangement', 'exercise'], 'claim', fail);
  string(r.claimText, 'claimText', fail, 400);
  if (!Array.isArray(r.checks) || r.checks.length === 0) fail('a record needs at least one check');
  for (const [i, c] of (r.checks as unknown[]).entries()) validateCheck(c, `checks[${i}]`, fail);
  oneOf(r.outcome, ['verified', 'fixed', 'replaced', 'relabelled', 'removed'], 'outcome', fail);
  string(r.outcomeNote, 'outcomeNote', fail, 600);
  string(r.checkedBy, 'checkedBy', fail);
  date(r.date, 'date', fail);
  if (r.previous !== undefined) {
    const p = object(r.previous, 'previous', fail);
    only(p, ['title', 'level', 'bars', 'notes'], 'previous', fail);
    string(p.title, 'previous.title', fail);
    oneOf(p.level, ['beginner', 'intermediate', 'advanced'], 'previous.level', fail);
    for (const k of ['bars', 'notes']) if (!Number.isInteger(p[k])) fail(`previous.${k} must be an integer`);
  }
  return r as unknown as AuditRecord;
}

function validateCheck(json: unknown, at: string, fail: (d: string) => never): void {
  const c = object(json, at, fail);
  if (c.method === 'mechanical') {
    only(
      c,
      [
        'method',
        'source',
        'sourceFiles',
        'aspects',
        'alignment',
        'expectedDifferences',
        'differenceNotes',
        'melodyRhythm',
      ],
      at,
      fail,
    );
    string(c.source, `${at}.source`, fail);
    if (!Array.isArray(c.sourceFiles) || c.sourceFiles.length === 0)
      fail(`${at}.sourceFiles must list notation and/or sound`);
    for (const f of c.sourceFiles as unknown[]) oneOf(f, ['notation', 'sound'], `${at}.sourceFiles`, fail);
    if (!Array.isArray(c.aspects) || c.aspects.length === 0) fail(`${at}.aspects must list at least one aspect`);
    for (const a of c.aspects as unknown[]) oneOf(a, ASPECTS, `${at} aspect`, fail);
    const melody = (c.aspects as Aspect[]).includes('melody');
    if (melody && !(c.aspects as Aspect[]).every((a) => MELODY_ASPECTS.includes(a)))
      fail(`${at}: a melody check may add only spelling; put the other aspects in a check of their own`);
    if (c.melodyRhythm !== undefined) {
      if (!melody) fail(`${at}.melodyRhythm needs the melody aspect`);
      oneOf(c.melodyRhythm, ['compared', 'allowedByDeparture'], `${at}.melodyRhythm`, fail);
    }
    const al = object(c.alignment, `${at}.alignment`, fail);
    only(
      al,
      ['itemBars', 'sourceBars', 'staff', 'voice', 'sourceStaff', 'sourceVoice', 'transpose'],
      `${at}.alignment`,
      fail,
    );
    for (const k of ['itemBars', 'sourceBars'])
      if (typeof al[k] !== 'string' || !/^\d+-\d+$|^all$/.test(al[k] as string))
        fail(`${at}.alignment.${k} must be "all" or "N-M"`);
    for (const k of ['staff', 'sourceStaff'])
      if (al[k] !== undefined && !(Number.isInteger(al[k]) && (al[k] as number) >= 1))
        fail(`${at}.alignment.${k} must be a staff number`);
    for (const k of ['voice', 'sourceVoice']) if (al[k] !== undefined) string(al[k], `${at}.alignment.${k}`, fail);
    if (al.transpose !== undefined && !/^[+-](P1|m2|M2|m3|M3|P4|A4|d5|P5|m6|M6|m7|M7|P8)$/.test(String(al.transpose)))
      fail(`${at}.alignment.transpose "${String(al.transpose)}" is not an interval like "-M2"`);
    if (!Number.isInteger(c.expectedDifferences) || (c.expectedDifferences as number) < 0)
      fail(`${at}.expectedDifferences must be a whole number >= 0`);
    if (c.differenceNotes !== undefined) {
      if (!Array.isArray(c.differenceNotes)) fail(`${at}.differenceNotes must be a list`);
      for (const n of c.differenceNotes as unknown[]) string(n, `${at}.differenceNotes`, fail, 300);
    }
  } else if (c.method === 'theory') {
    only(c, ['method', 'ruleSet', 'expectedDifferences'], at, fail);
    if (c.ruleSet !== 'exercise-theory-v1') fail(`${at}.ruleSet must be "exercise-theory-v1"`);
    if (c.expectedDifferences !== 0) fail(`${at}: a theory check's expectedDifferences must be 0`);
  } else if (c.method === 'visual') {
    only(c, ['method', 'source', 'bars', 'result', 'differences'], at, fail);
    string(c.source, `${at}.source`, fail);
    string(c.bars, `${at}.bars`, fail);
    string(c.result, `${at}.result`, fail, 400);
    if (!Array.isArray(c.differences)) fail(`${at}.differences must be a list`);
    for (const d of c.differences as unknown[]) string(d, `${at}.differences`, fail, 300);
  } else fail(`${at}.method "${String(c.method)}" is not mechanical, theory or visual`);
}

// ---- loading -------------------------------------------------------------------------------------------------------

export function loadRecords(root: string): AuditRecord[] {
  const records: AuditRecord[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith('.json')) {
        const where = relative(root, path).split(sep).join('/');
        const record = validateRecord(JSON.parse(readFileSync(path, 'utf8')), where);
        if (`${record.itemId}.json` !== where) throw new Error(`${where}: holds the record of ${record.itemId}`);
        records.push(record);
      }
    }
  };
  walk(root);
  return records.sort((a, b) => (a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0));
}

// ---- re-running ----------------------------------------------------------------------------------------------------

export function runRecord(record: AuditRecord, ctx: RunContext): CheckResult[] {
  return record.checks.map((check) => {
    if (check.method === 'visual')
      return {
        check,
        differences: [],
        allowed: [],
        reproduced: true,
        detail: `visual check of bars ${check.bars} against ${check.source}`,
      };
    if (check.method === 'theory') return runTheory(record, check, ctx);
    return runMechanical(record, check, ctx);
  });
}

/** The independent exercise check (research R8): the claim comes from the item's title and description on the shelf. */
function runTheory(record: AuditRecord, check: TheoryCheck, ctx: RunContext): CheckResult {
  const sidecar = JSON.parse(readFileSync(join(ctx.libraryRoot, `${record.itemId}.json`), 'utf8')) as Sidecar;
  let claim: ReturnType<typeof claimForItem>;
  try {
    claim = claimForItem({ itemId: record.itemId, title: sidecar.title ?? '', trains: sidecar.trains ?? '' });
  } catch (e) {
    if (!(e instanceof ClaimError)) throw e;
    return { check, differences: [], allowed: [], reproduced: false, detail: e.message };
  }
  const xml = readFileSync(ctx.itemFile ?? join(ctx.libraryRoot, `${record.itemId}.musicxml`), 'utf8');
  const differences = checkExercise(xml, claim);
  return {
    check,
    differences,
    allowed: [],
    reproduced: differences.length === check.expectedDifferences,
    detail: `${claim.chords.length} chords checked against "${sidecar.title}": ${differences.length} differences`,
  };
}

function runMechanical(record: AuditRecord, check: MechanicalCheck, ctx: RunContext): CheckResult {
  const manifest = ctx.sources.get(check.source);
  if (!manifest) throw new Error(`${record.itemId}: source "${check.source}" is not under content/library/sources`);
  if (!check.sourceFiles.includes('notation'))
    throw new Error(
      `${record.itemId}: a check against the sound file alone needs bars from the record (data-model.md §4.2), which the record schema does not carry`,
    );
  const item = fromMusicXml(readFileSync(ctx.itemFile ?? join(ctx.libraryRoot, `${record.itemId}.musicxml`), 'utf8'));
  const notation = readNotation(manifest, ctx);
  let differences: Difference[];
  let allowed: Difference[] = [];
  let detail: string;
  if (check.aspects.includes('melody')) {
    ({ differences, allowed } = compareMelody(item, notation, check.alignment, {
      allowRhythm: check.melodyRhythm === 'allowedByDeparture',
      spelling: check.aspects.includes('spelling'),
    }));
    detail = `item vs notation (melody): ${differences.length} differences`;
    if (allowed.length > 0) detail += `, ${allowed.length} rhythm differences allowed by departures`;
  } else {
    differences = compare(item, notation, check.aspects, check.alignment);
    detail = `item vs notation: ${differences.length} differences`;
  }
  if (check.sourceFiles.includes('sound')) {
    const sound = sourceFile(ctx.sourcesRoot, manifest, 'sound');
    if (!sound) throw new Error(`${record.itemId}: source ${manifest.id} has no sound file`);
    const reading = fromMidi(readMidi(sound.bytes), sound.file.midiNoteTracks ?? []);
    const second = compareSound(notation, reading, {
      order: sound.file.midiOrder ?? 'written',
      articulate: sound.file.midiArticulate ?? false,
    });
    differences = [...differences, ...second.differences];
    detail += `; notation vs sound: ${second.differences.length} differences`;
    if (second.durations === 'notation only') detail += ' (durations checked against the notation only)';
  }
  return { check, differences, allowed, reproduced: differences.length === check.expectedDifferences, detail };
}

function readNotation(manifest: SourceManifest, ctx: RunContext): ReferenceScore {
  const notation = sourceFile(ctx.sourcesRoot, manifest, 'notation');
  if (!notation) throw new Error(`source ${manifest.id} has no notation file`);
  const text = new TextDecoder().decode(notation.bytes);
  return notation.file.format === 'lilypond'
    ? fromLilyPond(readLilyPond(text, notation.file.score !== undefined ? { score: notation.file.score } : {}))
    : fromMusicXml(text);
}

// ---- rules ---------------------------------------------------------------------------------------------------------

interface Sidecar {
  title?: string;
  subtitle?: string;
  trains?: string;
  arrangement?: boolean;
  departures?: string[];
  reviewedBy?: string;
  reviewedOn?: string;
}

/** "verified (visual)" when a verified record rests on visual checks only (FR-019); otherwise the outcome. */
export function outcomeLabel(record: AuditRecord): string {
  return record.outcome === 'verified' && record.checks.every((c) => c.method === 'visual')
    ? 'verified (visual)'
    : record.outcome;
}

/** Rules 2.2-2.6 of contract audit-record.md; returns one line per broken rule. */
export function checkRecord(record: AuditRecord, results: CheckResult[], ctx: RunContext): string[] {
  const problems: string[] = [];
  const label = (i: number, c: Check) => `check ${i + 1} (${c.method}${c.method === 'theory' ? '' : `, ${c.source}`})`;

  // 2.2 re-run
  results.forEach(({ check, differences, reproduced }, i) => {
    if (check.method === 'visual') return;
    if (!reproduced)
      problems.push(
        `${label(i, check)}: re-run gives ${differences.length} differences, the record expects ${check.expectedDifferences}`,
      );
    if (check.method === 'mechanical') {
      const notes = check.differenceNotes?.length ?? 0;
      if ((check.expectedDifferences > 0 || notes > 0) && notes !== check.expectedDifferences)
        problems.push(`${label(i, check)}: ${check.expectedDifferences} differences but ${notes} differenceNotes`);
    }
  });

  // 2.3 outcome
  const { outcome } = record;
  if (outcome === 'verified' || outcome === 'fixed' || outcome === 'replaced') {
    const proven = record.checks.some((c) => c.method !== 'visual' && c.expectedDifferences === 0);
    const visualOnly = record.checks.every((c) => c.method === 'visual');
    if (!proven && !(outcome === 'verified' && visualOnly))
      problems.push(`outcome ${outcome} needs a mechanical or theory check with 0 expected differences`);
  }
  if (outcome === 'removed') {
    const readme = join(ctx.libraryRoot, 'README.md');
    const text = existsSync(readme) ? readFileSync(readme, 'utf8') : '';
    const section = text.slice(text.indexOf('## Rejected items'));
    const listed =
      text.includes('## Rejected items') &&
      section.split('\n').some((l) => l.startsWith('|') && l.includes(record.itemId));
    if (!listed)
      problems.push(`outcome removed, but public/library/README.md has no Rejected items row for ${record.itemId}`);
    return problems;
  }
  const sidecarPath = join(ctx.libraryRoot, `${record.itemId}.json`);
  if (!existsSync(sidecarPath)) return [...problems, `item ${record.itemId} is not on the shelf (no sidecar)`];
  const sidecar = JSON.parse(readFileSync(sidecarPath, 'utf8')) as Sidecar;
  const departures = sidecar.departures ?? [];
  if (outcome === 'relabelled') {
    if (!record.previous) problems.push('outcome relabelled needs previous (the claims before the change)');
    else if (sidecar.title === record.previous.title && departures.length === 0)
      problems.push('outcome relabelled, but the title, subtitle and departures are unchanged');
  }

  // 2.4 claims
  if (record.claim === 'original') {
    if (sidecar.arrangement !== false) problems.push('claim original, but the sidecar says arrangement: true');
    const withNotation = record.checks.filter(
      (c): c is MechanicalCheck =>
        c.method === 'mechanical' && ctx.sources.get(c.source)?.files.some((f) => f.role === 'notation') === true,
    );
    if (withNotation.length > 0 && !withNotation.some((c) => ORIGINAL_ASPECTS.every((a) => c.aspects.includes(a)))) {
      const missing = ORIGINAL_ASPECTS.filter((a) => !(withNotation[0] as MechanicalCheck).aspects.includes(a));
      problems.push(
        `claim original needs a mechanical check with barCount, repeats, pitch, onset and duration (missing: ${missing.join(', ')})`,
      );
    }
  }
  if (record.claim === 'exercise' && !record.checks.some((c) => c.method === 'theory'))
    problems.push('claim exercise needs a theory check');
  if (record.claim === 'arrangement') {
    if (sidecar.arrangement !== true) problems.push('claim arrangement, but the sidecar says arrangement: false');
    if (departures.length === 0) problems.push('claim arrangement, but the sidecar has no departures');
  }
  if (
    record.checks.some((c) => c.method === 'mechanical' && c.melodyRhythm === 'allowedByDeparture') &&
    (sidecar.arrangement !== true || departures.length === 0)
  )
    problems.push('rhythm is allowed by departures, but the sidecar is not an arrangement with departures');

  // 2.5 reviewer
  if (sidecar.reviewedBy !== record.checkedBy)
    problems.push(
      `sidecar reviewedBy "${sidecar.reviewedBy}" differs from the record's checkedBy "${record.checkedBy}"`,
    );
  if (sidecar.reviewedOn !== record.date)
    problems.push(`sidecar reviewedOn "${sidecar.reviewedOn}" differs from the record's date "${record.date}"`);
  return problems;
}

// ---- small validators ----------------------------------------------------------------------------------------------

type Fail = (detail: string) => never;
function object(v: unknown, what: string, fail: Fail): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(`${what} must be an object`);
  return v as Record<string, unknown>;
}
function only(o: Record<string, unknown>, keys: string[], what: string, fail: Fail): void {
  for (const k of Object.keys(o)) if (!keys.includes(k)) fail(`${what}: unknown field "${k}"`);
}
function string(v: unknown, what: string, fail: Fail, max = 10_000): string {
  if (typeof v !== 'string' || v.trim() === '') fail(`${what} must be a non-empty string`);
  if ((v as string).length > max) fail(`${what} is longer than ${max} characters`);
  return v as string;
}
function oneOf<T extends string>(v: unknown, allowed: readonly T[], what: string, fail: Fail): T {
  if (typeof v !== 'string' || !allowed.includes(v as T))
    fail(`${what} "${String(v)}" is not one of ${allowed.join(', ')}`);
  return v as T;
}
