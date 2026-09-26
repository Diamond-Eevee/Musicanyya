import { describe, expect, it } from 'vitest';
import { buildSectionTree, type SectionNode } from '../../../src/core/library/tree.js';
import type { LibrarySection } from '../../../src/core/library/types.js';

// Feature 011 T021 (contracts/library-port.md 1.2.0 §2): the section tree the panel renders.

function section(id: string, parent: string | null, order: number, title = id): LibrarySection {
  return { id, title, path: id, parent, order };
}

const ids = (nodes: readonly SectionNode[]): string[] => nodes.map((n) => n.section.id);
const has = (...sectionIds: string[]) => sectionIds.map((s) => ({ section: s }));

describe('buildSectionTree', () => {
  it('orders roots and children by `order` among siblings, whatever order the sections arrive in', () => {
    const sections = [
      section('learning/key-changes', 'learning', 2),
      section('repertoire', null, 2),
      section('learning/keys/a-minor', 'learning/keys', 2),
      section('learning', null, 1),
      section('learning/keys', 'learning', 1),
      section('learning/keys/c-major', 'learning/keys', 1),
      section('learning/key-changes/c-major-to-a-minor', 'learning/key-changes', 1),
    ];
    const items = has('learning/keys/c-major', 'learning/keys/a-minor', 'learning/key-changes/c-major-to-a-minor');
    const roots = buildSectionTree(sections, items);
    expect(ids(roots)).toEqual(['learning']);
    const learning = roots[0];
    expect(ids(learning?.children ?? [])).toEqual(['learning/keys', 'learning/key-changes']);
    expect(ids(learning?.children[0]?.children ?? [])).toEqual(['learning/keys/c-major', 'learning/keys/a-minor']);
  });

  it('records the depth of each node', () => {
    const sections = [
      section('learning', null, 1),
      section('learning/keys', 'learning', 1),
      section('learning/keys/c-major', 'learning/keys', 1),
    ];
    const [root] = buildSectionTree(sections, has('learning/keys/c-major'));
    expect(root?.depth).toBe(0);
    expect(root?.children[0]?.depth).toBe(1);
    expect(root?.children[0]?.children[0]?.depth).toBe(2);
  });

  it('omits a section with no items and no non-empty descendants', () => {
    const sections = [
      section('learning', null, 1),
      section('learning/keys', 'learning', 1),
      section('learning/keys/c-major', 'learning/keys', 1),
      section('learning/keys/empty', 'learning/keys', 2),
      section('repertoire', null, 2),
      section('repertoire/beginner', 'repertoire', 1),
    ];
    const roots = buildSectionTree(sections, has('learning/keys/c-major'));
    expect(ids(roots)).toEqual(['learning']);
    expect(ids(roots[0]?.children[0]?.children ?? [])).toEqual(['learning/keys/c-major']);
  });

  it('keeps a parent that holds no items itself but has a child that does', () => {
    const sections = [section('a', null, 1), section('a/b', 'a', 1)];
    expect(ids(buildSectionTree(sections, has('a/b')))).toEqual(['a']);
  });

  it('keeps a section that has items and children with none', () => {
    const sections = [section('a', null, 1), section('a/b', 'a', 1)];
    const roots = buildSectionTree(sections, has('a'));
    expect(ids(roots)).toEqual(['a']);
    expect(roots[0]?.children).toEqual([]);
  });

  it('counts the items of each node and of its subtree', () => {
    const sections = [section('a', null, 1), section('a/b', 'a', 1), section('a/c', 'a', 2)];
    const [root] = buildSectionTree(sections, has('a', 'a/b', 'a/b', 'a/c'));
    expect(root?.itemCount).toBe(1);
    expect(root?.subtreeItemCount).toBe(4);
    expect(root?.children.map((c) => c.itemCount)).toEqual([2, 1]);
  });

  it('treats a section whose parent is not in the list as a root (a filtered or older index never loses it)', () => {
    const sections = [section('orphan/child', 'orphan', 1), section('repertoire', null, 2)];
    const roots = buildSectionTree(sections, has('orphan/child', 'repertoire'));
    expect(ids(roots)).toEqual(['orphan/child', 'repertoire']);
  });

  it('lists sections depth-first, which is the order items are sorted in', () => {
    const sections = [
      section('learning', null, 1),
      section('learning/keys', 'learning', 1),
      section('learning/keys/c-major', 'learning/keys', 1),
      section('learning/keys/a-minor', 'learning/keys', 2),
      section('learning/key-changes', 'learning', 2),
      section('repertoire', null, 2),
    ];
    const roots = buildSectionTree(
      sections,
      has('learning/keys/c-major', 'learning/keys/a-minor', 'learning/key-changes', 'repertoire'),
    );
    const flatten = (nodes: readonly SectionNode[]): string[] =>
      nodes.flatMap((n) => [n.section.id, ...flatten(n.children)]);
    expect(flatten(roots)).toEqual([
      'learning',
      'learning/keys',
      'learning/keys/c-major',
      'learning/keys/a-minor',
      'learning/key-changes',
      'repertoire',
    ]);
  });

  it('does not loop on a parent cycle', () => {
    const sections = [section('a', 'b', 1), section('b', 'a', 1)];
    expect(() => buildSectionTree(sections, has('a', 'b'))).not.toThrow();
  });
});
