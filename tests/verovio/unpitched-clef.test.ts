import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import verovio from 'verovio';
import { describe, expect, it } from 'vitest';
import { handleMessage } from '../../src/workers/score.worker.js';

/**
 * 017 T045 - pins a Verovio 6.3.0 limitation recorded in docs/musicxml-support.md (`<unpitched>`, Partial): it turns an
 * unpitched note's display-step/-octave into a staff position as if the clef were G2, whatever the clef in force. The
 * W3C drum-kit example writes its kit on an F4 clef: the hi-hat's B3 belongs just above the top line (loc 9) and the
 * snare's E3 in the third space (loc 5), but Verovio places them at their treble positions, loc -3 and -7 (below the
 * staff). If the first test fails, Verovio changed: the render copy's workaround (017 T047, unpitched-placement.ts)
 * would then move the notes twice - remove it and set the `<unpitched>` support row to match.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(here, '../fixtures/musicxml/spec-examples/tutorial-percussion.musicxml');

function newToolkit(): Promise<InstanceType<typeof verovio.toolkit>> {
  return new Promise((resolve) => {
    if (verovio.module._vrvToolkit_constructor) {
      resolve(new verovio.toolkit());
    } else {
      verovio.module.onRuntimeInitialized = () => resolve(new verovio.toolkit());
    }
  });
}

describe('Verovio 6.3 places unpitched notes by a treble reading, whatever the clef (017 T045)', () => {
  it('the drum kit on an F4 clef: B3 at loc -3 and E3 at loc -7 (their G2-clef positions)', async () => {
    const tk = await newToolkit();
    tk.setOptions({ breaks: 'auto', header: 'none', footer: 'none' });
    tk.loadData(fs.readFileSync(file, 'utf8'));
    const mei = tk.getMEI();
    const staffDef = mei.match(/<staffDef[^>]*n="1"[\s\S]*?<\/staffDef>/)?.[0] ?? '';
    expect(staffDef).toMatch(/<clef[^>]*shape="F"[^>]*line="4"/);
    const drumStaff = mei.match(/<staff[^>]*n="1"[\s\S]*?<\/staff>/)?.[0] ?? '';
    const locs = [...drumStaff.matchAll(/<note\b[^>]*\bloc="(-?\d+)"/g)].map((m) => Number(m[1]));
    // measure 1 opens with the crash/hi-hat (B3) and has the snare (E3) on beat 2
    expect(locs[0]).toBe(-3);
    expect(locs).toContain(-7);
    expect(locs.every((loc) => loc < 0)).toBe(true); // all below the bottom line, none where the clef puts them
  });

  it("the app's render copy puts them where the F4 clef does: E3 in the third space (5), B3 above the top line (9) - 017 T047", async () => {
    const bytes = fs.readFileSync(file);
    const messages: Array<{ type: string; renderXml?: string }> = [];
    await handleMessage(
      {
        data: {
          type: 'load',
          requestId: 1,
          fileName: 'tutorial-percussion.musicxml',
          bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        },
      } as MessageEvent,
      ((msg: { type: string; renderXml?: string }) => messages.push(msg)) as typeof postMessage,
    );
    const renderXml = messages.find((m) => m.type === 'loaded')?.renderXml ?? '';
    const tk = await newToolkit();
    tk.setOptions({ breaks: 'auto', header: 'none', footer: 'none' });
    tk.loadData(renderXml);
    const drumStaff = tk.getMEI().match(/<staff[^>]*n="1"[\s\S]*?<\/staff>/)?.[0] ?? '';
    const locs = [...drumStaff.matchAll(/<note\b[^>]*\bloc="(-?\d+)"/g)].map((m) => Number(m[1]));
    expect(locs[0]).toBe(9); // the opening B3
    expect(locs).toContain(5); // the snare's E3
    expect(locs.every((loc) => loc >= -2)).toBe(true); // nothing hangs below the staff any more
  });
});
