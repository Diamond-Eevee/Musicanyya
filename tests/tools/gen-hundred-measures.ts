import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Named large-score-* so the core golden snapshot test (tests/core/musicxml/build.test.ts) skips it, as it does
// large-score.musicxml. A 100-measure, two-staff piano score that plays in about 15 seconds: one quarter note per measure at 400 quarter
// notes a minute. Feature 004 (SC-005) needs a full Listen run of 100 measures that a test can sit through, and the
// cursor has to cross many systems of the fitted Score to prove no overlay ever covers it.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const N_MEASURES = 100;
const TEMPO_QPM = 400;
const outPath = path.join(__dirname, '..', 'fixtures', 'musicxml', 'large-score-100-measures-fast.musicxml');

const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
let measures = '';
for (let i = 1; i <= N_MEASURES; i++) {
  const step = notes[(i - 1) % notes.length];
  measures += `
  <measure number="${i}">
    ${
      i === 1
        ? `<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>1</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>
    <direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${TEMPO_QPM}</per-minute></metronome></direction-type><sound tempo="${TEMPO_QPM}"/></direction>`
        : ''
    }
    <note><pitch><step>${step}</step><octave>5</octave></pitch><duration>1</duration><voice>1</voice><type>quarter</type><staff>1</staff></note>
    <backup><duration>1</duration></backup>
    <note><pitch><step>${step}</step><octave>3</octave></pitch><duration>1</duration><voice>2</voice><type>quarter</type><staff>2</staff></note>
  </measure>`;
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    ${measures}
  </part>
</score-partwise>
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, xml, 'utf8');
console.log(`Generated ${N_MEASURES} measures at ${outPath}`);
