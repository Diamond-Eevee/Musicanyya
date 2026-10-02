import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { MAX_FILE_BYTES } from '../../src/core/defaults.js';
import { deriveFacts } from '../../src/core/library/facts.js';
import { validMetadata } from '../../src/core/library/index-model.js';
import { checkLevel } from '../../src/core/library/levels.js';
import { isAttributionLicence, licenceName } from '../../src/core/library/licences.js';
import { checkStepOrder } from '../../src/core/library/step-order.js';
import type { LibraryIndex, LibraryItem, LibrarySection, Provenance } from '../../src/core/library/types.js';
import { buildScore } from '../../src/core/musicxml/build.js';
import { readXml } from '../../src/core/musicxml/read.js';
import { buildTimeline } from '../../src/core/timeline/timeline.js';
import { decodeXml } from '../../src/engine/files/decode.js';
import { hashFile } from '../../src/engine/files/hash.js';
import { readMxl } from '../../src/engine/files/mxl.js';
import { planLibraryEngraving } from './engrave.js';
import { LIBRARY_SECTIONS, type LibrarySectionDefinition } from './sections.js';

export interface BuildLibraryIndexResult {
  index: LibraryIndex;
  /** Non-empty means generation failed (data-model.md §3): a missing/invalid sidecar, a file that
   *  does not load, a silent item, or a file outside any declared section. No placeholders (AGENTS.md
   *  §4) - a problem stops the item from being listed rather than listing it half-formed. */
  problems: string[];
}

function toUint8Array(buffer: Buffer): Uint8Array {
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

function walkScoreFiles(dir: string, base: string = dir): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkScoreFiles(full, base));
    } else if (/\.(musicxml|mxl)$/i.test(entry.name)) {
      out.push(path.relative(base, full).split(path.sep).join('/'));
    }
  }
  return out.sort();
}

/** The licence a reference source's manifest states (`content/library/sources/<id>/source.json`), or undefined
 *  when there is no such source. Read here only to compare licences (019 FR-026); `pnpm library:fidelity` validates
 *  the manifests themselves. */
export type SourceLicenceLookup = (sourceId: string) => string | undefined;

function readSourceLicence(sourceId: string): string | undefined {
  if (!/^[a-z0-9-]+$/.test(sourceId)) return undefined;
  const file = fileURLToPath(new URL(`../../content/library/sources/${sourceId}/source.json`, import.meta.url));
  if (!fs.existsSync(file)) return undefined;
  try {
    const licence = (JSON.parse(fs.readFileSync(file, 'utf-8')) as { licence?: unknown }).licence;
    return typeof licence === 'string' ? licence : undefined;
  } catch {
    return undefined;
  }
}

/** The attribution rules of library-index 1.4.0 (019 FR-025, FR-026); one problem line per broken rule. */
function licenceProblems(
  relFile: string,
  provenance: Provenance,
  thirdPartyNotices: string,
  sourceLicence: SourceLicenceLookup,
): string[] {
  const problems: string[] = [];
  if (provenance.origin === 'downloaded' && isAttributionLicence(provenance.licence)) {
    const name = licenceName(provenance.licence);
    if (!provenance.credit || !thirdPartyNotices.includes(provenance.credit))
      problems.push(`${relFile}: the credit of this ${name} item is not in THIRD_PARTY_NOTICES.md (019 FR-025)`);
    const sourceId = provenance.sourcePath?.split('/')[0];
    if (!sourceId) {
      problems.push(`${relFile}: a ${name} item needs a sourcePath naming the source it was made from (019 FR-026)`);
    } else if (sourceLicence(sourceId) !== provenance.licence) {
      problems.push(
        `${relFile}: its licence ${provenance.licence} differs from source ${sourceId}'s licence ` +
          `${sourceLicence(sourceId) ?? '(no such source)'} (share-alike, 019 FR-026)`,
      );
    }
  }
  if (provenance.origin === 'authored' && provenance.basedOn) {
    const sourceId = /^([a-z0-9-]+):/.exec(provenance.basedOn)?.[1];
    if (sourceId && isAttributionLicence(sourceLicence(sourceId)))
      problems.push(
        `${relFile}: an authored (CC0) item's basedOn source ${sourceId} is attribution-licensed (019 FR-026)`,
      );
  }
  return problems;
}

/** The repository's own THIRD_PARTY_NOTICES.md: where every `downloaded` item's source must be recorded (FR-020). */
function readThirdPartyNotices(): string {
  return fs.readFileSync(fileURLToPath(new URL('../../THIRD_PARTY_NOTICES.md', import.meta.url)), 'utf-8');
}

function sectionIdForFile(relFile: string, sections: readonly LibrarySectionDefinition[]): string | null {
  const dir = relFile.split('/').slice(0, -1).join('/');
  return sections.find((s) => s.path === dir)?.id ?? null;
}

/** Items under these folders belong to a key or key-change folder and carry a `step` (library-index 1.2.0 §1). */
const STEP_FOLDERS = ['learning/keys/', 'learning/key-changes/'];

/** The cross-item rules of contract library-index 1.2.0 §1 and the step-order check (FR-010, SC-002). Every failure
 *  names the item or folder and the cause; a failing shelf is not written. */
function stepRuleProblems(items: readonly LibraryItem[]): string[] {
  const problems: string[] = [];
  const seenSteps = new Map<string, string>();
  const supersededBy = new Map<string, string>();
  const shelfIds = new Set(items.map((item) => item.id));

  for (const item of items) {
    const { meta, id, section } = item;
    const underStepFolder = STEP_FOLDERS.some((prefix) => id.startsWith(prefix));
    if (meta.step === undefined && underStepFolder) {
      problems.push(`${id}: step is required under learning/keys and learning/key-changes (library-index 1.2.0 §1)`);
    }
    if (meta.step !== undefined && !underStepFolder) {
      problems.push(
        `${id}: step is only allowed under learning/keys and learning/key-changes (library-index 1.2.0 §1)`,
      );
    }
    if (meta.step !== undefined) {
      if (meta.step === 'song') {
        if (meta.kind !== 'piece') problems.push(`${id}: a song must be a piece, not an exercise`);
        if (meta.level !== 'beginner' && meta.level !== 'intermediate') {
          problems.push(`${id}: a song is beginner or intermediate, not ${meta.level}`);
        }
      } else if (meta.level !== meta.step && (meta.stepOrder ?? 0) === 0) {
        problems.push(`${id}: step "${meta.step}" requires level "${meta.step}", not "${meta.level}"`);
      }
      const key = `${section}|${meta.step}|${meta.stepOrder ?? 0}`;
      const other = seenSteps.get(key);
      if (other !== undefined) {
        problems.push(
          `${section}: duplicate (step, stepOrder) (${meta.step}, ${meta.stepOrder ?? 0}) - ${other} and ${id}`,
        );
      } else {
        seenSteps.set(key, id);
      }
    }
    if (id.startsWith('learning/key-changes/') && !meta.tags.includes('key-changes')) {
      problems.push(`${id}: an item under learning/key-changes needs the skill tag key-changes`);
    }
    for (const old of meta.supersedes ?? []) {
      if (shelfIds.has(old.id)) problems.push(`${id}: supersedes ${old.id}, which is still on the shelf`);
      const first = supersededBy.get(old.id);
      if (first !== undefined) problems.push(`${old.id}: superseded by both ${first} and ${id}`);
      else supersededBy.set(old.id, id);
    }
  }

  problems.push(...checkStepOrder(items));
  return problems;
}

/** Walks `libraryRoot`, validates every sidecar, loads every score through the app's own `readXml` +
 *  `buildScore` (never a second, looser parser) and derives its facts, then produces the index the
 *  app reads (contracts/library-index.md §2, §4). Importable so `tests/library/*.test.ts` can call it
 *  directly, and runnable as `pnpm library:index` (the block at the bottom of this file). `thirdPartyNotices`
 *  defaults to the repository's own file, so the real shelf is always checked against it. */
export async function buildLibraryIndex(
  libraryRoot: string,
  thirdPartyNotices = readThirdPartyNotices(),
  sectionDefinitions: readonly LibrarySectionDefinition[] = LIBRARY_SECTIONS,
  sourceLicence: SourceLicenceLookup = readSourceLicence,
): Promise<BuildLibraryIndexResult> {
  const problems: string[] = [];
  const items: LibraryItem[] = [];

  for (const relFile of walkScoreFiles(libraryRoot)) {
    const sidecarRelPath = relFile.replace(/\.(musicxml|mxl)$/i, '.json');
    const sidecarFullPath = path.join(libraryRoot, sidecarRelPath);
    if (!fs.existsSync(sidecarFullPath)) {
      problems.push(`${relFile}: missing sidecar ${sidecarRelPath}`);
      continue;
    }

    let rawMeta: unknown;
    try {
      rawMeta = JSON.parse(fs.readFileSync(sidecarFullPath, 'utf-8'));
    } catch (err) {
      problems.push(`${sidecarRelPath}: invalid JSON (${String(err)})`);
      continue;
    }
    const meta = validMetadata(rawMeta);
    if (!meta) {
      problems.push(`${sidecarRelPath}: fails the item-metadata schema (contracts/library-index.md §1)`);
      continue;
    }

    if (meta.provenance.origin === 'downloaded' && !thirdPartyNotices.includes(meta.provenance.source)) {
      problems.push(`${relFile}: downloaded item's source is not recorded in THIRD_PARTY_NOTICES.md (FR-020)`);
      continue;
    }
    const licenceIssues = licenceProblems(relFile, meta.provenance, thirdPartyNotices, sourceLicence);
    if (licenceIssues.length > 0) {
      problems.push(...licenceIssues);
      continue;
    }

    const sectionId = sectionIdForFile(relFile, sectionDefinitions);
    if (!sectionId) {
      problems.push(`${relFile}: its folder is not one of tools/library/sections.ts's declared sections`);
      continue;
    }

    const fileBuffer = fs.readFileSync(path.join(libraryRoot, relFile));
    if (fileBuffer.byteLength === 0) {
      problems.push(`${relFile}: the file is empty`);
      continue;
    }
    if (fileBuffer.byteLength > MAX_FILE_BYTES) {
      problems.push(`${relFile}: ${fileBuffer.byteLength} bytes exceeds MAX_FILE_BYTES`);
      continue;
    }

    let rawBytes = toUint8Array(fileBuffer);
    if (relFile.toLowerCase().endsWith('.mxl')) {
      try {
        rawBytes = await readMxl(rawBytes);
      } catch (err) {
        problems.push(`${relFile}: could not open the .mxl archive (${String(err)})`);
        continue;
      }
    }

    let facts: ReturnType<typeof deriveFacts>;
    try {
      const xmlString = decodeXml(rawBytes);
      const { doc } = readXml(xmlString);
      const { score, report } = buildScore(doc);
      const { timeline, notices: timelineNotices } = buildTimeline(score);
      facts = deriveFacts({ doc, score, timeline, report, timelineNotices });

      const plan = planLibraryEngraving(doc); // printed parts only (019 T107)
      if (plan.findings.length > 0 || plan.invalidBeams.length > 0) {
        for (const finding of plan.findings) {
          if (finding.kind === 'missingAccidental' || finding.kind === 'missingCourtesy') {
            const label = finding.kind === 'missingAccidental' ? 'required' : 'courtesy';
            problems.push(
              `${relFile}: bar ${finding.measureLabel}, staff ${finding.staff} - ${finding.pitch} needs a ${label} accidental`,
            );
          } else if (finding.kind === 'missingBeam') {
            problems.push(
              `${relFile}: bar ${finding.measureLabel}, staff ${finding.staff}, voice ${finding.voice} is missing beams`,
            );
          }
        }
        for (const invalid of plan.invalidBeams) {
          problems.push(
            `${relFile}: bar ${invalid.measureLabel}, voice ${invalid.voice} has inconsistent encoded beam data`,
          );
        }
        continue;
      }
    } catch (err) {
      problems.push(`${relFile}: failed to load (${String(err)})`);
      continue;
    }

    if (facts.notes === 0) {
      problems.push(`${relFile}: silent - it parses but has no sounding note (FR-021)`);
      continue;
    }
    if (meta.kind === 'exercise' && facts.fingeringCoverage !== 1) {
      problems.push(
        `${relFile}: fingeringCoverage ${facts.fingeringCoverage} - every note of an exercise needs a fingering (FR-006)`,
      );
    }
    if (meta.arrangement) {
      const label = `${meta.title} ${meta.subtitle ?? ''}`.toLowerCase();
      if (!label.includes('arrange')) {
        problems.push(`${relFile}: arrangement: true but "arrangement" is not in the title or subtitle (FR-007)`);
      }
    }

    const levelCheck = checkLevel(facts, meta.level, {
      ...(meta.raisedBecause !== undefined ? { raisedBecause: meta.raisedBecause } : {}),
      expectedNotices: meta.expected?.notices ?? [],
      kind: meta.kind,
      tags: meta.tags,
      ...(meta.arrangement !== undefined ? { arrangement: meta.arrangement } : {}),
    });
    if (!levelCheck.pass) {
      problems.push(
        `${relFile}: level check failed for "${meta.level}" - failed criteria [${levelCheck.failed.join(', ')}] (data-model.md §4)`,
      );
    }

    const hash = await hashFile(rawBytes.slice(0));
    const id = relFile.replace(/\.(musicxml|mxl)$/i, '');
    items.push({ id, section: sectionId, file: relFile, bytes: fileBuffer.byteLength, hash, meta, facts, levelCheck });
  }

  problems.push(...stepRuleProblems(items));

  // A section is listed when it holds items or is an ancestor of one that does: readers build the tree from
  // `parent` + `order` (contract library-index 1.2.0 §2), so a folder with no items of its own but with children stays.
  const usedSectionIds = new Set(items.map((i) => i.section));
  const byId = new Map(sectionDefinitions.map((s) => [s.id, s]));
  for (const id of Array.from(usedSectionIds)) {
    for (let parent = byId.get(id)?.parent; parent; parent = byId.get(parent)?.parent) usedSectionIds.add(parent);
  }
  const sections: LibrarySection[] = sectionDefinitions.filter((s) => usedSectionIds.has(s.id)).map((s) => ({ ...s }));

  const index: LibraryIndex = {
    version: 1,
    generated: new Date().toISOString(),
    sections,
    items: items.sort((a, b) => a.id.localeCompare(b.id)),
  };
  return { index, problems };
}

async function main() {
  const libraryRoot = fileURLToPath(new URL('../../public/library/', import.meta.url));
  const { index, problems } = await buildLibraryIndex(libraryRoot);

  if (problems.length > 0) {
    console.error(`Library index generation failed (${problems.length} problem(s)):`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
    return;
  }

  const outPath = path.join(libraryRoot, 'index.json');
  fs.writeFileSync(outPath, `${JSON.stringify(index, null, 2)}\n`);
  console.log(
    `Wrote ${path.relative(process.cwd(), outPath)}: ${index.items.length} items, ${index.sections.length} sections.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
