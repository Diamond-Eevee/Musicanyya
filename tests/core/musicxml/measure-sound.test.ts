import { describe, expect, it } from 'vitest';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import { compileSchedule } from '../../../src/core/schedule/compile.js';
import { buildTimeline } from '../../../src/core/timeline/timeline.js';

/**
 * 017 T048: a `<sound>` may stand directly in a `<measure>` (MusicXML music-data), not only inside a `<direction>`.
 * T044 read its `tempo`; its jump attributes (dacapo, segno, dalsegno, coda, tocoda, fine, time-only) and `dynamics`
 * were silently ignored, where the same attributes inside a `<direction>` are played. They are read the same way: each
 * test builds a document once with the `<sound>` in the measure and once wrapped in a `<direction>`, and expects the
 * same navigation marks, the same sound dynamics and the same played schedule.
 */

const note = (step: string) =>
  `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>`;
const bar = (step: string) => `${note(step)}${note(step)}${note(step)}${note(step)}`;

/** Measures given as bodies; `{S:...}` marks where a `<sound ...>` goes, written in the measure or in a direction. */
function doc(measures: string[], form: 'measure' | 'direction' | 'none') {
  const body = measures
    .map((m, i) => {
      const withSound = m.replace(/\{S:([^}]*)\}/g, (_all, attrs: string) =>
        form === 'measure'
          ? `<sound ${attrs}/>`
          : form === 'direction'
            ? `<direction><direction-type><words>x</words></direction-type><sound ${attrs}/></direction>`
            : '',
      );
      const attributes =
        i === 0
          ? '<attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>'
          : '';
      return `<measure number="${i + 1}">${attributes}${withSound}</measure>`;
    })
    .join('');
  const xml = `<?xml version="1.0"?><score-partwise><part-list><score-part id="P1"><part-name>P</part-name></score-part></part-list><part id="P1">${body}</part></score-partwise>`;
  return buildScore(readXml(xml).doc).score;
}

function played(score: ReturnType<typeof doc>) {
  const s = compileSchedule(buildTimeline(score).timeline);
  return {
    tick: Array.from(s.eventTick),
    kind: Array.from(s.eventKind),
    data1: Array.from(s.eventData1),
    data2: Array.from(s.eventData2),
  };
}

describe('a <sound> directly in <measure> plays like the one in a <direction> (017 T048)', () => {
  it('dacapo and fine: the same jump and target, the same played order (m1 m2 m1)', () => {
    const measures = [`${bar('C')}{S:fine="yes"}`, `${bar('D')}{S:dacapo="yes"}`];
    const inMeasure = doc(measures, 'measure');
    const inDirection = doc(measures, 'direction');
    expect(inMeasure.navigation.jumps).toEqual([{ measureIndex: 1, type: 'da-capo' }]);
    expect(inMeasure.navigation.targets).toEqual([{ measureIndex: 0, type: 'fine' }]);
    expect(inMeasure.navigation).toEqual(inDirection.navigation);
    const p = played(inMeasure);
    expect(p).toEqual(played(inDirection));
    // Without the sounds the piece is two bars long; with them the first bar is played again.
    expect(p.tick.length).toBeGreaterThan(played(doc(measures, 'none')).tick.length);
  });

  it('segno, dalsegno, tocoda, coda with time-only: the same named marks and the same played order', () => {
    const measures = [
      bar('C'),
      `{S:segno="s1"}${bar('D')}{S:tocoda="c1" time-only="2"}`,
      `${bar('E')}{S:dalsegno="s1"}`,
      `{S:coda="c1"}${bar('F')}`,
    ];
    const inMeasure = doc(measures, 'measure');
    const inDirection = doc(measures, 'direction');
    expect(inMeasure.navigation.jumps).toEqual([
      { measureIndex: 1, type: 'to-coda', name: 'c1', timeOnly: [2] },
      { measureIndex: 2, type: 'dal-segno', name: 's1' },
    ]);
    expect(inMeasure.navigation.targets).toEqual([
      { measureIndex: 1, type: 'segno', name: 's1' },
      { measureIndex: 3, type: 'coda', name: 'c1' },
    ]);
    expect(inMeasure.navigation).toEqual(inDirection.navigation);
    expect(played(inMeasure)).toEqual(played(inDirection));
  });

  it('dynamics="40": the same sound dynamic at the same position, the same velocities', () => {
    const measures = [`${note('C')}${note('C')}{S:dynamics="40"}${note('C')}${note('C')}`];
    const inMeasure = doc(measures, 'measure');
    const inDirection = doc(measures, 'direction');
    const ppq = inMeasure.ppq;
    expect(inMeasure.parts[0]?.soundDynamics).toEqual([{ measureIndex: 0, onsetInMeasure: 2 * ppq, percent: 40 }]);
    expect(inMeasure.parts[0]?.soundDynamics).toEqual(inDirection.parts[0]?.soundDynamics);
    const p = played(inMeasure);
    expect(p).toEqual(played(inDirection));
    // The dynamic changes what is played: the velocities differ from the same bar without it.
    expect(p.data2).not.toEqual(played(doc(measures, 'none')).data2);
  });
});
