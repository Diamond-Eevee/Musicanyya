import type { LibraryItem, LibrarySection } from './types.js';

/** One folder of the library panel (contracts/library-port.md 1.2.0 §2). */
export interface SectionNode {
  section: LibrarySection;
  /** 0 for a root. */
  depth: number;
  /** Items filed directly in this section. */
  itemCount: number;
  /** Items in this section and everything below it. */
  subtreeItemCount: number;
  children: SectionNode[];
}

/** Builds the section tree the panel renders: roots and children ordered by `order` among siblings, a section with no items
 *  and no non-empty descendant left out. A section whose `parent` is not in `sections` is a root, so an index that names an
 *  unknown parent (or an older one) never loses a folder. Pure (Principle V): no DOM, no Web APIs. */
export function buildSectionTree(
  sections: readonly LibrarySection[],
  items: readonly Pick<LibraryItem, 'section'>[],
): SectionNode[] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.section, (counts.get(item.section) ?? 0) + 1);

  const known = new Set(sections.map((s) => s.id));
  const childrenOf = new Map<string | null, LibrarySection[]>();
  for (const section of sections) {
    const parent =
      section.parent !== null && known.has(section.parent) && section.parent !== section.id ? section.parent : null;
    const list = childrenOf.get(parent) ?? [];
    list.push(section);
    childrenOf.set(parent, list);
  }

  const visited = new Set<string>();
  const build = (section: LibrarySection, depth: number): SectionNode | null => {
    if (visited.has(section.id)) return null;
    visited.add(section.id);
    const children = (childrenOf.get(section.id) ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((child) => build(child, depth + 1))
      .filter((node): node is SectionNode => node !== null);
    const itemCount = counts.get(section.id) ?? 0;
    const subtreeItemCount = itemCount + children.reduce((sum, c) => sum + c.subtreeItemCount, 0);
    if (subtreeItemCount === 0) return null;
    return { section, depth, itemCount, subtreeItemCount, children };
  };

  return (childrenOf.get(null) ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((root) => build(root, 0))
    .filter((node): node is SectionNode => node !== null);
}

/** The sections of a tree, depth first, parents before their children: the order items are listed in. */
export function flattenSectionTree(nodes: readonly SectionNode[]): LibrarySection[] {
  return nodes.flatMap((node) => [node.section, ...flattenSectionTree(node.children)]);
}
