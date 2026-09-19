export function decodeXml(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return decodeWith(bytes, 'utf-16le');
  }
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return decodeWith(bytes, 'utf-16be');
  }

  const prefixBytes = bytes.subarray(0, Math.min(bytes.length, 256));
  const prefix = new TextDecoder('utf-8').decode(prefixBytes);
  
  let encoding = 'utf-8';
  const match = prefix.match(/<\?xml\s+.*encoding=['"]([^'"]+)['"]/i);
  if (match) {
    encoding = match[1];
  }

  return decodeWith(bytes, encoding);
}

function decodeWith(bytes: Uint8Array, encoding: string): string {
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(encoding, { fatal: true });
  } catch (e: any) {
    throw new Error(`Unsupported encoding: ${encoding}`);
  }

  try {
    const text = decoder.decode(bytes);
    // Remove BOM if TextDecoder didn't strip it (e.g., when not using default encoding or manual slice)
    if (text.charCodeAt(0) === 0xFEFF) {
      return text.slice(1);
    }
    return text;
  } catch (e) {
    throw new Error('Invalid bytes');
  }
}
