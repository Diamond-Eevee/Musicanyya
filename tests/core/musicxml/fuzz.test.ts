// Mutation fuzzing of the MusicXML load path (T138).
//
// Constitution III: "bad MusicXML never crashes". The hand-written malformed fixtures cover the ways
// a file is *deliberately* broken; this covers the ways a real file gets broken by accident - a
// truncated download, a flipped byte, a mangled tag. Every mutant must either load or be refused with
// a `MusicXmlLoadError`. An uncaught exception of any other kind is a bug, and so is a mutant that
// takes pathologically long to refuse.
//
// Deterministic by construction: one fixed seed, a counter-based PRNG, and a mutation plan derived
// only from the seed. A failure prints the seed, the base fixture and the exact mutation, so it
// reproduces by running the file again - no flaky "it failed once in CI" reports.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { MusicXmlLoadError } from '../../../src/core/musicxml/load-error.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import { decodeXml } from '../../../src/engine/files/decode.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../../fixtures/musicxml');

/** Change this to explore a different slice of the mutation space; keep it committed. */
const SEED = 0x5f3759df;
const MUTANTS_PER_FIXTURE = 40;
/** A refusal that takes longer than this is a denial-of-service risk, not a clean rejection. */
const PER_MUTANT_BUDGET_MS = 2_000;

/**
 * The bases to mutate: small enough to fuzz many times over, between them covering the structures
 * the loader has to walk - voices and backup, divisions changes, repeats and jumps, ties, tuplets,
 * grace notes, multi-staff, transposition, non-ASCII text and a compressed-source file.
 */
const BASES = [
  'minimal-single-note.musicxml',
  'backup-forward-two-voices.musicxml',
  'divisions-change-mid-part.musicxml',
  'grand-staff-two-voices-per-staff.musicxml',
  'tuplet-triplet-eighths.musicxml',
  'grace-group-at-start.musicxml',
  'tie-chain-three.musicxml',
  'volta-1-2.musicxml',
  'ds-al-coda.musicxml',
  'meter-change.musicxml',
  'transpose-bb-clarinet.musicxml',
  'non-ascii-Łódź-日本.musicxml',
  'percussion-unpitched.musicxml',
  'measure-repeat.musicxml',
];

/** mulberry32: small, fast, and reproducible across platforms and Node versions. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type MutationKind = 'bitFlip' | 'truncate' | 'tagShuffle' | 'chunkDelete' | 'chunkDuplicate' | 'byteSplice';

interface Mutation {
  kind: MutationKind;
  detail: string;
  bytes: Uint8Array;
}

const TAG = /<[^>]{1,200}>/g;

function mutate(source: Uint8Array, text: string, next: () => number): Mutation {
  const kinds: MutationKind[] = ['bitFlip', 'truncate', 'tagShuffle', 'chunkDelete', 'chunkDuplicate', 'byteSplice'];
  const kind = kinds[Math.floor(next() * kinds.length)] as MutationKind;
  const len = source.length;

  switch (kind) {
    case 'bitFlip': {
      // Several flips at once: one flipped byte in a 500-byte file is usually a no-op for the parser.
      const bytes = Uint8Array.from(source);
      const flips = 1 + Math.floor(next() * 8);
      const at: number[] = [];
      for (let i = 0; i < flips; i++) {
        const index = Math.floor(next() * len);
        const bit = 1 << Math.floor(next() * 8);
        const current = bytes[index];
        if (current === undefined) continue;
        bytes[index] = current ^ bit;
        at.push(index);
      }
      return { kind, detail: `flipped bits at [${at.join(',')}]`, bytes };
    }
    case 'truncate': {
      const cut = Math.floor(next() * len);
      return { kind, detail: `kept first ${cut} of ${len} bytes`, bytes: source.slice(0, cut) };
    }
    case 'tagShuffle': {
      // Swap two whole tags, which keeps the file plausible-looking but breaks its nesting.
      const tags = [...text.matchAll(TAG)];
      if (tags.length < 2) return { kind, detail: 'no tags to swap', bytes: Uint8Array.from(source) };
      const i = Math.floor(next() * tags.length);
      let j = Math.floor(next() * tags.length);
      if (j === i) j = (j + 1) % tags.length;
      const [a, b] = i < j ? [tags[i], tags[j]] : [tags[j], tags[i]];
      if (a?.index === undefined || b?.index === undefined) {
        return { kind, detail: 'unusable tag match', bytes: Uint8Array.from(source) };
      }
      const swapped =
        text.slice(0, a.index) +
        b[0] +
        text.slice(a.index + a[0].length, b.index) +
        a[0] +
        text.slice(b.index + b[0].length);
      return { kind, detail: `swapped ${a[0].slice(0, 40)} with ${b[0].slice(0, 40)}`, bytes: encode(swapped) };
    }
    case 'chunkDelete': {
      const start = Math.floor(next() * len);
      const size = 1 + Math.floor(next() * Math.max(1, Math.min(200, len - start)));
      const bytes = new Uint8Array(len - size);
      bytes.set(source.subarray(0, start), 0);
      bytes.set(source.subarray(start + size), start);
      return { kind, detail: `deleted ${size} bytes at ${start}`, bytes };
    }
    case 'chunkDuplicate': {
      const start = Math.floor(next() * len);
      const size = 1 + Math.floor(next() * Math.max(1, Math.min(200, len - start)));
      const chunk = source.subarray(start, start + size);
      const bytes = new Uint8Array(len + size);
      bytes.set(source.subarray(0, start + size), 0);
      bytes.set(chunk, start + size);
      bytes.set(source.subarray(start + size), start + size + size);
      return { kind, detail: `duplicated ${size} bytes at ${start}`, bytes };
    }
    default: {
      // Splice in bytes that are meaningful to an XML parser: angle brackets, quotes, ampersands.
      const nasty = [0x3c, 0x3e, 0x26, 0x22, 0x27, 0x2f, 0x00, 0xff];
      const bytes = Uint8Array.from(source);
      const writes = 1 + Math.floor(next() * 6);
      const at: number[] = [];
      for (let i = 0; i < writes; i++) {
        const index = Math.floor(next() * len);
        bytes[index] = nasty[Math.floor(next() * nasty.length)] as number;
        at.push(index);
      }
      return { kind, detail: `spliced XML metacharacters at [${at.join(',')}]`, bytes };
    }
  }
}

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

interface Failure {
  fixture: string;
  iteration: number;
  kind: MutationKind;
  detail: string;
  problem: string;
}

describe('MusicXML mutation fuzzing (T138, Constitution III)', () => {
  it(`survives ${BASES.length * MUTANTS_PER_FIXTURE} mutants without an uncaught exception`, () => {
    const failures: Failure[] = [];
    let loaded = 0;
    let refused = 0;
    let slowest = { ms: 0, fixture: '', detail: '' };

    for (const [fixtureIndex, fixtureName] of BASES.entries()) {
      const source = new Uint8Array(fs.readFileSync(path.join(fixturesDir, fixtureName)));
      const text = decodeXml(source);
      // A stream per fixture, seeded from the base seed, so adding a fixture does not reshuffle
      // the mutants of the others.
      const next = rng(SEED + fixtureIndex * 0x9e3779b1);

      for (let iteration = 0; iteration < MUTANTS_PER_FIXTURE; iteration++) {
        const mutation = mutate(source, text, next);
        const started = performance.now();
        let problem: string | null = null;

        try {
          const xml = decodeXml(mutation.bytes);
          const parsed = readXml(xml);
          const { score, report } = buildScore(parsed.doc);

          // A mutant that loads must still produce a coherent Score: the rest of the app trusts
          // these invariants regardless of how the file got here.
          if (!Number.isFinite(score.ppq) || score.ppq <= 0) problem = `ppq is ${score.ppq}`;
          else if (score.measures.some((m) => !Number.isFinite(m.startTick) || m.startTick < 0)) {
            problem = 'a measure has a negative or non-finite startTick';
          } else if (score.measures.some((m) => !Number.isFinite(m.lengthTicks) || m.lengthTicks < 0)) {
            problem = 'a measure has a negative or non-finite lengthTicks';
          } else if (report.skippedElementCount < 0) {
            problem = `skippedElementCount is ${report.skippedElementCount}`;
          } else {
            loaded++;
          }
        } catch (err) {
          if (err instanceof MusicXmlLoadError) refused++;
          else problem = `${(err as Error).name}: ${(err as Error).message}`;
        }

        const elapsed = performance.now() - started;
        if (elapsed > slowest.ms) slowest = { ms: elapsed, fixture: fixtureName, detail: mutation.detail };
        if (problem === null && elapsed > PER_MUTANT_BUDGET_MS) {
          problem = `took ${elapsed.toFixed(0)} ms, over the ${PER_MUTANT_BUDGET_MS} ms budget`;
        }

        if (problem !== null) {
          failures.push({
            fixture: fixtureName,
            iteration,
            kind: mutation.kind,
            detail: mutation.detail,
            problem,
          });
        }
      }
    }

    console.log(
      `fuzz seed 0x${SEED.toString(16)}: ${loaded} mutants loaded, ${refused} refused with ` +
        `MusicXmlLoadError, ${failures.length} failed; slowest ${slowest.ms.toFixed(0)} ms ` +
        `(${slowest.fixture}, ${slowest.detail})`,
    );

    expect(failures.map((f) => `${f.fixture} #${f.iteration} [${f.kind}] ${f.detail} -> ${f.problem}`)).toEqual([]);
  }, 120_000);

  it('is deterministic: the same seed produces the same mutants', () => {
    const source = new Uint8Array(fs.readFileSync(path.join(fixturesDir, 'minimal-single-note.musicxml')));
    const text = decodeXml(source);

    const first = rng(SEED);
    const second = rng(SEED);
    for (let i = 0; i < 20; i++) {
      const a = mutate(source, text, first);
      const b = mutate(source, text, second);
      expect(a.kind).toBe(b.kind);
      expect(a.detail).toBe(b.detail);
      expect(Array.from(a.bytes)).toEqual(Array.from(b.bytes));
    }
  });

  it('exercises every mutation kind at the configured budget', () => {
    const source = new Uint8Array(fs.readFileSync(path.join(fixturesDir, 'volta-1-2.musicxml')));
    const text = decodeXml(source);
    const next = rng(SEED);
    const seen = new Set<MutationKind>();
    for (let i = 0; i < 200; i++) seen.add(mutate(source, text, next).kind);
    expect([...seen].sort()).toEqual(
      ['bitFlip', 'byteSplice', 'chunkDelete', 'chunkDuplicate', 'tagShuffle', 'truncate'].sort(),
    );
  });
});
