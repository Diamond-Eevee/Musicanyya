import type { ElementInsert } from './index.js';

/**
 * Splices every insert into `xml` in a single pass (the same slice-and-join technique
 * `createRenderCopy` uses), so a large file with many inserts is linear rather than quadratic.
 * Inserts are applied in ascending `(offset, order)` - two inserts at the same offset keep the order
 * their caller gave them (contract: accidental order 0 before beam order 1).
 */
export function applyInserts(xml: string, inserts: readonly ElementInsert[]): string {
  if (inserts.length === 0) return xml;

  const sorted = [...inserts].sort((a, b) => (a.offset !== b.offset ? a.offset - b.offset : a.order - b.order));

  const pieces: string[] = [];
  let cursor = 0;
  for (const insert of sorted) {
    pieces.push(xml.slice(cursor, insert.offset), insert.text);
    cursor = insert.offset;
  }
  pieces.push(xml.slice(cursor));

  return pieces.join('');
}
