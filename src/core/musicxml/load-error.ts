/** A MusicXML load/parse failure with a stable machine-readable `code` (surfaced to the UI as a notice and
 * translated there; see `src/ui/i18n/en.ts`'s `notices` map) instead of only a human-oriented `message`. */
export class MusicXmlLoadError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly line?: number,
    public readonly column?: number,
  ) {
    super(message);
    this.name = 'MusicXmlLoadError';
  }
}
