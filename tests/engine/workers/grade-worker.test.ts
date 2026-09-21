/**
 * T096: the `grade` / `graded` / `error` messages of contracts/grading.md round-trip as
 * structured-cloneable data, `requestId` pairs a request and its reply, and a worker that never
 * answers becomes a notice (`{ ok: false, reason: 'timeout' }`) after `GRADE_WORKER_TIMEOUT_MS`,
 * not a hang.
 *
 * Two things are under test, per src/workers/grade.worker.ts:
 *  - `handleMessage` (the worker side): mirrors src/workers/score.worker.ts's pattern - a plain
 *    exported function driven directly in Node, the same code the real `self.onmessage` wraps.
 *  - `requestGrade` (the main-thread client, "its message handling in the controller" per T031):
 *    posts `grade`, resolves on a matching `graded`/`error`, times out otherwise. Driven here
 *    against a `FakeGradeWorker` so the round-trip and the timeout can both be tested without a
 *    real Worker or real audio hardware (Constitution IV).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gradePerformance } from '../../../src/core/grade/grade.js';
import type { Grade } from '../../../src/core/grade/types.js';
import { handleMessage, requestGrade } from '../../../src/workers/grade.worker.js';
import { buildGradeInput } from '../../core/grade/helpers.js';
import { loadRecordedPerformance } from '../../fakes/performance-log.js';

const BOTH = { preset: 'both' as const, partIndex: 0, staves: [1] };

/** A worker double: posted messages are captured, and replies are delivered by calling `reply()`. */
class FakeGradeWorker {
  posted: any[] = [];
  private listeners = new Set<(event: MessageEvent) => void>();

  postMessage(msg: unknown) {
    this.posted.push(msg);
  }
  addEventListener(_type: 'message', listener: (event: MessageEvent) => void) {
    this.listeners.add(listener);
  }
  removeEventListener(_type: 'message', listener: (event: MessageEvent) => void) {
    this.listeners.delete(listener);
  }
  reply(data: any) {
    for (const l of [...this.listeners]) l({ data } as MessageEvent);
  }
}

describe('grade.worker handleMessage (worker side)', () => {
  it('grade -> graded round-trips a structured-cloneable Grade, requestId preserved', () => {
    const { log } = loadRecordedPerformance('accurate-eight-measures.json');
    const input = buildGradeInput('eight-measure-melody.musicxml', BOTH, log);
    const expectedGrade = gradePerformance(input);

    const messages: any[] = [];
    const post = (msg: any) => messages.push(msg);

    handleMessage({ data: { type: 'grade', requestId: 7, input } } as unknown as MessageEvent, post);

    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe('graded');
    expect(messages[0].requestId).toBe(7);
    // structured-cloneable: no functions, no class instances, round-trips through JSON untouched
    const cloned: Grade = JSON.parse(JSON.stringify(messages[0].grade));
    expect(cloned).toEqual(JSON.parse(JSON.stringify(expectedGrade)));
  });

  it('a malformed input produces an error message carrying the same requestId, never a throw', () => {
    const messages: any[] = [];
    const post = (msg: any) => messages.push(msg);

    // Missing every required GradeInput field - gradePerformance must throw, handleMessage must catch it.
    handleMessage({ data: { type: 'grade', requestId: 3, input: {} } } as unknown as MessageEvent, post);

    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe('error');
    expect(messages[0].requestId).toBe(3);
    expect(typeof messages[0].message).toBe('string');
  });

  it('ignores a message that is not type "grade"', () => {
    const messages: any[] = [];
    const post = (msg: any) => messages.push(msg);
    handleMessage({ data: { type: 'other' } } as unknown as MessageEvent, post);
    expect(messages).toHaveLength(0);
  });
});

describe('requestGrade (main-thread client)', () => {
  it('resolves ok with the Grade when the worker replies graded with a matching requestId', async () => {
    const { log } = loadRecordedPerformance('accurate-eight-measures.json');
    const input = buildGradeInput('eight-measure-melody.musicxml', BOTH, log);
    const expectedGrade = gradePerformance(input);

    const worker = new FakeGradeWorker();
    const promise = requestGrade(worker, input, 1, 5000);

    expect(worker.posted).toHaveLength(1);
    expect(worker.posted[0]).toEqual({ type: 'grade', requestId: 1, input });

    worker.reply({ type: 'graded', requestId: 1, grade: expectedGrade });
    const result = await promise;
    expect(result).toEqual({ ok: true, grade: expectedGrade });
  });

  it('resolves not-ok with the error message when the worker replies error', async () => {
    const { log } = loadRecordedPerformance('accurate-eight-measures.json');
    const input = buildGradeInput('eight-measure-melody.musicxml', BOTH, log);

    const worker = new FakeGradeWorker();
    const promise = requestGrade(worker, input, 2, 5000);
    worker.reply({ type: 'error', requestId: 2, message: 'boom' });

    expect(await promise).toEqual({ ok: false, reason: 'error', message: 'boom' });
  });

  it('ignores a reply for a different requestId (a stale request from a previous grade)', async () => {
    const { log } = loadRecordedPerformance('accurate-eight-measures.json');
    const input = buildGradeInput('eight-measure-melody.musicxml', BOTH, log);
    const expectedGrade = gradePerformance(input);

    const worker = new FakeGradeWorker();
    const promise = requestGrade(worker, input, 10, 5000);

    worker.reply({ type: 'graded', requestId: 9, grade: expectedGrade }); // stale - must be ignored
    worker.reply({ type: 'graded', requestId: 10, grade: expectedGrade }); // the real reply

    expect(await promise).toEqual({ ok: true, grade: expectedGrade });
  });

  describe('with fake timers', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('T096: a worker that never answers becomes a timeout notice after GRADE_WORKER_TIMEOUT_MS, not a hang', async () => {
      const { log } = loadRecordedPerformance('accurate-eight-measures.json');
      const input = buildGradeInput('eight-measure-melody.musicxml', BOTH, log);

      const worker = new FakeGradeWorker();
      const promise = requestGrade(worker, input, 5, 5000);

      let settled = false;
      promise.then(() => {
        settled = true;
      });

      await vi.advanceTimersByTimeAsync(4999);
      expect(settled).toBe(false); // not yet - still within the timeout window

      await vi.advanceTimersByTimeAsync(1);
      const result = await promise;
      expect(result).toEqual({ ok: false, reason: 'timeout' });
    });

    it('a late reply after the timeout has already resolved does not change the result or throw', async () => {
      const { log } = loadRecordedPerformance('accurate-eight-measures.json');
      const input = buildGradeInput('eight-measure-melody.musicxml', BOTH, log);
      const expectedGrade = gradePerformance(input);

      const worker = new FakeGradeWorker();
      const promise = requestGrade(worker, input, 6, 1000);

      await vi.advanceTimersByTimeAsync(1000);
      const result = await promise;
      expect(result).toEqual({ ok: false, reason: 'timeout' });

      // Arriving late must not throw (no listener should still be attached to react to it).
      expect(() => worker.reply({ type: 'graded', requestId: 6, grade: expectedGrade })).not.toThrow();
    });
  });
});
