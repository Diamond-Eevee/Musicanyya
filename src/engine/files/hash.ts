export async function hashFile(bytes: Uint8Array): Promise<string> {
  // .slice() guarantees a plain ArrayBuffer-backed view, as SubtleCrypto requires (never a SharedArrayBuffer view).
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes.slice());
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
