export interface RenderCopyInserts {
  notes: Array<{ startOffset: number; tagLength: number; id: string }>;
  measures: Array<{ startOffset: number; tagLength: number; id: string }>;
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function createRenderCopy(xml: string, inserts: RenderCopyInserts): string {
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];
  const usedIds = new Set<string>();

  for (const note of inserts.notes) {
    usedIds.add(note.id);
    const tag = xml.substring(note.startOffset, note.startOffset + note.tagLength);
    replacements.push({
      start: note.startOffset,
      end: note.startOffset + note.tagLength,
      replacement: replaceIdInTag(tag, note.id),
    });
  }

  for (const measure of inserts.measures) {
    usedIds.add(measure.id);
    const tag = xml.substring(measure.startOffset, measure.startOffset + measure.tagLength);
    replacements.push({
      start: measure.startOffset,
      end: measure.startOffset + measure.tagLength,
      replacement: replaceIdInTag(tag, measure.id),
    });
  }

  // Find all id attributes in the original XML that collide with our usedIds,
  // and which are NOT inside one of our replaced tags.
  // This is safe because if it's outside our tags, we can just replace it.
  const allIdsPattern = /\s+id\s*=\s*['"]([^'"]+)['"]/g;
  while (true) {
    const match = allIdsPattern.exec(xml);
    if (match === null) break;
    const idVal = match[1];
    if (usedIds.has(idVal!)) {
      const matchStart = match.index;
      const matchEnd = match.index + match[0].length;

      // Is it inside any of our tag replacements?
      let inside = false;
      for (const rep of replacements) {
        if (matchStart >= rep.start && matchEnd <= rep.end) {
          inside = true;
          break;
        }
      }

      if (!inside) {
        replacements.push({ start: matchStart, end: matchEnd, replacement: '' });
      }
    }
  }

  replacements.sort((a, b) => b.start - a.start);

  let result = xml;
  for (const { start, end, replacement } of replacements) {
    result = result.substring(0, start) + replacement + result.substring(end);
  }

  // Rewrite the XML declaration
  if (result.startsWith('<?xml')) {
    result = result.replace(/<\?xml([^>]*?encoding\s*=\s*['"])([^'"]*)(['"][^>]*)\?>/i, '<?xml$1UTF-8$3?>');
  }

  return result;
}

function replaceIdInTag(tag: string, newId: string): string {
  if (/\s+id\s*=\s*['"][^'"]*['"]/.test(tag)) {
    return tag.replace(/\s+id\s*=\s*['"][^'"]*['"]/, ` id="${newId}"`);
  } else {
    return tag.replace(/^<([^\s>]+)/, `<$1 id="${newId}"`);
  }
}
