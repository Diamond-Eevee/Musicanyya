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
