import { describe, expect, it, vi } from 'vitest';
import { applyHighlights } from '../../src/ui/score/highlight.js';
import { drawCursorOverlay } from '../../src/ui/score/cursor-overlay.js';

describe('Highlight and Cursor', () => {
  describe('applyHighlights', () => {
    it('removes highlight class from previous notes and adds to new ones', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <div id="note1" class="playing"></div>
        <div id="note2"></div>
        <div id="note3"></div>
      `;
      
      const prev = new Set(['note1', 'missing-note']);
      const current = new Set(['note2', 'note3']);
      
      applyHighlights(container, current, prev);
      
      expect(container.querySelector('#note1')?.classList.contains('playing')).toBe(false);
      expect(container.querySelector('#note2')?.classList.contains('playing')).toBe(true);
      expect(container.querySelector('#note3')?.classList.contains('playing')).toBe(true);
    });

    it('handles empty sets without error', () => {
      const container = document.createElement('div');
      container.innerHTML = `<div id="note1"></div>`;
      expect(() => applyHighlights(container, new Set(), new Set())).not.toThrow();
    });
  });

  describe('drawCursorOverlay', () => {
    it('uses DPR sizing and draws bar + marker for note rects', () => {
      const ctx = {
        fillRect: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
      } as any;

      const measureRect = { left: 10, top: 20, right: 110, bottom: 80, width: 100, height: 60, x: 10, y: 20, toJSON: () => {} };
      const noteRects = [
        { left: 30, top: 40, right: 40, bottom: 50, width: 10, height: 10, x: 30, y: 40, toJSON: () => {} }
      ];
      const containerRect = { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON: () => {} };

      drawCursorOverlay({
        ctx,
        dpr: 2,
        measureRect,
        noteRects,
        containerRect
      });

      // It should scale by DPR
      // The cursor bar is usually drawn at the measure's X or note's X
      expect(ctx.fillRect).toHaveBeenCalled();
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.arc).toHaveBeenCalled(); // draws marker dot
      expect(ctx.fill).toHaveBeenCalled();
    });

    it('draws measure start if empty cursorNoteIds', () => {
      const ctx = {
        fillRect: vi.fn(),
      } as any;

      const measureRect = { left: 10, top: 20, right: 110, bottom: 80, width: 100, height: 60, x: 10, y: 20, toJSON: () => {} };
      const containerRect = { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON: () => {} };

      drawCursorOverlay({
        ctx,
        dpr: 2,
        measureRect,
        noteRects: [],
        containerRect
      });

      expect(ctx.fillRect).toHaveBeenCalled(); // Should still draw a bar
    });
  });
});
