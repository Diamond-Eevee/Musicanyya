import type { NoteId } from '../../core/score/model.js';
import type { MarkState } from '../../core/practice/types.js';

export interface PracticeMarksOptions {
  ctx: CanvasRenderingContext2D;
  dpr: number;
  containerRect: DOMRect;
  marks: readonly { noteId: NoteId; state: MarkState }[];
  noteRects: ReadonlyMap<NoteId, DOMRect>;
}

export function drawPracticeMarks(options: PracticeMarksOptions): void {
  // To be implemented
}
