import type { LibraryItem } from '../../core/library/types.js';
import { en } from '../i18n/en.js';

/** FR-019: the lines describing where a library item's Score came from - shared by `mx-score-source` (the open
 *  Score's *About this score* panel) and the browser's detail pane (contracts/score-browser.md §2), so both show
 *  the identical text. Plain text, in reading order; the caller escapes and wraps each line. */
export function scoreSourceLines(item: LibraryItem): string[] {
  const s = en.library.source;
  const { provenance } = item.meta;
  const lines: string[] = [];

  if (provenance.origin === 'authored' && provenance.basedOn) {
    // an arrangement of a public-domain source (a song): name the source and both licences (library-port 1.2 §4a)
    lines.push(s.arrangement);
    if (provenance.note) lines.push(provenance.note);
  } else if (provenance.origin === 'authored') {
    lines.push(s.authored);
  } else {
    lines.push(`${s.licence}: ${provenance.licence}`);
    lines.push(`${provenance.source}`);
    if (provenance.credit) lines.push(`${s.credit}: ${provenance.credit}`);
  }

  if (item.meta.limitations && item.meta.limitations.length > 0) {
    lines.push(`${s.limitations}: ${item.meta.limitations.join('; ')}`);
  }

  return lines;
}
