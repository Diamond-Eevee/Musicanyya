import verovio, { type VerovioToolkit } from 'verovio';
import { errorMessage } from '../core/errors.js';

let toolkit: VerovioToolkit | null = null;
let initPromise: Promise<VerovioToolkit> | null = null;

/**
 * The toolkit, constructing it on the first call and sharing one in-flight construction between
 * concurrent callers. Resolving the promise *with* the toolkit rather than assigning a
 * module-level `null`-able from inside the executor is what lets this be typed at all - the
 * previous `let toolkit: any` hid a real "possibly null" hazard (tasks.md T139).
 */
async function ensureToolkit(): Promise<VerovioToolkit> {
  if (toolkit) return toolkit;
  if (!initPromise) {
    initPromise = new Promise<VerovioToolkit>((resolve) => {
      if (verovio.module._vrvToolkit_constructor) {
        resolve(new verovio.toolkit());
      } else {
        verovio.module.onRuntimeInitialized = () => resolve(new verovio.toolkit());
      }
    });
  }
  toolkit = await initPromise;
  return toolkit;
}

export async function handleMessage(event: MessageEvent, postMessageFn: typeof postMessage) {
  const data = event.data;

  try {
    switch (data.type) {
      case 'init': {
        const ready = await ensureToolkit();
        postMessageFn({ type: 'ready', requestId: data.requestId, version: ready.getVersion() });
        break;
      }
      case 'load': {
        if (!toolkit) throw new Error('Verovio not initialized');
        toolkit.setOptions({
          breaks: 'auto',
          // 0: the page height is dictated by the requested layout (one screenful), not derived from the content
          // (contracts/score-layout.md section 2, rule 4, measured by tests/verovio/page-units.test.ts). Verovio
          // boolean options are 1/0.
          adjustPageHeight: 0,
          header: 'encoded',
          footer: 'none',
          font: 'Leipzig',
          svgViewBox: 1,
          svgHtml5: 0,
          pageWidth: data.options.pageWidth,
          pageHeight: data.options.pageHeight,
          scale: data.options.scale,
        });
        toolkit.loadData(data.renderXml);
        postMessageFn({ type: 'laidOut', requestId: data.requestId, pageCount: toolkit.getPageCount() });
        break;
      }
      case 'relayout': {
        if (!toolkit) throw new Error('Verovio not initialized');
        toolkit.setOptions({
          breaks: 'auto',
          adjustPageHeight: 0,
          header: 'encoded',
          footer: 'none',
          font: 'Leipzig',
          svgViewBox: 1,
          svgHtml5: 0,
          pageWidth: data.options.pageWidth,
          pageHeight: data.options.pageHeight,
          scale: data.options.scale,
        });
        toolkit.redoLayout();
        postMessageFn({ type: 'laidOut', requestId: data.requestId, pageCount: toolkit.getPageCount() });
        break;
      }
      case 'page': {
        if (!toolkit) throw new Error('Verovio not initialized');
        const svg = toolkit.renderToSVG(data.page);
        postMessageFn({ type: 'svg', requestId: data.requestId, page: data.page, svg });
        break;
      }
      case 'pageOf': {
        if (!toolkit) throw new Error('Verovio not initialized');
        const page = toolkit.getPageWithElement(data.elementId);
        postMessageFn({ type: 'pageIs', requestId: data.requestId, page });
        break;
      }
    }
  } catch (err) {
    postMessageFn({ type: 'error', requestId: data.requestId, message: errorMessage(err) });
  }
}

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('message', (event) => {
    handleMessage(event, self.postMessage.bind(self));
  });
}
