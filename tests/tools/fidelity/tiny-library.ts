// A tiny library tree for the records and CLI tests: one own-work source (a LilyPond file and a matching MIDI file
// built byte by byte), one item (the C major scale fixture) with its sidecar, and a library README.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { AuditRecord } from '../../../tools/library/fidelity/records';

export const LY = "\\relative c' { c4 d e f | }\n";
/** Format 1, 384 ppq: track 0 (with a set-tempo event when `usPerQuarter` is given), then the keys as quarters on track 1. */
export function midiOf(keys: number[], usPerQuarter?: number): Uint8Array {
  const be = (n: number, len: number) => Array.from({ length: len }, (_, i) => (n >> ((len - 1 - i) * 8)) & 0xff);
  const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
  const trk = (ev: number[]) => [...ascii('MTrk'), ...be(ev.length, 4), ...ev];
  const notes = keys.flatMap((k) => [0x00, 0x90, k, 64, 0x83, 0x00, 0x80, k, 0]);
  return new Uint8Array([
    ...[...ascii('MThd'), ...be(6, 4), ...be(1, 2), ...be(2, 2), ...be(384, 2)],
    ...trk([...(usPerQuarter ? [0x00, 0xff, 0x51, 0x03, ...be(usPerQuarter, 3)] : []), 0x00, 0xff, 0x2f, 0x00]),
    ...trk([...notes, 0x00, 0xff, 0x2f, 0x00]),
  ]);
}
/** C4 D4 E4 F4, matching `LY`. */
export const MID = midiOf([60, 62, 64, 65]);
export const ITEM_XML = readFileSync(resolve('tests/fixtures/musicxml/scale-c-major-q100.musicxml'), 'utf8');
const sha = (d: string | Uint8Array) => createHash('sha256').update(d).digest('hex');

export const SOURCE = {
  version: 1,
  id: 'test-1',
  work: 'Own work, Scale',
  edition: 'unknown',
  publisher: 'Test',
  url: 'https://example.org/1',
  licence: 'CC0-1.0',
  obtained: '2026-09-24',
  approvedByOwner: '2026-09-24',
  files: [
    { role: 'notation', path: 'scale.ly', url: 'https://example.org/scale.ly', sha256: sha(LY), format: 'lilypond' },
    {
      role: 'sound',
      path: 'scale.mid',
      url: 'https://example.org/scale.mid',
      sha256: sha(MID),
      format: 'midi',
      midiOrder: 'written',
      midiNoteTracks: [1],
      midiArticulate: false,
    },
  ],
};
export const SIDECAR = {
  title: 'Scale',
  subtitle: 'Own work',
  arrangement: false,
  reviewedBy: 'claude-opus-5.5',
  reviewedOn: '2026-09-24',
};
export const ITEM_ID = 'repertoire/test/scale';
const ALL_ASPECTS = [
  'barCount',
  'barLengths',
  'repeats',
  'playedOrder',
  'pitch',
  'onset',
  'duration',
  'spelling',
  'graceNotes',
];

export function record(patch: Partial<AuditRecord> = {}, check: Record<string, unknown> = {}): AuditRecord {
  return {
    version: 1,
    itemId: ITEM_ID,
    claim: 'original',
    claimText: 'Scale',
    checks: [
      {
        method: 'mechanical',
        source: 'test-1',
        sourceFiles: ['notation', 'sound'],
        aspects: ALL_ASPECTS,
        alignment: { itemBars: 'all', sourceBars: 'all' },
        expectedDifferences: 0,
        ...check,
      },
    ],
    outcome: 'verified',
    outcomeNote: 'Identical to the source.',
    checkedBy: 'claude-opus-5.5',
    date: '2026-09-24',
    ...patch,
  } as AuditRecord;
}

export function writeFile(root: string, path: string, data: string | Uint8Array): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), data);
}

/** Writes the source under `sources` and the item, its sidecar and the README under `library`. */
export function writeTree(root: string, sources: string, library: string): void {
  writeFile(root, `${sources}/test-1/scale.ly`, LY);
  writeFile(root, `${sources}/test-1/scale.mid`, MID);
  writeFile(root, `${sources}/test-1/source.json`, JSON.stringify(SOURCE));
  writeFile(root, `${library}/${ITEM_ID}.musicxml`, ITEM_XML);
  writeFile(root, `${library}/${ITEM_ID}.json`, JSON.stringify(SIDECAR));
  writeFile(root, `${library}/README.md`, '## Rejected items\n\n| Item | Reason |\n|---|---|\n');
}
