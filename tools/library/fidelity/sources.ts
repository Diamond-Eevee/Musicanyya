// Authoritative source manifests (contract source-manifest.md): content/library/sources/<id>/source.json. Loading
// validates every manifest by hand against the contract's schema and rules, and re-hashes every committed file.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, normalize, sep } from 'node:path';

export interface SourceFile {
  role: 'notation' | 'sound' | 'scan';
  path?: string;
  url: string;
  sha256?: string;
  format: 'lilypond' | 'midi' | 'musicxml' | 'pdf';
  midiOrder?: 'written' | 'played';
  midiNoteTracks?: number[];
  midiArticulate?: boolean;
  /** LilyPond notation with one \score per movement: which \score (1-based) the source is (contract 1.1.0). */
  score?: number;
  /** The file was extracted from the archive at `url`: the archive's hash and the member's name (contract 1.1.0). */
  archive?: { sha256: string; member: string };
}

export interface SourceManifest {
  version: 1;
  id: string;
  work: string;
  edition: string;
  publisher: string;
  url: string;
  identifier?: string;
  licence: 'public-domain' | 'CC0-1.0';
  credit?: string;
  obtained: string;
  files: SourceFile[];
  approvedByOwner: string;
}

export class SourceError extends Error {
  constructor(folder: string, detail: string) {
    super(`source ${folder}: ${detail}`);
    this.name = 'SourceError';
  }
}

const MANIFEST_FIELDS = [
  'version',
  'id',
  'work',
  'edition',
  'publisher',
  'url',
  'identifier',
  'licence',
  'credit',
  'obtained',
  'files',
  'approvedByOwner',
];
const FILE_FIELDS = [
  'role',
  'path',
  'url',
  'sha256',
  'format',
  'midiOrder',
  'midiNoteTracks',
  'midiArticulate',
  'score',
  'archive',
];
const LICENCES = ['public-domain', 'CC0-1.0'];

export function loadSources(root: string): Map<string, SourceManifest> {
  const sources = new Map<string, SourceManifest>();
  const folders = readdirSync(root)
    .filter((name) => statSync(join(root, name)).isDirectory())
    .sort();
  for (const folder of folders) {
    const file = join(root, folder, 'source.json');
    if (!existsSync(file)) throw new SourceError(folder, 'no source.json');
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      throw new SourceError(folder, `source.json is not JSON (${(e as Error).message})`);
    }
    const manifest = validateManifest(json, folder);
    checkFiles(manifest, join(root, folder), folder);
    sources.set(manifest.id, manifest);
  }
  return sources;
}

export function validateManifest(json: unknown, folder: string): SourceManifest {
  const fail = (detail: string): never => {
    throw new SourceError(folder, detail);
  };
  const m = object(json, 'source.json', fail);
  for (const key of Object.keys(m)) if (!MANIFEST_FIELDS.includes(key)) fail(`unknown field "${key}"`);
  if (m.version !== 1) fail('version must be 1');
  const id = text(m.id, 'id', fail, 100);
  if (!/^[a-z0-9-]+$/.test(id)) fail(`id "${id}" must be lower-case letters, digits and hyphens`);
  if (id !== folder) fail(`folder "${folder}" must be named after its id "${id}"`);
  for (const key of ['work', 'edition', 'publisher']) text(m[key], key, fail, 200);
  url(m.url, 'url', fail);
  if (m.identifier !== undefined) text(m.identifier, 'identifier', fail, 100);
  if (m.credit !== undefined) text(m.credit, 'credit', fail, 300);
  if (typeof m.licence !== 'string' || !LICENCES.includes(m.licence))
    fail(`licence "${String(m.licence)}" is not allowed: only public-domain or CC0-1.0 (FR-006)`);
  date(m.obtained, 'obtained', fail);
  if (m.approvedByOwner === undefined) fail('approvedByOwner is missing: the owner has not approved this source');
  date(m.approvedByOwner, 'approvedByOwner', fail);
  if (!Array.isArray(m.files) || m.files.length === 0) fail('files must list at least one file');
  for (const [i, f] of (m.files as unknown[]).entries()) validateFile(f, i, fail);
  return m as unknown as SourceManifest;
}

function validateFile(json: unknown, index: number, fail: (detail: string) => never): void {
  const f = object(json, `files[${index}]`, fail);
  for (const key of Object.keys(f)) if (!FILE_FIELDS.includes(key)) fail(`files[${index}]: unknown field "${key}"`);
  const role = f.role;
  if (role !== 'notation' && role !== 'sound' && role !== 'scan') fail(`files[${index}]: role "${String(role)}"`);
  const format = f.format;
  const formats: Record<string, string[]> = { notation: ['lilypond', 'musicxml'], sound: ['midi'], scan: ['pdf'] };
  if (typeof format !== 'string' || !formats[role as string]?.includes(format))
    fail(`files[${index}]: format "${String(format)}" does not fit role ${String(role)}`);
  url(f.url, `files[${index}].url`, fail);
  const name = typeof f.path === 'string' ? f.path : `files[${index}]`;
  if (role === 'scan') {
    if (f.path !== undefined) fail(`scan ${name}: scans are not committed, only recorded by URL (research R1)`);
  } else {
    if (typeof f.path !== 'string' || f.path === '') fail(`${role} file files[${index}] has no path`);
    if (typeof f.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(f.sha256)) fail(`${role} file ${name} needs a sha256`);
  }
  if (role === 'sound') {
    if (f.midiOrder !== 'written' && f.midiOrder !== 'played')
      fail(`sound file ${name} needs midiOrder (written or played)`);
    const tracks = f.midiNoteTracks;
    if (!Array.isArray(tracks) || tracks.length === 0 || !tracks.every((t) => Number.isInteger(t) && t >= 0))
      fail(`sound file ${name} needs midiNoteTracks (the tracks that carry the music)`);
    if (typeof f.midiArticulate !== 'boolean') fail(`sound file ${name} needs midiArticulate (true or false)`);
  } else {
    for (const key of ['midiOrder', 'midiNoteTracks', 'midiArticulate'])
      if (f[key] !== undefined) fail(`files[${index}]: ${key} belongs to a sound file only`);
  }
  if (f.score !== undefined) {
    if (role !== 'notation' || format !== 'lilypond')
      fail(`files[${index}]: score belongs to a LilyPond notation file`);
    if (!Number.isInteger(f.score) || (f.score as number) < 1) fail(`${name}: score must be a positive integer`);
  }
  if (f.archive !== undefined) {
    const a = object(f.archive, `${name}: archive`, fail);
    for (const key of Object.keys(a))
      if (key !== 'sha256' && key !== 'member') fail(`${name}: archive has an unknown field "${key}"`);
    if (typeof a.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(a.sha256))
      fail(`${name}: archive needs the sha256 of the archive`);
    if (typeof a.member !== 'string' || a.member.trim() === '') fail(`${name}: archive needs the member file name`);
  }
}

function checkFiles(manifest: SourceManifest, dir: string, folder: string): void {
  for (const f of manifest.files) {
    if (f.path === undefined) continue;
    const resolved = normalize(join(dir, f.path));
    if (isAbsolute(f.path) || !resolved.startsWith(normalize(dir) + sep))
      throw new SourceError(folder, `file ${f.path} must be inside the source folder`);
    if (!existsSync(resolved)) throw new SourceError(folder, `file ${f.path} not found`);
    const actual = createHash('sha256').update(readFileSync(resolved)).digest('hex');
    if (actual !== f.sha256)
      throw new SourceError(folder, `file ${f.path} does not match its recorded SHA-256 (the file was changed)`);
  }
}

/** The bytes of a source's file with the given role; the manifest is already validated and hash-checked. */
export function sourceFile(
  root: string,
  manifest: SourceManifest,
  role: 'notation' | 'sound',
): { file: SourceFile; bytes: Uint8Array } | undefined {
  const file = manifest.files.find((f) => f.role === role);
  if (!file?.path) return undefined;
  return { file, bytes: readFileSync(join(root, manifest.id, file.path)) };
}

// ---- small validators -------------------------------------------------------------------------------------------

type Fail = (detail: string) => never;

function object(v: unknown, what: string, fail: Fail): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(`${what} must be an object`);
  return v as Record<string, unknown>;
}
function text(v: unknown, what: string, fail: Fail, max: number): string {
  if (typeof v !== 'string' || v.trim() === '') fail(`${what} must be a non-empty string`);
  if ((v as string).length > max) fail(`${what} is longer than ${max} characters`);
  return v as string;
}
function url(v: unknown, what: string, fail: Fail): void {
  if (typeof v !== 'string' || !/^https?:\/\/\S+$/.test(v)) fail(`${what} must be an http(s) URL`);
}
export function date(v: unknown, what: string, fail: Fail): void {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`)))
    fail(`${what} must be a date YYYY-MM-DD`);
}
