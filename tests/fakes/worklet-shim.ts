export class WorkletShim {
  public port = {
    postMessage: (msg: any) => {},
    onmessage: null as ((msg: any) => void) | null,
  };
}
