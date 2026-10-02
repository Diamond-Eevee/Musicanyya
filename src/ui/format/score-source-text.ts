import { isAttributionLicence, licenceName, licenceUrl } from '../../core/library/licences.js';
import type { LibraryItem } from '../../core/library/types.js';
import { en } from '../i18n/en.js';

/** One line of the source text; `link` makes part of it (`link.text`, which occurs in `text`) a link to `link.href`. */
export interface ScoreSourceLine {
  text: string;
  link?: { text: string; href: string };
}

/** FR-019: the lines describing where a library item's Score came from - shared by `mx-score-source` (the open
 *  Score's *About this score* panel) and the browser's detail pane (contracts/score-browser.md §2), so both show
 *  the identical text. Plain text, in reading order; the caller escapes and wraps each line. An attribution-licensed
 *  item (019 FR-025) names its licence with the deed link, its credit and whether it was changed for this app. */
export function scoreSourceLines(item: LibraryItem): ScoreSourceLine[] {
  const s = en.library.source;
  const { provenance } = item.meta;
  const lines: ScoreSourceLine[] = [];

  if (provenance.origin === 'authored' && provenance.basedOn) {
    // an arrangement of a public-domain source (a song): name the source and both licences (library-port 1.2 §4a)
    lines.push({ text: s.arrangement });
    if (provenance.note) lines.push({ text: provenance.note });
  } else if (provenance.origin === 'authored') {
    lines.push({ text: s.authored });
  } else if (isAttributionLicence(provenance.licence)) {
    const name = licenceName(provenance.licence);
    const href = licenceUrl(provenance.licence);
    lines.push({ text: `${s.licence}: ${name}`, ...(href ? { link: { text: name, href } } : {}) });
    lines.push({ text: provenance.source });
    if (provenance.credit) lines.push({ text: `${s.credit}: ${provenance.credit}` });
    if (provenance.unmodified === false) lines.push({ text: s.changed });
  } else {
    lines.push({ text: `${s.licence}: ${provenance.licence}` });
    lines.push({ text: `${provenance.source}` });
    if (provenance.credit) lines.push({ text: `${s.credit}: ${provenance.credit}` });
  }

  if (item.meta.limitations && item.meta.limitations.length > 0) {
    lines.push({ text: `${s.limitations}: ${item.meta.limitations.join('; ')}` });
  }

  return lines;
}

/** A line as HTML: escaped, with its link (opening outside the app) when it has one. */
export function scoreSourceLineHtml(line: ScoreSourceLine, esc: (text: string) => string): string {
  if (!line.link) return `<p class="score-source-line">${esc(line.text)}</p>`;
  const at = line.text.indexOf(line.link.text);
  const before = line.text.slice(0, at);
  const after = line.text.slice(at + line.link.text.length);
  const anchor = `<a href="${esc(line.link.href)}" target="_blank" rel="noopener noreferrer">${esc(line.link.text)}</a>`;
  return `<p class="score-source-line">${esc(before)}${anchor}${esc(after)}</p>`;
}
