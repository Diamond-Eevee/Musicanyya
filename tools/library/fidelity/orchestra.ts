// The Orchestra check (feature 019, contracts/orchestration-definition.md section 3, rule set `orchestra-v1`): is an item's
// Orchestra what its reviewed definition says, and does it support the piano rather than invent music?
//   O1 structure    - every Orchestra part has the printed part's bars, each as long as the printed bar
//   O2 doubling     - every Orchestra note's pitch class sounds in the piano at the note's onset
//   O3 range        - every Orchestra note lies inside its instrument's range
//   O4 regeneration - the committed Orchestra parts equal a fresh generation from the definition
//   O5 hidden       - every instrument of the definition is an Orchestra part the app itself detects as one
// Reads the finished MusicXML with the app's own `readXml` and `buildScore`. Dev-time only.
import { XmlElement } from '@rgrove/parse-xml';
import { buildScore } from '../../../src/core/musicxml/build';
import { readXml } from '../../../src/core/musicxml/read';
import type { Note } from '../../../src/core/score/model';
import type { OrchestrationDefinition } from '../orchestra/definition';
import { generateOrchestra, keyName } from '../orchestra/generate';

export type OrchestraRule = 'O1' | 'O2' | 'O3' | 'O4' | 'O5';

export interface OrchestraFinding {
  rule: OrchestraRule;
  detail: string;
}

function children(el: XmlElement, name: string): XmlElement[] {
  return el.children.filter((c): c is XmlElement => c instanceof XmlElement && c.name === name);
}
function textOf(el: XmlElement | undefined): string {
  const t = el?.children.find((c) => c.type === 'text');
  return t && 'text' in t ? String(t.text).trim() : '';
}

/** The length of every bar of a `<part>` in its own `<divisions>`, from the notes, forwards and backups it writes. */
function barLengths(part: XmlElement): { divisions: number; lengths: number[] } {
  let divisions = 1;
  const lengths: number[] = [];
  for (const measure of children(part, 'measure')) {
    for (const attributes of children(measure, 'attributes')) {
      const d = Number.parseInt(textOf(children(attributes, 'divisions')[0]), 10);
      if (d > 0) divisions = d;
    }
    let cursor = 0;
    let longest = 0;
    let last = 0;
    for (const el of measure.children) {
      if (!(el instanceof XmlElement)) continue;
      const duration = Number.parseInt(textOf(children(el, 'duration')[0]), 10) || 0;
      if (el.name === 'note') {
        const isGrace = children(el, 'grace').length > 0;
        const isChord = children(el, 'chord').length > 0;
        if (isGrace) continue;
        if (isChord) {
          cursor = last + duration;
        } else {
          last = cursor;
          cursor += duration;
        }
      } else if (el.name === 'forward') cursor += duration;
      else if (el.name === 'backup') cursor -= duration;
      longest = Math.max(longest, cursor);
    }
    lengths.push(longest);
  }
  return { divisions, lengths };
}

export function checkOrchestra(xml: string, definition: OrchestrationDefinition): OrchestraFinding[] {
  const findings: OrchestraFinding[] = [];
  const { doc } = readXml(xml);
  const { score } = buildScore(doc);
  const root = doc.children.find((c): c is XmlElement => c instanceof XmlElement);
  const partNodes = root ? children(root, 'part') : [];
  const printedIndex = score.parts.findIndex((p) => !p.orchestra);
  const printedNode = partNodes[printedIndex];
  const printed = score.parts.filter((p) => !p.orchestra).flatMap((p) => p.notes);

  // O5 first in the code, last in the output: the other rules need the parts to exist
  const missing: string[] = [];
  const orchestraParts = definition.instruments.flatMap((instrument) => {
    const index = score.parts.findIndex((p) => p.xmlId === instrument.id);
    const part = score.parts[index];
    if (!part) {
      missing.push(`${instrument.name} (${instrument.id}) is not in the file`);
      return [];
    }
    if (!part.orchestra)
      missing.push(`${instrument.name} (${instrument.id}) is in the file but the app reads it as a printed part`);
    return [{ instrument, part, node: partNodes[index] }];
  });

  // O1: the printed part's bars and bar lengths, in time (each part in its own divisions)
  if (printedNode) {
    const reference = barLengths(printedNode);
    const refQuarters = reference.lengths.map((l) => l / reference.divisions);
    for (const { instrument, node } of orchestraParts) {
      if (!node) continue;
      const own = barLengths(node);
      if (own.lengths.length !== reference.lengths.length) {
        findings.push({
          rule: 'O1',
          detail: `${instrument.name}: ${own.lengths.length} bars, the printed part has ${reference.lengths.length}`,
        });
        continue;
      }
      own.lengths.forEach((length, bar) => {
        if (Math.abs(length / own.divisions - (refQuarters[bar] ?? 0)) > 1e-9) {
          findings.push({
            rule: 'O1',
            detail: `${instrument.name}: bar ${bar + 1} is ${length / own.divisions} quarters, the printed bar is ${refQuarters[bar]}`,
          });
        }
      });
    }
  }

  // O2 doubling and O3 range
  const absolute = (note: Note) => (score.measures[note.measureIndex]?.startTick ?? 0) + note.onsetInMeasure;
  for (const { instrument, part } of orchestraParts) {
    for (const note of part.notes) {
      if (note.unpitched || note.grace !== null) continue;
      const at = absolute(note);
      const sounding = printed.some(
        (p) =>
          !p.unpitched &&
          p.grace === null &&
          absolute(p) <= at &&
          at < absolute(p) + p.durationTicks &&
          p.soundingKey % 12 === note.soundingKey % 12,
      );
      if (!sounding) {
        findings.push({
          rule: 'O2',
          detail: `${instrument.name}: bar ${note.measureIndex + 1}, ${keyName(note.soundingKey)} is not doubled from a piano note sounding there`,
        });
      }
      if (note.soundingKey < instrument.range.low || note.soundingKey > instrument.range.high) {
        findings.push({
          rule: 'O3',
          detail: `${instrument.name}: bar ${note.measureIndex + 1}, ${keyName(note.soundingKey)} is outside ${keyName(instrument.range.low)}-${keyName(instrument.range.high)}`,
        });
      }
    }
  }

  // O4: a fresh generation from the definition is the file
  let fresh: string | null = null;
  try {
    fresh = generateOrchestra(xml, definition).xml;
  } catch (e) {
    findings.push({ rule: 'O4', detail: `the definition cannot be generated: ${(e as Error).message}` });
  }
  if (fresh !== null && fresh !== xml) {
    findings.push({ rule: 'O4', detail: 'the Orchestra parts differ from a fresh generation from the definition' });
  }

  for (const detail of missing) findings.push({ rule: 'O5', detail });
  return findings;
}
