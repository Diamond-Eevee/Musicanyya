/** data-model.md section 7 - the browser's persisted view state: defaults, per-field validation and seeding from
 *  the old library filter (R-15). Pure (Principle V): no DOM, no Web API, no `localStorage` access - the caller
 *  (`src/ui/state/browserState.ts`) owns reading/writing `musicanyya.browser.v1`. */

import type { Level, LibrarySection, SkillTag } from '../library/types.js';
import { SKILL_TAGS } from '../library/types.js';
import type { BrowserViewState, FolderSel, StatusFilter } from './types.js';

export const DEFAULT_BROWSER_VIEW: BrowserViewState = {
  folder: { kind: 'continue' },
  search: '',
  filters: { level: null, key: null, tag: null, status: null },
  sort: { by: 'library', dir: 'asc' },
  selected: null,
};

const LEVELS: readonly Level[] = ['introduction', 'beginner', 'intermediate', 'advanced'];
const STATUS_FILTERS: readonly StatusFilter[] = [
  'new',
  'practised',
  'played',
  'mastered',
  'notMastered',
  'playedNotMastered',
];
const SORT_BY = ['library', 'title', 'lastPlayed', 'best'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The id of the section a stored `folder` should select now: itself when the index has it, else the section whose
 *  `formerIds` names it, else `continue` (mirrors `libraryState`'s `currentSectionId`, R-15). */
function currentSectionFolder(id: string, sections: readonly LibrarySection[]): FolderSel {
  if (sections.some((s) => s.id === id)) return { kind: 'section', id };
  const replacement = sections.find((s) => s.formerIds?.includes(id));
  return replacement ? { kind: 'section', id: replacement.id } : { kind: 'continue' };
}

function validateFolder(raw: unknown, sections: readonly LibrarySection[]): FolderSel {
  if (!isRecord(raw) || typeof raw.kind !== 'string') return DEFAULT_BROWSER_VIEW.folder;
  switch (raw.kind) {
    case 'continue':
      return { kind: 'continue' };
    case 'all':
      return { kind: 'all' };
    case 'myFiles':
      return { kind: 'myFiles' };
    case 'section':
      return typeof raw.id === 'string' ? currentSectionFolder(raw.id, sections) : DEFAULT_BROWSER_VIEW.folder;
    default:
      return DEFAULT_BROWSER_VIEW.folder;
  }
}

function validateSelected(raw: unknown): BrowserViewState['selected'] {
  if (!isRecord(raw) || typeof raw.kind !== 'string') return null;
  if (raw.kind === 'library' && typeof raw.id === 'string') return { kind: 'library', id: raw.id };
  if (raw.kind === 'file' && typeof raw.fileKey === 'string') return { kind: 'file', fileKey: raw.fileKey };
  return null;
}

/** Keeps every valid field of a stored `musicanyya.browser.v1` payload and replaces each invalid one, alone, with
 *  its default (data-model.md section 7; same per-field pattern as `libraryState`). */
export function validateViewState(raw: unknown, sections: readonly LibrarySection[]): BrowserViewState {
  const r = isRecord(raw) ? raw : {};
  const filtersRaw = isRecord(r.filters) ? r.filters : {};
  const sortRaw = isRecord(r.sort) ? r.sort : {};

  const level = LEVELS.includes(filtersRaw.level as Level) ? (filtersRaw.level as Level) : null;
  const key = typeof filtersRaw.key === 'string' ? filtersRaw.key : null;
  const tag = SKILL_TAGS.includes(filtersRaw.tag as SkillTag) ? (filtersRaw.tag as SkillTag) : null;
  const status = STATUS_FILTERS.includes(filtersRaw.status as StatusFilter)
    ? (filtersRaw.status as StatusFilter)
    : null;

  const sortBy = (SORT_BY as readonly string[]).includes(sortRaw.by as string)
    ? (sortRaw.by as BrowserViewState['sort']['by'])
    : DEFAULT_BROWSER_VIEW.sort.by;
  const sortDir = sortRaw.dir === 'asc' || sortRaw.dir === 'desc' ? sortRaw.dir : DEFAULT_BROWSER_VIEW.sort.dir;

  return {
    folder: validateFolder(r.folder, sections),
    search: typeof r.search === 'string' ? r.search : DEFAULT_BROWSER_VIEW.search,
    filters: { level, key, tag, status },
    sort: { by: sortBy, dir: sortDir },
    selected: validateSelected(r.selected),
  };
}

/** R-15: seeds the browser's view from the old `musicanyya.library.v1` payload's `sectionId`/`level`/`key`/`tag`,
 *  read once on first use. `text` is not carried over: a fresh search starts empty. `null` (no stored filter, or it
 *  was already invalid) gives the plain default. */
export function seedFromLibraryFilter(
  payload: { sectionId: string | null; level: Level | null; key: string | null; tag: SkillTag | null } | null,
): BrowserViewState {
  if (payload === null) return DEFAULT_BROWSER_VIEW;
  return {
    ...DEFAULT_BROWSER_VIEW,
    folder: payload.sectionId !== null ? { kind: 'section', id: payload.sectionId } : { kind: 'all' },
    filters: { level: payload.level, key: payload.key, tag: payload.tag, status: null },
  };
}
