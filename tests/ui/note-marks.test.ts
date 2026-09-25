import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { MarkState } from '../../src/core/practice/types.js';
import { applyNoteMarks, type NoteMarkClass, noteMarkClass } from '../../src/ui/score/note-marks.js';

/** A hand-made page: two notes of the shape Verovio 6.3 prints (g.note#id > g.notehead + g.stem + g.dots + g.accid). */
function page(): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg">
      <g class="note" id="n1"><g class="notehead"><use/></g><g class="stem"><rect/></g><g class="dots"><use/></g><g class="accid"><use/></g></g>
      <g class="note" id="n2"><g class="notehead"><use/></g><g class="stem"><rect/></g></g>
      <g class="note" id="n3"><g class="notehead"><use/></g><g class="stem"><rect/></g></g>
    </svg>`;
  return container;
}

const classesOf = (container: HTMLElement, id: string): string[] =>
  Array.from(container.querySelector(`#${id}`)?.classList ?? []).filter((c) => c.startsWith('mx-mark-'));

describe('note marks: the class on the note (feature 008, US1, research R-01)', () => {
  it('(a) maps every MarkState to its class: green for correct, correctSoFar, playedAlong', () => {
    const table: [MarkState, NoteMarkClass | null][] = [
      ['correct', 'mx-mark-correct'],
      ['correctSoFar', 'mx-mark-correct'],
      ['playedAlong', 'mx-mark-correct'],
      ['heldOver', 'mx-mark-heldover'],
      ['skipped', 'mx-mark-skipped'],
      ['waiting', null],
      ['wrongPitch', null],
      ['wrongOctave', null],
      ['extra', null],
    ];
    for (const [state, expected] of table) expect(noteMarkClass(state), state).toBe(expected);
  });

  it('(b) a note no longer wanted loses its class before the new ones are added (off before on)', () => {
    const container = page();
    const applied = new Map<string, NoteMarkClass>();
    applyNoteMarks(container, new Map([['n1', 'mx-mark-correct']]), applied);
    expect(classesOf(container, 'n1')).toEqual(['mx-mark-correct']);

    // n1 changes state, n2 is new, and n3 was never wanted; the class attribute of n1 is watched change by change
    const watched = container.querySelector('#n1') as Element;
    const seen: string[] = [];
    const patch = (name: 'add' | 'remove') => {
      const original = watched.classList[name].bind(watched.classList);
      watched.classList[name] = (...tokens: string[]) => {
        original(...tokens);
        seen.push(watched.getAttribute('class') ?? '');
      };
    };
    patch('add');
    patch('remove');
    applyNoteMarks(
      container,
      new Map<string, NoteMarkClass>([
        ['n1', 'mx-mark-heldover'],
        ['n2', 'mx-mark-correct'],
      ]),
      applied,
    );
    expect(classesOf(container, 'n1')).toEqual(['mx-mark-heldover']); // the old class is gone, not stacked
    expect(classesOf(container, 'n2')).toEqual(['mx-mark-correct']);
    expect(classesOf(container, 'n3')).toEqual([]);
    expect(seen.length).toBeGreaterThan(0);
    for (const state of seen)
      expect(state).not.toMatch(/mx-mark-correct.*mx-mark-heldover|mx-mark-heldover.*mx-mark-correct/);

    // A note that is no longer wanted at all loses its class
    applyNoteMarks(container, new Map([['n3', 'mx-mark-skipped']]), applied);
    expect(classesOf(container, 'n1')).toEqual([]);
    expect(classesOf(container, 'n2')).toEqual([]);
    expect(classesOf(container, 'n3')).toEqual(['mx-mark-skipped']);
    expect([...applied.entries()]).toEqual([['n3', 'mx-mark-skipped']]); // `applied` mirrors what is on the page now
  });

  it('(c) the class is set on g.note, never on the stem, dots, accidental or notehead itself', () => {
    const container = page();
    applyNoteMarks(container, new Map([['n1', 'mx-mark-correct']]), new Map());
    expect(container.querySelector('#n1')?.getAttribute('class')).toContain('mx-mark-correct');
    for (const part of ['g.notehead', 'g.stem', 'g.dots', 'g.accid']) {
      expect(container.querySelector(`#n1 > ${part}`)?.getAttribute('class'), part).not.toContain('mx-mark');
    }
    expect(container.querySelectorAll('[class*="mx-mark"]')).toHaveLength(1);
  });

  it('(d) calling it twice with the same map changes nothing', () => {
    const container = page();
    const applied = new Map<string, NoteMarkClass>();
    const wanted = new Map<string, NoteMarkClass>([
      ['n1', 'mx-mark-correct'],
      ['n2', 'mx-mark-skipped'],
    ]);
    applyNoteMarks(container, wanted, applied);
    const once = container.innerHTML;
    const observer = new MutationObserver(() => {});
    observer.observe(container, { attributes: true, childList: true, subtree: true });
    applyNoteMarks(container, wanted, applied);
    expect(container.innerHTML).toBe(once);
    expect(observer.takeRecords()).toHaveLength(0); // no attribute was even rewritten
    observer.disconnect();
  });

  it('(e) re-applying after the page SVG is replaced restores every class', () => {
    const container = page();
    const applied = new Map<string, NoteMarkClass>();
    const wanted = new Map<string, NoteMarkClass>([
      ['n1', 'mx-mark-correct'],
      ['n2', 'mx-mark-heldover'],
    ]);
    applyNoteMarks(container, wanted, applied);

    // The page is unmounted and mounted again (scroll, zoom): fresh elements without any class, `applied` unchanged.
    const fresh = page();
    container.innerHTML = fresh.innerHTML;
    expect(classesOf(container, 'n1')).toEqual([]);

    applyNoteMarks(container, wanted, applied);
    expect(classesOf(container, 'n1')).toEqual(['mx-mark-correct']);
    expect(classesOf(container, 'n2')).toEqual(['mx-mark-heldover']);
  });

  it('skips a note whose page is not mounted, and marks it once the page is', () => {
    const container = page();
    const applied = new Map<string, NoteMarkClass>();
    const wanted = new Map<string, NoteMarkClass>([
      ['n1', 'mx-mark-correct'],
      ['far-away', 'mx-mark-correct'],
    ]);
    expect(() => applyNoteMarks(container, wanted, applied)).not.toThrow();
    expect(classesOf(container, 'n1')).toEqual(['mx-mark-correct']);
    container
      .querySelector('svg')
      ?.insertAdjacentHTML('beforeend', '<g class="note" id="far-away"><g class="notehead"><use/></g></g>');
    applyNoteMarks(container, wanted, applied);
    expect(classesOf(container, 'far-away')).toEqual(['mx-mark-correct']);
  });
});

describe('note marks: the CSS (T011, FR-002)', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/ui/styles/score.css'), 'utf8');
  const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selectors: (m[1] ?? '').split(',').map((s) => s.trim().replace(/\s+/g, ' ')),
    body: m[2] ?? '',
  }));
  const markRules = rules.filter((r) => r.selectors.some((s) => s.includes('mx-mark-')));

  it('has one fill rule per mark class, on the notehead only', () => {
    for (const [cls, token] of [
      ['mx-mark-correct', '--practice-correct-color'],
      ['mx-mark-heldover', '--practice-heldover-color'],
      ['mx-mark-skipped', '--practice-skipped-color'],
    ] as const) {
      const rule = markRules.find((r) => r.selectors.includes(`.mx-score-page g.note.${cls} > g.notehead`));
      expect(rule, cls).toBeDefined();
      expect(rule?.body.replace(/\s+/g, ' ')).toContain(`fill: var(${token})`);
    }
  });

  it('colours no note as a whole, and no stem, dots or accidental (FR-002)', () => {
    expect(markRules.length).toBeGreaterThanOrEqual(3);
    for (const rule of markRules) {
      for (const selector of rule.selectors) {
        expect(selector, selector).toMatch(/g\.note\.mx-mark-[a-z]+ > g\.notehead$/);
        expect(selector).not.toMatch(/stem|dots|accid|flag|beam/);
      }
    }
  });
});
