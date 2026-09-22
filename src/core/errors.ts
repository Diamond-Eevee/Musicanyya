/**
 * The message of a thrown value, whatever it turns out to be.
 *
 * `catch` binds `unknown`, not `Error`: a worker or a browser API can reject with a string, a
 * DOMException, or something with no `message` at all. Typing the binding `any` to reach `.message`
 * silently gives up type checking for the whole catch block, so the narrowing lives here instead
 * (tasks.md T139).
 */
export function errorMessage(err: unknown): string {
  // An Error with an empty message would otherwise produce '', which reads as a missing reason
  // rather than a failure; `String(err)` at least names the error class.
  if (err instanceof Error) return err.message || String(err);
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return String(err);
}

/** The `code` a `MusicXmlLoadError`-shaped rejection carries, or undefined for anything else. */
export function errorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return undefined;
}
