export interface LayoutOptions {
  pageWidth: number;
  pageHeight: number;
  scale: number; // 50..200
}

export interface VerovioClient {
  init(): Promise<{ version: string }>;
  load(renderXml: string, options: LayoutOptions): Promise<{ pageCount: number }>;
  relayout(options: LayoutOptions): Promise<{ pageCount: number }>;
  page(page: number): Promise<{ svg: string }>;
  pageOf(elementId: string): Promise<{ page: number }>;
}

export interface WorkerLike {
  postMessage(message: unknown): void;
  onmessage: ((event: MessageEvent) => void) | null;
}

/** Wraps the request/response protocol in contracts/worker-messages.md as promises, per requestId. */
export function createVerovioClient(worker: WorkerLike): VerovioClient {
  let nextRequestId = 1;
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();

  worker.onmessage = (event: MessageEvent) => {
    const data = event.data;
    const entry = pending.get(data.requestId);
    if (!entry) return; // stale response ignored
    pending.delete(data.requestId);
    if (data.type === 'error') entry.reject(new Error(data.message));
    else entry.resolve(data);
  };

  function call<T>(message: Record<string, unknown>): Promise<T> {
    const requestId = nextRequestId++;
    return new Promise<T>((resolve, reject) => {
      pending.set(requestId, { resolve: resolve as (value: unknown) => void, reject });
      worker.postMessage({ ...message, requestId });
    });
  }

  return {
    init: () => call({ type: 'init' }),
    load: (renderXml, options) => call({ type: 'load', renderXml, options }),
    relayout: (options) => call({ type: 'relayout', options }),
    page: (page) => call({ type: 'page', page }),
    pageOf: (elementId) => call({ type: 'pageOf', elementId }),
  };
}
