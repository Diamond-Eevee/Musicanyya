/** Anything outside the supported LilyPond subset (contract fidelity-tools.md §3.1): it names where and what. */
export class LyUnsupportedError extends Error {
  constructor(
    public readonly line: number,
    public readonly column: number,
    public readonly construct: string,
  ) {
    super(`LilyPond ${line}:${column}: ${construct}`);
    this.name = 'LyUnsupportedError';
  }
}
