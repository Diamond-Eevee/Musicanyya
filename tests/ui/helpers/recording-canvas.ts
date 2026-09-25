/** A canvas 2D context that records every call together with the style in force at that moment (as the Proxy in
 *  tests/ui/pressed-keys.test.ts does), shared by the score-view tests of feature 009. */
export interface CanvasCall {
  name: string;
  args: unknown[];
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: unknown;
}

export interface RecordingCanvas {
  ctx: CanvasRenderingContext2D;
  calls: CanvasCall[];
  named(name: string): CanvasCall[];
  reset(): void;
}

export function recordingCanvas(): RecordingCanvas {
  const calls: CanvasCall[] = [];
  const state: Record<string, unknown> = { fillStyle: '#000', strokeStyle: '#000', lineWidth: 1 };
  const ctx = new Proxy(
    {},
    {
      get: (_target, name) => {
        if (typeof name === 'symbol') return undefined;
        if (name in state) return state[name];
        return (...args: unknown[]) => {
          calls.push({
            name,
            args,
            fillStyle: state.fillStyle,
            strokeStyle: state.strokeStyle,
            lineWidth: state.lineWidth,
          });
        };
      },
      set: (_target, name, value) => {
        state[String(name)] = value;
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return {
    ctx,
    calls,
    named: (name) => calls.filter((call) => call.name === name),
    reset: () => {
      calls.length = 0;
    },
  };
}
