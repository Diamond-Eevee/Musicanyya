import { describe, expect, it } from 'vitest';
import { walkScore } from '../../../../src/core/musicxml/engraving/walk.js';
import { readXml } from '../../../../src/core/musicxml/read.js';

function walk(xml: string) {
  const { doc } = readXml(xml);
  return walkScore(doc);
}

function wrap(measures: string, partAttrs = ''): string {
  return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1"${partAttrs}>${measures}</part></score-partwise>`;
}

describe('walkScore: onsets across backup/forward and a divisions change (B1)', () => {
  it('normalizes duration to one common tick unit regardless of the measure divisions value', () => {
    const xml = wrap(`
      <measure number="1">
        <attributes><divisions>4</divisions></attributes>
        <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note>
        <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note>
        <backup><duration>8</duration></backup>
        <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><voice>2</voice></note>
        <forward><duration>4</duration></forward>
        <note><pitch><step>F</step><octave>4</octave></pitch><duration>2</duration><voice>2</voice></note>
      </measure>
      <measure number="2">
        <attributes><divisions>8</divisions></attributes>
        <note><pitch><step>G</step><octave>4</octave></pitch><duration>8</duration><voice>1</voice></note>
      </measure>
    `);
    const result = walk(xml);
    expect(result.parts).toHaveLength(1);
    const events = result.parts[0]!.events;
    const [c, d, e, f, g] = events;

    expect(c).toMatchObject({ onset: 0, duration: result.ppq, voice: '1', measureIndex: 0 });
    expect(d).toMatchObject({ onset: result.ppq, duration: result.ppq, voice: '1', measureIndex: 0 });
    expect(e).toMatchObject({ onset: 0, duration: result.ppq / 2, voice: '2', measureIndex: 0 });
    // E4 (onset 0, duration ppq/2) then <forward> of a quarter (ppq): F4 starts at ppq/2 + ppq.
    expect(f).toMatchObject({
      onset: result.ppq / 2 + result.ppq,
      duration: result.ppq / 2,
      voice: '2',
      measureIndex: 0,
    });
    // Measure 2's divisions is 8, not 4, but the same written quarter note produces the same tick duration.
    expect(g).toMatchObject({ onset: 0, duration: result.ppq, voice: '1', measureIndex: 1 });
  });
});

describe('walkScore: per-staff keys and mid-bar key change (R-3 A1, A2)', () => {
  it('captures the key in force per staff at measure start, and records a later change separately', () => {
    const xml = wrap(`
      <measure number="1">
        <attributes>
          <divisions>4</divisions>
          <key number="1"><fifths>2</fifths></key>
          <key number="2"><fifths>-3</fifths></key>
        </attributes>
        <note><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration><voice>1</voice><staff>1</staff></note>
        <attributes><key number="1"><fifths>0</fifths></key></attributes>
        <note><pitch><step>D</step><octave>5</octave></pitch><duration>4</duration><voice>1</voice><staff>1</staff></note>
      </measure>
    `);
    const result = walk(xml);
    const measure = result.parts[0]!.measures[0]!;
    expect(measure.keyByStaff.get(1)).toBe(2);
    expect(measure.keyByStaff.get(2)).toBe(-3);
    expect(measure.midBarChanges).toHaveLength(1);
    const change = measure.midBarChanges[0]!;
    expect(change.onset).toBe(result.ppq);
    expect(change.keyByStaff?.get(1)).toBe(0);
    expect(change.keyByStaff?.get(2)).toBe(-3); // untouched staff carries over
  });

  it('a <key> without @number applies to all staves and resets any per-staff overrides', () => {
    const xml = wrap(`
      <measure number="1">
        <attributes>
          <divisions>4</divisions>
          <key number="1"><fifths>2</fifths></key>
          <key><fifths>-1</fifths></key>
        </attributes>
        <note><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration><voice>1</voice></note>
      </measure>
    `);
    const result = walk(xml);
    const measure = result.parts[0]!.measures[0]!;
    expect(measure.keyByStaff.get(0)).toBe(-1);
    expect(measure.keyByStaff.has(1)).toBe(false);
  });
});

describe('walkScore: mid-bar time change', () => {
  it('records a later <time> change with its onset, distinct from the measure-start time', () => {
    const xml = wrap(`
      <measure number="1">
        <attributes><divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
        <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note>
        <attributes><time><beats>3</beats><beat-type>8</beat-type></time></attributes>
        <note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
      </measure>
    `);
    const result = walk(xml);
    const measure = result.parts[0]!.measures[0]!;
    expect(measure.time).toEqual({ beats: [4], beatType: 4 });
    expect(measure.midBarChanges).toHaveLength(1);
    expect(measure.midBarChanges[0]!.time).toEqual({ beats: [3], beatType: 8 });
    expect(measure.midBarChanges[0]!.onset).toBe(result.ppq);
  });

  it('parses additive beats (3+2) into an array of numbers', () => {
    const xml = wrap(`
      <measure number="1">
        <attributes><divisions>4</divisions><time><beats>3+2</beats><beat-type>8</beat-type></time></attributes>
        <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note>
      </measure>
    `);
    const result = walk(xml);
    expect(result.parts[0]!.measures[0]!.time).toEqual({ beats: [3, 2], beatType: 8 });
  });
});

describe('walkScore: chords folded into the head event', () => {
  it('folds chord members into the head note event, keeping the head duration and one pitch per member', () => {
    const xml = wrap(`
      <measure number="1">
        <attributes><divisions>4</divisions></attributes>
        <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note>
        <note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note>
        <note><chord/><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note>
        <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note>
      </measure>
    `);
    const result = walk(xml);
    const events = result.parts[0]!.events;
    expect(events).toHaveLength(2);
    const chordEvent = events[0]!;
    expect(chordEvent.chord).toBe(true);
    expect(chordEvent.duration).toBe(result.ppq);
    expect(chordEvent.pitches.map((p) => p.step)).toEqual(['C', 'E', 'G']);
    expect(chordEvent.insertAt.accidental).toHaveLength(3);
    // Each chord member keeps its own <note> element for its accidental insert.
    const offsets = new Set(chordEvent.insertAt.accidental);
    expect(offsets.size).toBe(3);

    expect(events[1]!.onset).toBe(result.ppq); // the next event starts after the chord, not after each member
  });
});

describe('walkScore: grace, tuplet and tie flags', () => {
  it('marks a grace note with zero duration and does not advance the cursor', () => {
    const xml = wrap(`
      <measure number="1">
        <attributes><divisions>4</divisions></attributes>
        <note><grace/><pitch><step>D</step><octave>4</octave></pitch><voice>1</voice></note>
        <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note>
      </measure>
    `);
    const result = walk(xml);
    const [grace, main] = result.parts[0]!.events;
    expect(grace).toMatchObject({ grace: true, duration: 0, onset: 0 });
    expect(main).toMatchObject({ grace: false, onset: 0 }); // the grace note did not push the cursor forward
  });

  it('reads a triplet from <time-modification>', () => {
    const xml = wrap(`
      <measure number="1">
        <attributes><divisions>6</divisions></attributes>
        <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice>
          <type>eighth</type><time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>
          <notations><tuplet type="start"/></notations></note>
      </measure>
    `);
    const result = walk(xml);
    expect(result.parts[0]!.events[0]!.tuplet).toEqual({ actual: 3, normal: 2 });
  });

  it('flags a tie stop on the written pitch', () => {
    const xml = wrap(`
      <measure number="1">
        <attributes><divisions>4</divisions></attributes>
        <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><tie type="start"/></note>
      </measure>
      <measure number="2">
        <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><tie type="stop"/></note>
      </measure>
    `);
    const result = walk(xml);
    const events = result.parts[0]!.events;
    expect(events[0]!.pitches[0]!.tieStop).toBe(false);
    expect(events[1]!.pitches[0]!.tieStop).toBe(true);
  });
});

describe('walkScore: pickup measures are exposed as implicit with their true short length', () => {
  it('records implicit=true and the actual (short) notated length; beat-grouping does the end-alignment', () => {
    const xml = wrap(`
      <measure number="0" implicit="yes">
        <attributes><divisions>4</divisions><time><beats>3</beats><beat-type>4</beat-type></time></attributes>
        <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note>
      </measure>
      <measure number="1">
        <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note>
        <note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note>
        <note><pitch><step>F</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note>
      </measure>
    `);
    const result = walk(xml);
    const [pickup, full] = result.parts[0]!.measures;
    expect(pickup).toMatchObject({ implicit: true, lengthDivisions: result.ppq });
    expect(full).toMatchObject({ implicit: false, lengthDivisions: result.ppq * 3 });
  });
});

describe('walkScore: R-8 insert offsets', () => {
  it('places the accidental offset after the last of <type>/<dot>, and before the first of the later group otherwise', () => {
    const xmlWithType = wrap(`
      <measure number="1">
        <attributes><divisions>4</divisions></attributes>
        <note><pitch><step>C</step><octave>4</octave><alter>1</alter></pitch><duration>4</duration><voice>1</voice><type>quarter</type><dot/><staff>1</staff></note>
      </measure>
    `);
    const r1 = walk(xmlWithType);
    const event1 = r1.parts[0]!.events[0]!;
    const noteXml1 = xmlWithType.slice(event1.noteRef.start, event1.noteRef.end);
    const dotEnd = xmlWithType.indexOf('<dot/>') + '<dot/>'.length;
    expect(event1.insertAt.accidental[0]).toBe(dotEnd);
    expect(noteXml1).toContain('<dot/>'); // sanity: our offset really is inside this note

    const xmlNoTypeDot = wrap(`
      <measure number="1">
        <attributes><divisions>4</divisions></attributes>
        <note><pitch><step>C</step><octave>4</octave><alter>1</alter></pitch><duration>4</duration><voice>1</voice><staff>1</staff><notations><articulations/></notations></note>
      </measure>
    `);
    const r2 = walk(xmlNoTypeDot);
    const event2 = r2.parts[0]!.events[0]!;
    const staffStart = xmlNoTypeDot.indexOf('<staff>');
    expect(event2.insertAt.accidental[0]).toBe(staffStart); // before <staff>, the first of the "before" group present
  });

  it('places the beam offset before the first of <notations>/<lyric>/<play>/<listen>, else at the end of the note', () => {
    const xmlWithNotations = wrap(`
      <measure number="1">
        <attributes><divisions>4</divisions></attributes>
        <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type><notations><articulations/></notations></note>
      </measure>
    `);
    const r1 = walk(xmlWithNotations);
    const notationsStart = xmlWithNotations.indexOf('<notations>');
    expect(r1.parts[0]!.events[0]!.insertAt.beam).toBe(notationsStart);

    const xmlPlain = wrap(`
      <measure number="1">
        <attributes><divisions>4</divisions></attributes>
        <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type></note>
      </measure>
    `);
    const r2 = walk(xmlPlain);
    const event = r2.parts[0]!.events[0]!;
    const typeEnd = xmlPlain.indexOf('<type>eighth</type>') + '<type>eighth</type>'.length;
    expect(event.insertAt.beam).toBe(typeEnd); // right after the last child, equivalent to "before </note>"
  });
});
