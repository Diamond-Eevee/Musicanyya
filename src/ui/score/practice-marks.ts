import type { MarkState } from '../../core/practice/types.js';
import type { NoteId } from '../../core/score/model.js';

export interface PracticeMarksOptions {
  ctx: CanvasRenderingContext2D;
  dpr: number;
  containerRect: DOMRect;
  marks: readonly { noteId: NoteId; state: MarkState }[];
  noteRects: ReadonlyMap<NoteId, DOMRect>;
  dimmedNoteRects?: readonly DOMRect[];
}

export function drawPracticeMarks(options: PracticeMarksOptions): void {
  const { ctx, dpr, containerRect, marks, noteRects, dimmedNoteRects } = options;

  // Dim unselected notes
  if (dimmedNoteRects) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    for (const rect of dimmedNoteRects) {
      const x = (rect.left - containerRect.left) * dpr;
      const y = (rect.top - containerRect.top) * dpr;
      const w = rect.width * dpr;
      const h = rect.height * dpr;
      ctx.fillRect(x - 2 * dpr, y - 2 * dpr, w + 4 * dpr, h + 4 * dpr);
    }
  }

  for (const mark of marks) {
    const rect = noteRects.get(mark.noteId);
    if (!rect) continue;

    const x = (rect.left - containerRect.left) * dpr;
    const y = (rect.top - containerRect.top) * dpr;
    const w = rect.width * dpr;
    const h = rect.height * dpr;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.max(w, h) / 2 + 4 * dpr; // Draw outside the notehead

    ctx.beginPath();
    ctx.lineWidth = 2 * dpr;
    ctx.setLineDash([]);

    switch (mark.state) {
      case 'correctSoFar':
        ctx.strokeStyle = '#56b4e9'; // sky-blue
        ctx.setLineDash([4 * dpr, 4 * dpr]);
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'correct':
        ctx.strokeStyle = '#009e73'; // bluish-green
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'wrongPitch':
        ctx.strokeStyle = '#d55e00'; // vermilion
        ctx.moveTo(cx - r, cy - r);
        ctx.lineTo(cx + r, cy + r);
        ctx.moveTo(cx + r, cy - r);
        ctx.lineTo(cx - r, cy + r);
        ctx.stroke();
        break;
      case 'wrongOctave':
        ctx.strokeStyle = '#e69f00'; // orange
        ctx.strokeRect(cx - r, cy - r, r * 2, r * 2);
        break;
      case 'extra':
        ctx.strokeStyle = '#cc79a7'; // reddish-purple
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r, cy);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r, cy);
        ctx.closePath();
        ctx.stroke();
        break;
      case 'heldOver':
        ctx.strokeStyle = '#f0e442'; // yellow
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r, cy + r);
        ctx.lineTo(cx - r, cy + r);
        ctx.closePath();
        ctx.stroke();
        break;
      case 'playedAlong':
        ctx.strokeStyle = '#0072b2'; // blue
        ctx.moveTo(cx - r, cy - r / 2);
        ctx.lineTo(cx, cy - r);
        ctx.lineTo(cx + r, cy - r / 2);
        ctx.lineTo(cx + r, cy + r / 2);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r, cy + r / 2);
        ctx.closePath();
        ctx.stroke();
        break;
      case 'skipped':
        ctx.strokeStyle = '#999999'; // gray
        ctx.setLineDash([2 * dpr, 2 * dpr]);
        ctx.strokeRect(cx - r, cy - r, r * 2, r * 2);
        break;
      case 'waiting':
        ctx.strokeStyle = '#0072b2'; // blue
        ctx.setLineDash([6 * dpr, 4 * dpr]);
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        break;
    }
  }
}
