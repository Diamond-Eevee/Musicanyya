/** data-model.md §5, research.md R-11 - identity, versions and the display progress of a musician's own file
 *  ("My files"). Pure (Principle V): no DOM, no Web API - storage (bytes, eviction, `stored`'s final value) is the
 *  engine adapter's job (contracts/progress-store.md §1 `putFile`, T066). */
import { PROGRESS_FORMAT_VERSION, USER_FILE_VERSIONS_MAX } from '../defaults.js';
import { currentOnlyView, mergeRecords } from './merge.js';
import type { ProgressStatus, Trend } from './status.js';
import type { ProgressRecord, ProgressResult, UserFileEntry } from './types.js';

/** R-11: Windows and macOS file names are case-insensitive, so "Etude.xml" and "etude.xml" are the same file. */
export function fileKey(fileName: string): string {
  return fileName.normalize('NFC').toLowerCase();
}

export interface NextEntryInput {
  fileName: string;
  hash: string;
  byteLength: number;
  title: string | null;
  composer: string | null;
  openedAt: string;
}

/** data-model.md §5 state machine: a new name, a touch (same name, same content) or a new version (same name, new
 *  content - the old hash moves to the front of `earlierHashes`, capped). Identical content under another name is
 *  just a fresh entry (`existing` is looked up by `fileKey`, so it is `null` for a different name) with the same
 *  `hash` - no special case needed here. `stored` starts `true`; the caller (adapter) may flip it to `false` once
 *  it knows whether a copy of `input`'s bytes actually fit the budget. */
export function nextEntry(existing: UserFileEntry | null, input: NextEntryInput): UserFileEntry {
  if (existing === null) {
    return {
      format: PROGRESS_FORMAT_VERSION,
      fileKey: fileKey(input.fileName),
      fileName: input.fileName,
      title: input.title,
      composer: input.composer,
      hash: input.hash,
      earlierHashes: [],
      byteLength: input.byteLength,
      addedAt: input.openedAt,
      lastOpenedAt: input.openedAt,
      stored: true,
      origin: 'opened',
      updatedAt: input.openedAt,
    };
  }
  const sameContent = existing.hash === input.hash;
  const earlierHashes = sameContent
    ? existing.earlierHashes
    : [existing.hash, ...existing.earlierHashes].slice(0, USER_FILE_VERSIONS_MAX);
  return {
    ...existing,
    fileName: input.fileName,
    title: input.title,
    composer: input.composer,
    hash: input.hash,
    earlierHashes,
    byteLength: input.byteLength,
    lastOpenedAt: input.openedAt,
    stored: true,
    updatedAt: input.openedAt,
  };
}

export interface FileEvictionResult {
  /** Whether a copy of the new bytes can be kept within `budget`. */
  stored: boolean;
  /** `fileKey`s of other, unrelated entries whose own copy must be dropped first, oldest `lastOpenedAt` first. */
  evictFileKeys: readonly string[];
}

/** contracts/progress-store.md §1 "Eviction": whether a new `newByteLength`-byte copy of `newHash` fits `budget`,
 *  evicting *other* entries' copies (least recently opened first) if it does not fit outright. A copy already
 *  shared by another kept entry (same hash) counts once and is free; a hash still shared by another entry that
 *  will not be touched is never a target - dropping it would not free anything, since the shared bytes must stay
 *  for that other entry regardless. `entries` is every existing entry with its *current* `stored` flag. */
export function planFileEviction(
  entries: readonly UserFileEntry[],
  excludeFileKey: string,
  newHash: string,
  newByteLength: number,
  budget: number,
): FileEvictionResult {
  if (newByteLength > budget) return { stored: false, evictFileKeys: [] };

  const kept = entries.filter((e) => e.stored && e.fileKey !== excludeFileKey);
  if (kept.some((e) => e.hash === newHash)) return { stored: true, evictFileKeys: [] }; // already shared, free

  const hashCount = new Map<string, number>();
  for (const e of kept) hashCount.set(e.hash, (hashCount.get(e.hash) ?? 0) + 1);
  const distinctHashSize = new Map<string, number>();
  for (const e of kept) if (!distinctHashSize.has(e.hash)) distinctHashSize.set(e.hash, e.byteLength);
  let total = [...distinctHashSize.values()].reduce((sum, size) => sum + size, 0);
  if (total + newByteLength <= budget) return { stored: true, evictFileKeys: [] };

  // Only entries whose hash nobody else shares can actually free space when evicted.
  const candidates = kept
    .filter((e) => (hashCount.get(e.hash) ?? 0) === 1)
    .sort((a, b) => Date.parse(a.lastOpenedAt) - Date.parse(b.lastOpenedAt));

  const evictFileKeys: string[] = [];
  for (const candidate of candidates) {
    if (total + newByteLength <= budget) break;
    evictFileKeys.push(candidate.fileKey);
    total -= candidate.byteLength;
  }
  return { stored: total + newByteLength <= budget, evictFileKeys };
}

export interface UserFileHistoryEntry {
  result: ProgressResult;
  earlierVersion: boolean; // from one of `earlierHashes`, not the entry's current content (data-model §5)
}

export interface UserFileProgressView {
  status: ProgressStatus;
  best: ProgressResult | null;
  trend: Trend;
  attempts: number;
  lastPlayedAt: string | null;
  history: readonly UserFileHistoryEntry[]; // newest first, at most PROGRESS_RESULTS_MAX
}

/** data-model.md §5 `entryProgress`: status, best, *Mastered* and trend come from the current hash only - an
 *  edited file's new content starts over even if its earlier content had progress; attempts sum over every hash;
 *  every result of every version appears in history, flagged `earlierVersion` when it belongs to an older hash. */
export function entryProgress(
  entry: UserFileEntry,
  records: ReadonlyMap<string, ProgressRecord>,
): UserFileProgressView {
  const merged = mergeRecords(records, entry.hash, entry.earlierHashes);
  const view = currentOnlyView(merged);
  return {
    status: view.status,
    best: view.best,
    trend: view.trend,
    attempts: merged.attempts,
    lastPlayedAt: view.lastPlayedAt,
    history: merged.history.map(({ result, fromCurrentHash }) => ({ result, earlierVersion: !fromCurrentHash })),
  };
}
