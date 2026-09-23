import { describe, expect, it } from 'vitest';
import type { ElementInsert } from '../../../../src/core/musicxml/engraving/index.js';
import { applyInserts } from '../../../../src/core/musicxml/engraving/plan.js';

describe('applyInserts', () => {
  it('splices every insert in a single pass, leaving every other byte unchanged', () => {
    const xml = '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>';
    const pitchEnd = xml.indexOf('</pitch>') + '</pitch>'.length;
    const noteEnd = xml.indexOf('</note>');
    const inserts: ElementInsert[] = [
      { offset: pitchEnd, text: '<accidental>sharp</accidental>', order: 0 },
      { offset: noteEnd, text: '<beam number="1">begin</beam>', order: 1 },
    ];
    const result = applyInserts(xml, inserts);
    expect(result).toBe(
      '<note><pitch><step>C</step><octave>4</octave></pitch><accidental>sharp</accidental><duration>4</duration><beam number="1">begin</beam></note>',
    );
  });

  it('orders an accidental (order 0) before a beam (order 1) at the same offset', () => {
    const xml = '<note><duration>4</duration></note>';
    const offset = xml.indexOf('</note>');
    const inserts: ElementInsert[] = [
      { offset, text: '<beam number="1">begin</beam>', order: 1 },
      { offset, text: '<accidental>sharp</accidental>', order: 0 },
    ];
    const result = applyInserts(xml, inserts);
    expect(result).toBe(
      '<note><duration>4</duration><accidental>sharp</accidental><beam number="1">begin</beam></note>',
    );
  });

  it('returns the input unchanged for an empty insert list', () => {
    const xml = '<note><duration>4</duration></note>';
    expect(applyInserts(xml, [])).toBe(xml);
  });

  it('is deterministic: the same input and inserts always produce the same output', () => {
    const xml = '<note><duration>4</duration></note>';
    const offset = xml.indexOf('</note>');
    const inserts: ElementInsert[] = [{ offset, text: '<beam number="1">begin</beam>', order: 1 }];
    expect(applyInserts(xml, inserts)).toBe(applyInserts(xml, inserts));
  });

  it('is idempotent when there is nothing left to insert', () => {
    const xml = '<note><duration>4</duration></note>';
    expect(applyInserts(xml, [])).toBe(applyInserts(applyInserts(xml, []), []));
  });
});
