/** The markup each child of a patched container was built from (its `outerHTML` before it was attached). */
const sources = new WeakMap<Element, string>();

/**
 * Makes the children of `container` match `html` (one element per child, whitespace between them ignored), keeping
 * every existing child whose markup is identical instead of rebuilding it.
 *
 * Why: a press on an element that a re-render replaced never becomes a `click` (the browser drops it when the
 * release lands on a different node), so `container.innerHTML = ...` on every state update lost the musician's click
 * whenever an update arrived between the press and the release - the browser's load-time update did this to the first
 * click on a folder. It also keeps hover, focus and text selection on rows that did not change, and reuses the
 * already-upgraded custom elements inside them.
 *
 * Identical siblings are matched in order. Existing children not in `html` are removed; the rest are moved into
 * place only when they are not already there. Listeners must be delegated to `container`: a reused child is not
 * rebuilt, so per-child listeners added after a render would be added twice.
 */
export function patchChildren(container: Element, html: string): void {
  const template = document.createElement('template');
  template.innerHTML = html;
  const wanted = Array.from(template.content.children);
  const wantedSources = wanted.map((child) => child.outerHTML);

  // Existing children by the markup they were built from, in order, so identical siblings pair up one to one.
  const available = new Map<string, Element[]>();
  for (const child of Array.from(container.children)) {
    const source = sources.get(child);
    if (source === undefined) continue;
    const same = available.get(source);
    if (same) same.push(child);
    else available.set(source, [child]);
  }

  const next = wanted.map((child, i) => {
    const source = wantedSources[i] ?? '';
    const reused = available.get(source)?.shift();
    if (reused) return reused;
    sources.set(child, source);
    return child;
  });

  const keep = new Set<Element>(next);
  for (const node of Array.from(container.childNodes)) {
    if (!(node instanceof Element) || !keep.has(node)) node.remove();
  }
  next.forEach((child, i) => {
    if (container.children[i] !== child) container.insertBefore(child, container.children[i] ?? null);
  });
}
