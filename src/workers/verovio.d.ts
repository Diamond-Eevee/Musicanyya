declare module 'verovio' {
  interface VerovioToolkit {
    getVersion(): string;
    setOptions(options: Record<string, unknown>): void;
    loadData(data: string): boolean;
    redoLayout(options?: Record<string, unknown>): void;
    getPageCount(): number;
    renderToSVG(page: number, options?: Record<string, unknown>): string;
    getPageWithElement(elementId: string): number;
  }

  interface VerovioModule {
    onRuntimeInitialized?: () => void;
    _vrvToolkit_constructor?: unknown;
  }

  const verovio: {
    module: VerovioModule;
    toolkit: new () => VerovioToolkit;
  };
  export default verovio;
}
