import { describe, expect, it } from 'vitest';
import { patchChildren } from '../../src/ui/util/patch-children.js';

function host(html = ''): HTMLElement {
  const el = document.createElement('div');
  document.body.append(el);
  patchChildren(el, html);
  return el;
}

const item = (key: string, text = key) => `<div class="item" data-key="${key}">${text}</div>`;
const keys = (el: HTMLElement) => Array.from(el.children).map((c) => (c as HTMLElement).dataset.key);

// A press on an element that a re-render replaced never becomes a click (WebKit and Chromium both drop it), which
// lost the *All* click during the browser's load-time update. Children whose markup did not change must stay.
describe('patchChildren keeps the children whose markup is unchanged', () => {
  it('builds the children from the markup on the first call', () => {
    const el = host(item('a') + item('b'));
    expect(keys(el)).toEqual(['a', 'b']);
    expect(el.children[0]?.textContent).toBe('a');
  });

  it('leaves unchanged children as the same nodes and replaces only the changed one', () => {
    const el = host(item('a') + item('b') + item('c'));
    const [a, b, c] = Array.from(el.children);
    patchChildren(el, item('a') + item('b', 'b changed') + item('c'));
    expect(el.children[0]).toBe(a);
    expect(el.children[1]).not.toBe(b);
    expect(el.children[1]?.textContent).toBe('b changed');
    expect(el.children[2]).toBe(c);
  });

  it('inserts and removes children without touching the others', () => {
    const el = host(item('a') + item('c'));
    const [a, c] = Array.from(el.children);
    patchChildren(el, item('a') + item('b') + item('c'));
    expect(keys(el)).toEqual(['a', 'b', 'c']);
    expect(el.children[0]).toBe(a);
    expect(el.children[2]).toBe(c);
    patchChildren(el, item('c'));
    expect(keys(el)).toEqual(['c']);
    expect(el.children[0]).toBe(c);
  });

  it('keeps a moved child as the same node in its new place', () => {
    const el = host(item('a') + item('b') + item('c'));
    const [a, b, c] = Array.from(el.children);
    patchChildren(el, item('c') + item('a') + item('b'));
    expect(Array.from(el.children)).toEqual([c, a, b]);
  });

  it('gives identical siblings their own nodes', () => {
    const el = host(item('x') + item('x'));
    const [first, second] = Array.from(el.children);
    expect(first).not.toBe(second);
    patchChildren(el, item('x') + item('x') + item('x'));
    expect(el.children[0]).toBe(first);
    expect(el.children[1]).toBe(second);
    expect(el.children.length).toBe(3);
  });

  it('replaces a child whose markup changed, and builds it again from the markup when it changes back', () => {
    const el = host(item('a'));
    const a = el.children[0];
    patchChildren(el, item('a', 'other'));
    expect(el.children[0]).not.toBe(a);
    patchChildren(el, item('a'));
    expect(el.children[0]?.textContent).toBe('a');
  });

  it('ignores whitespace between children and clears the container for empty markup', () => {
    const el = host(`\n  ${item('a')}\n  ${item('b')}\n`);
    expect(keys(el)).toEqual(['a', 'b']);
    expect(Array.from(el.childNodes).every((n) => n.nodeType === Node.ELEMENT_NODE)).toBe(true);
    patchChildren(el, '');
    expect(el.childNodes.length).toBe(0);
  });

  it('upgrades a custom element inside a new child and keeps it when its markup is unchanged', () => {
    class Probe extends HTMLElement {
      connectedCallback() {
        this.textContent = 'rendered';
      }
    }
    if (!customElements.get('x-patch-probe')) customElements.define('x-patch-probe', Probe);
    const el = host('<div data-key="p"><x-patch-probe></x-patch-probe></div>');
    expect(el.textContent).toBe('rendered');
    const p = el.children[0];
    patchChildren(el, '<div data-key="p"><x-patch-probe></x-patch-probe></div>');
    expect(el.children[0]).toBe(p);
    expect(el.textContent).toBe('rendered');
  });
});
