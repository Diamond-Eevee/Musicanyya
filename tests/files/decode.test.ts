import { describe, expect, it } from 'vitest';
import { decodeXml } from '../../src/engine/files/decode.js';

describe('decodeXml', () => {
  it('decodes UTF-8 without BOM', () => {
    const bytes = new TextEncoder().encode('<?xml version="1.0" encoding="UTF-8"?><score/>');
    expect(decodeXml(bytes)).toBe('<?xml version="1.0" encoding="UTF-8"?><score/>');
  });

  it('decodes UTF-8 with BOM', () => {
    const text = '<?xml version="1.0"?><score/>';
    const utf8 = new TextEncoder().encode(text);
    const bytes = new Uint8Array(3 + utf8.length);
    bytes.set([0xef, 0xbb, 0xbf], 0);
    bytes.set(utf8, 3);
    expect(decodeXml(bytes)).toBe(text);
  });

  it('decodes UTF-16LE with BOM', () => {
    const text = '<?xml version="1.0"?><score/>';
    const bytes = new Uint8Array(2 + text.length * 2);
    bytes[0] = 0xff;
    bytes[1] = 0xfe;
    for (let i = 0; i < text.length; i++) {
      bytes[2 + i * 2] = text.charCodeAt(i) & 0xff;
      bytes[2 + i * 2 + 1] = (text.charCodeAt(i) >> 8) & 0xff;
    }
    expect(decodeXml(bytes)).toBe(text);
  });

  it('decodes UTF-16BE with BOM', () => {
    const text = '<?xml version="1.0"?><score/>';
    const bytes = new Uint8Array(2 + text.length * 2);
    bytes[0] = 0xfe;
    bytes[1] = 0xff;
    for (let i = 0; i < text.length; i++) {
      bytes[2 + i * 2] = (text.charCodeAt(i) >> 8) & 0xff;
      bytes[2 + i * 2 + 1] = text.charCodeAt(i) & 0xff;
    }
    expect(decodeXml(bytes)).toBe(text);
  });

  it('decodes declared ISO-8859-1', () => {
    const bytes = new Uint8Array([
      ...new TextEncoder().encode('<?xml version="1.0" encoding="ISO-8859-1"?><t>'),
      0xc4, // Ä in ISO-8859-1
      ...new TextEncoder().encode('</t>'),
    ]);
    expect(decodeXml(bytes)).toContain('Ä');
  });

  it('decodes declared windows-1252', () => {
    const bytes = new Uint8Array([
      ...new TextEncoder().encode('<?xml version="1.0" encoding="windows-1252"?><t>'),
      0x80, // € in windows-1252
      ...new TextEncoder().encode('</t>'),
    ]);
    expect(decodeXml(bytes)).toContain('€');
  });

  it('throws on invalid bytes in UTF-8', () => {
    const bytes = new Uint8Array([0xff, 0xff, 0xff]);
    expect(() => decodeXml(bytes)).toThrow('Invalid bytes'); // exact error format to be defined
  });

  it('throws on unsupported encoding', () => {
    const bytes = new TextEncoder().encode('<?xml version="1.0" encoding="EBCDIC"?><t></t>');
    expect(() => decodeXml(bytes)).toThrow('Unsupported encoding: EBCDIC');
  });
});
