import { gradePerformance } from '../core/grade/grade.js';
import type { Grade, GradeInput } from '../core/grade/types.js';

/**
 * The worker side of contracts/grading.md's "Worker protocol" (R-08). Adds no logic: it only
 * unwraps the message, calls the pure `gradePerformance`, and wraps the reply. Exported (rather
 * than only reachable through `self.onmessage`) so it can be driven directly in Node, the same
 * pattern `src/workers/score.worker.ts` uses.
 */
export function handleMessage(event: MessageEvent, postMessageFn: typeof postMessage) {
  const data = event.data;
  if (data.type !== 'grade') return;

  const { requestId, input } = data as { requestId: number; input: GradeInput };
  try {
    const grade = gradePerformance(input);
    postMessageFn({ type: 'graded', requestId, grade });
  } catch (error: any) {
    postMessageFn({ type: 'error', requestId, message: error?.message ?? String(error) });
  }
}

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('message', (event) => {
    handleMessage(event, self.postMessage.bind(self));
  });
}

// ---- Main-thread client (T031: "and its message handling in the controller") ----

/** The minimal `Worker` surface `requestGrade` needs, so it can be driven by a fake in tests. */
export interface GradeWorkerLike {
  postMessage(msg: unknown): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
}

export type GradeRequestResult =
  | { ok: true; grade: Grade }
  | { ok: false; reason: 'timeout' | 'error'; message?: string };

/**
 * Posts a `grade` message and resolves with its `graded`/`error` reply, matched by `requestId` so
 * replies to a stale request are ignored. Never hangs: after `timeoutMs` (`GRADE_WORKER_TIMEOUT_MS`
 * in production) it resolves `{ ok: false, reason: 'timeout' }` instead of leaving the caller on a
 * spinner (contracts/grading.md). `src/app/play-session.ts` (T039) is the only caller; it turns a
 * non-`ok` result into whatever notice makes sense in the run's context.
 */
export function requestGrade(
  worker: GradeWorkerLike,
  input: GradeInput,
  requestId: number,
  timeoutMs: number,
): Promise<GradeRequestResult> {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (result: GradeRequestResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.removeEventListener('message', onMessage);
      resolve(result);
    };

    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || data.requestId !== requestId) return;
      if (data.type === 'graded') finish({ ok: true, grade: data.grade });
      else if (data.type === 'error') finish({ ok: false, reason: 'error', message: data.message });
    }

    const timer = setTimeout(() => finish({ ok: false, reason: 'timeout' }), timeoutMs);

    worker.addEventListener('message', onMessage);
    worker.postMessage({ type: 'grade', requestId, input });
  });
}
