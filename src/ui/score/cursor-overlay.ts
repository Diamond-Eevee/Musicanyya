export interface CursorOptions {
  ctx: CanvasRenderingContext2D;
  dpr: number;
  measureRect: DOMRect;
  noteRects: DOMRect[];
  containerRect: DOMRect;
}

export function drawCursorOverlay(options: CursorOptions): void {
  throw new Error('Not implemented');
}
