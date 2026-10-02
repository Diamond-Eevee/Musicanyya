import { type XmlDocument, XmlElement } from '@rgrove/parse-xml';
import type { Score } from '../score/model.js';

/** A byte range of the source text, `end` exclusive (what `createRenderCopy` cuts out). */
export interface Removal {
  start: number;
  end: number;
}

function rootOf(doc: XmlDocument): XmlElement | undefined {
  return doc.children.find((c): c is XmlElement => c instanceof XmlElement);
}

function childElements(el: XmlElement, name: string): XmlElement[] {
  return el.children.filter((c): c is XmlElement => c instanceof XmlElement && c.name === name);
}

/** The `<part>` elements in document order: the same order as `Score.parts`. */
function partNodes(doc: XmlDocument): XmlElement[] {
  const root = rootOf(doc);
  return root ? childElements(root, 'part') : [];
}

/**
 * The byte ranges of every Orchestra part - its `<score-part>` in the `<part-list>` and its `<part>` - for the render copy
 * to cut out, so Verovio never sees the part (feature 019, contracts/orchestra-score.md section 3). Empty for a Score without
 * an Orchestra, which is nearly every Score.
 */
export function orchestraRemovals(doc: XmlDocument, score: Score): Removal[] {
  const orchestra = score.parts.filter((part) => part.orchestra);
  if (orchestra.length === 0) return [];
  const removals: Removal[] = [];
  const nodes = partNodes(doc);
  const root = rootOf(doc);
  const partList = root ? childElements(root, 'part-list')[0] : undefined;
  for (const part of orchestra) {
    const node = nodes[part.index];
    if (node && node.start !== undefined && node.end !== undefined) removals.push({ start: node.start, end: node.end });
    for (const scorePart of partList ? childElements(partList, 'score-part') : []) {
      if (scorePart.attributes.id === part.xmlId && scorePart.start !== undefined && scorePart.end !== undefined) {
        removals.push({ start: scorePart.start, end: scorePart.end });
      }
    }
  }
  return removals.sort((a, b) => a.start - b.start);
}

/**
 * The document with its Orchestra `<part>` elements left out, for the passes that look only at what is printed (engraving
 * completion: an Orchestra's beams and signs are never drawn, so they are not counted either). Every kept element is the
 * original object, so the offsets it carries are still those of the source text.
 */
export function withoutOrchestraParts(doc: XmlDocument, score: Score): XmlDocument {
  if (!score.parts.some((part) => part.orchestra)) return doc;
  const root = rootOf(doc);
  if (!root) return doc;
  const nodes = partNodes(doc);
  const hidden = new Set(score.parts.filter((p) => p.orchestra).map((p) => nodes[p.index]));
  const keptRoot = Object.assign(Object.create(Object.getPrototypeOf(root)), root, {
    children: root.children.filter((child) => !(child instanceof XmlElement && hidden.has(child))),
  }) as XmlElement;
  return Object.assign(Object.create(Object.getPrototypeOf(doc)), doc, {
    children: doc.children.map((child) => (child === root ? keptRoot : child)),
  }) as XmlDocument;
}

/**
 * The start offsets of the `<measure>` elements of the first part that is printed, in order: the Measure IDs of the Score
 * go on these (render-copy contract 1.2.0). With the Orchestra part first in the file, the first part is not the one
 * Verovio engraves.
 */
export function firstPrintedMeasureOffsets(doc: XmlDocument, score: Score): number[] {
  const first = score.parts.find((part) => !part.orchestra);
  const node = first ? partNodes(doc)[first.index] : undefined;
  if (!node) return [];
  return childElements(node, 'measure').flatMap((measure) => (measure.start === undefined ? [] : [measure.start]));
}
