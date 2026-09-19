import type { XmlDocument } from '@rgrove/parse-xml';
import type { LoadReport } from '../score/load-report.js';
import type { Score } from '../score/model.js';

export function buildScore(doc: XmlDocument): { score: Score; report: LoadReport } {
  throw new Error('Not implemented');
}
