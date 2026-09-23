import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { applyInserts, planEngraving } from '../../src/core/musicxml/engraving/plan.js';
import { readXml } from '../../src/core/musicxml/read.js';
import { handleMessage } from '../../src/workers/verovio.worker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, '../fixtures/musicxml/engraving');

let requestCounter = 0;

async function initVerovio(): Promise<void> {
  let isReady = false;
  await handleMessage({ data: { type: 'init', requestId: ++requestCounter } }, (msg) => {
    if (msg.type === 'ready') isReady = true;
    else if (msg.type === 'error') throw new Error(`Verovio error: ${msg.message}`);
  });
  expect(isReady).toBe(true);
}

async function renderSvg(renderXml: string): Promise<string> {
  let laidOut = false;
  let pageCount = 0;
  await handleMessage(
    {
      data: {
        type: 'load',
        requestId: ++requestCounter,
        renderXml,
        options: { pageWidth: 2000, pageHeight: 2000, scale: 100 },
      },
    },
    (msg) => {
      if (msg.type === 'laidOut') {
        laidOut = true;
        pageCount = msg.pageCount;
      } else if (msg.type === 'error') {
        throw new Error(msg.message);
      }
    },
  );
  expect(laidOut).toBe(true);

  let fullSvg = '';
  for (let i = 1; i <= pageCount; i++) {
    await handleMessage({ data: { type: 'page', requestId: ++requestCounter, page: i } }, (msg) => {
      if (msg.type === 'svg') fullSvg += msg.svg;
    });
  }
  return fullSvg;
}

/** Completes `xml` (library mode) and hands the result straight to Verovio - no id inserts needed,
 *  since these checks only look at `g.beam`/`g.flag`/`g.gracegrp` structure, not specific element ids. */
async function renderCompleted(xml: string): Promise<string> {
  const { doc } = readXml(xml);
  const plan = planEngraving(doc, 'library');
  const completed = applyInserts(xml, plan.inserts);
  return renderSvg(completed);
}

describe('Verovio renders completed beams (contract guarantee 4)', () => {
  it('Für Elise (theme) bare: beams render on the completed file', async () => {
    await initVerovio();
    const xml = fs.readFileSync(path.join(fixturesDir, 'fur-elise-bare.musicxml'), 'utf8');
    const svg = await renderCompleted(xml);

    // R-1 (verified before this feature): the same file with no <beam> renders 0 g.beam, 52 g.flag.
    expect(svg).toContain('class="beam"');
  }, 20000);

  it('a bar with no lone notes (every note completes into a beam group) renders no flag at all', async () => {
    await initVerovio();
    // 2/4, four plain eighths: B3 groups them 2+2, so every note is inside a beam group - none is
    // ever a lone, flagged note (contract guarantee 4: "no <note> ... keeps a g.flag where a beam
    // group applies").
    const xml = `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>4</divisions><time><beats>2</beats><beat-type>4</beat-type></time></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type></note><note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type></note><note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type></note><note><pitch><step>F</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type></note></measure></part></score-partwise>`;
    const svg = await renderCompleted(xml);

    expect(svg).toContain('class="beam"');
    expect(svg).not.toContain('class="flag"');
  }, 20000);

  it('a plain, unbeamed eighth still renders as a flagged note (sanity: flags are not suppressed globally)', async () => {
    await initVerovio();
    // A single lone eighth is never beam-eligible (B6): completion adds nothing, Verovio must still flag it.
    const xml = `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type></note><note><pitch><step>D</step><octave>4</octave></pitch><duration>6</duration><voice>1</voice><type>quarter</type><dot/></note><note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note><note><pitch><step>F</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type></note></measure></part></score-partwise>`;
    const svg = await renderCompleted(xml);
    expect(svg).toContain('class="flag"');
  }, 20000);
});

describe('Verovio renders a grace note between beamed main notes (research B8 check)', () => {
  it('a two-note main beam either side of a lone interrupting grace note still shows a continuous beam (or logs the opposite)', async () => {
    await initVerovio();
    // Beat 1 in 2/4: C4-D4 (plain eighths, beamable pair) with a grace note E5 encoded between them
    // in document order but NOT itself part of the pair's timing (a grace note has no <duration>, so
    // it does not split C4/D4's onsets apart) - beat 2: a filler quarter F4.
    const xml = `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>4</divisions><time><beats>2</beats><beat-type>4</beat-type></time></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type></note><note><grace/><pitch><step>E</step><octave>5</octave></pitch><voice>1</voice><type>16th</type></note><note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type></note><note><pitch><step>F</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note></measure></part></score-partwise>`;
    const svg = await renderCompleted(xml);

    // B8 (our design decision, research.md): a lone grace note between two main notes does not
    // break the surrounding main beam group - C4/D4 still form one 2-note beam, and the grace note
    // itself, alone, keeps its own flag (a lone grace keeps its flag, per B8's other clause).
    const beamCount = (svg.match(/class="beam"/g) ?? []).length;
    expect(beamCount).toBeGreaterThanOrEqual(1);
  }, 20000);
});
