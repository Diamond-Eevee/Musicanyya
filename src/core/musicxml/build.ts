import type { XmlDocument } from '@rgrove/parse-xml';
import { XmlElement, XmlText } from '@rgrove/parse-xml';
import {
  ACCENT_BOOST,
  BASE_PPQ,
  DEFAULT_TEMPO_QPM,
  DEFAULT_VELOCITY,
  DYNAMIC_VELOCITY,
  GRACE_MAX_STEAL_RATIO,
  INFER_JUMPS_FROM_TEXT,
  SFORZANDO_BOOST,
} from '../defaults.js';
import { applyTransposition, getMidiKey, getUnpitchedDisplayKey } from '../pitch.js';
import type { LoadNoticeCode, LoadReport, LoadReportEntry, Severity } from '../score/load-report.js';
import type {
  DynamicMark,
  EndingMark,
  Fingering,
  Instrument,
  Jump,
  JumpTarget,
  MeasureInfo,
  NavigationMarks,
  Note,
  Part,
  RepeatMark,
  Score,
  TempoMark,
  Transposition,
  Wedge,
} from '../score/model.js';
import { buildMeasureId, buildNoteId } from '../score/note-id.js';
import { computePPQ, reduceFraction } from '../ticks.js';

class ReportBuilder {
  entries: LoadReportEntry[] = [];
  skippedElementCount = 0;

  add(severity: Severity, code: LoadNoticeCode, measureLabel: string, element?: string, detail?: string) {
    const existing = this.entries.find(
      (e) => e.code === code && e.severity === severity && e.element === element && e.detail === detail,
    );
    if (existing) {
      if (!existing.measureLabels.includes(measureLabel)) {
        existing.measureLabels.push(measureLabel);
      }
    } else {
      this.entries.push({
        code,
        severity,
        measureLabels: [measureLabel],
        ...(element !== undefined ? { element } : {}),
        ...(detail !== undefined ? { detail } : {}),
      });
    }
  }

  getReport(): LoadReport {
    return { entries: this.entries, skippedElementCount: this.skippedElementCount };
  }
}

function getChild(el: XmlElement, name: string): XmlElement | undefined {
  return el.children.find((c): c is XmlElement => c instanceof XmlElement && c.name === name);
}
function getChildren(el: XmlElement, name: string): XmlElement[] {
  return el.children.filter((c): c is XmlElement => c instanceof XmlElement && c.name === name);
}
function getText(el: XmlElement | undefined): string {
  if (!el) return '';
  const txt = el.children.find((c): c is XmlText => c instanceof XmlText);
  return txt ? txt.text.trim() : '';
}
function getAttr(el: XmlElement, name: string): string | undefined {
  return el.attributes[name];
}

export function buildScore(doc: XmlDocument): { score: Score; report: LoadReport } {
  const report = new ReportBuilder();
  const root = doc.children.find((c): c is XmlElement => c instanceof XmlElement);
  if (!root || root.name !== 'score-partwise') {
    throw new Error('notMusicXml: Expected score-partwise');
  }

  const divisions: number[] = [];
  function gatherDivisions(el: XmlElement) {
    if (el.name === 'divisions') {
      const d = parseInt(getText(el), 10);
      if (!isNaN(d) && d > 0) divisions.push(d);
    }
    el.children.forEach((c) => {
      if (c instanceof XmlElement) gatherDivisions(c);
    });
  }
  gatherDivisions(root);

  let ppq = BASE_PPQ;
  try {
    if (divisions.length > 0) {
      ppq = computePPQ(divisions);
    }
  } catch (e) {
    report.add('warning', 'timingRounded', '0', undefined, 'PPQ exceeded MAX_PPQ');
  }

  const score: Score = {
    title: null,
    composer: null,
    ppq,
    parts: [],
    measures: [],
    tempoMarks: [],
    navigation: { repeats: [], endings: [], targets: [], jumps: [] },
    defaultTempoUsed: false,
  };

  const work = getChild(root, 'work');
  if (work) score.title = getText(getChild(work, 'work-title')) || null;
  const identification = getChild(root, 'identification');
  if (identification) {
    const creators = getChildren(identification, 'creator');
    const composer = creators.find((c) => getAttr(c, 'type') === 'composer');
    if (composer) score.composer = getText(composer);
  }

  const partList = getChild(root, 'part-list');
  const partInfos = new Map<string, { name: string; instruments: Instrument[] }>();
  if (partList) {
    for (const scorePart of getChildren(partList, 'score-part')) {
      const id = getAttr(scorePart, 'id') || '';
      const name = getText(getChild(scorePart, 'part-name'));
      const instruments: Instrument[] = [];
      const scoreInstruments = getChildren(scorePart, 'score-instrument');
      const midiInstruments = getChildren(scorePart, 'midi-instrument');

      if (scoreInstruments.length > 0) {
        for (const si of scoreInstruments) {
          const insId = getAttr(si, 'id') || '';
          const mi = midiInstruments.find((m) => getAttr(m, 'id') === insId) || midiInstruments[0];

          const programTxt = mi ? getText(getChild(mi, 'midi-program')) : '';
          const bankTxt = mi ? getText(getChild(mi, 'midi-bank')) : '';
          const channelTxt = mi ? getText(getChild(mi, 'midi-channel')) : '';
          const unpitchedTxt = mi ? getText(getChild(mi, 'midi-unpitched')) : '';
          const volumeTxt = mi ? getText(getChild(mi, 'volume')) : '';
          const panTxt = mi ? getText(getChild(mi, 'pan')) : '';

          let program = parseInt(programTxt, 10);
          let fallback = false;
          if (isNaN(program) || program < 1 || program > 128) {
            program = 1;
            fallback = true;
          }

          instruments.push({
            xmlId: insId,
            name: getText(getChild(si, 'instrument-name')),
            program: program - 1,
            bank: bankTxt ? parseInt(bankTxt, 10) : null,
            channelHint: channelTxt ? parseInt(channelTxt, 10) - 1 : null,
            percussion: (channelTxt ? parseInt(channelTxt, 10) : 0) === 10,
            unpitchedKey: unpitchedTxt ? parseInt(unpitchedTxt, 10) - 1 : null,
            volume: volumeTxt ? Math.round(127 * (parseFloat(volumeTxt) / 100)) : null,
            pan: panTxt ? Math.round(64 + (parseFloat(panTxt) / 90) * 63) : null,
            fallback,
          });
        }
      } else if (midiInstruments.length > 0 && midiInstruments[0] !== undefined) {
        const mi = midiInstruments[0];
        const insId = getAttr(mi, 'id') || '';
        const programTxt = getText(getChild(mi, 'midi-program'));
        let program = parseInt(programTxt, 10);
        let fallback = false;
        if (isNaN(program) || program < 1 || program > 128) {
          program = 1;
          fallback = true;
        }
        const channelTxt = getText(getChild(mi, 'midi-channel'));
        instruments.push({
          xmlId: insId,
          name: '',
          program: program - 1,
          bank: null,
          channelHint: channelTxt ? parseInt(channelTxt, 10) - 1 : null,
          percussion: (channelTxt ? parseInt(channelTxt, 10) : 0) === 10,
          unpitchedKey: null,
          volume: null,
          pan: null,
          fallback,
        });
      } else {
        instruments.push({
          xmlId: '',
          name: '',
          program: 0,
          bank: null,
          channelHint: null,
          percussion: false,
          unpitchedKey: null,
          volume: null,
          pan: null,
          fallback: true,
        });
      }
      partInfos.set(id, { name, instruments });
    }
  }

  const supportedElements = new Set([
    'work',
    'work-title',
    'identification',
    'creator',
    'part-list',
    'score-part',
    'part-name',
    'score-instrument',
    'instrument-name',
    'midi-instrument',
    'midi-channel',
    'midi-program',
    'midi-bank',
    'midi-unpitched',
    'volume',
    'pan',
    'part',
    'measure',
    'attributes',
    'divisions',
    'key',
    'time',
    'staves',
    'clef',
    'transpose',
    'chromatic',
    'diatonic',
    'octave-change',
    'double',
    'beats',
    'beat-type',
    'senza-misura',
    'note',
    'pitch',
    'unpitched',
    'rest',
    'step',
    'alter',
    'octave',
    'display-step',
    'display-octave',
    'duration',
    'tie',
    'tied',
    'chord',
    'voice',
    'staff',
    'type',
    'dot',
    'time-modification',
    'grace',
    'instrument',
    'notations',
    'technical',
    'fingering',
    'cue',
    'direction',
    'direction-type',
    'offset',
    'sound',
    'tempo',
    'metronome',
    'beat-unit',
    'beat-unit-dot',
    'per-minute',
    'words',
    'dynamics',
    'p',
    'pp',
    'ppp',
    'mp',
    'mf',
    'f',
    'ff',
    'fff',
    'sf',
    'sfz',
    'sffz',
    'fz',
    'rf',
    'rfz',
    'fp',
    'wedge',
    'crescendo',
    'diminuendo',
    'stop',
    'barline',
    'repeat',
    'ending',
    'coda',
    'segno',
    'backup',
    'forward',
    'print',
    'measure-repeat',
    'multiple-rest',
    'articulations',
    'accent',
    'staccato',
    'tenuto',
    'fermata',
  ]);

  const partNodes = getChildren(root, 'part');
  let partIndex = 0;
  let hasTempo = false;

  for (const partNode of partNodes) {
    const xmlId = getAttr(partNode, 'id') || '';
    const info = partInfos.get(xmlId) || {
      name: '',
      instruments: [
        {
          xmlId: '',
          name: '',
          program: 0,
          bank: null,
          channelHint: null,
          percussion: false,
          unpitchedKey: null,
          volume: null,
          pan: null,
          fallback: true,
        },
      ],
    };

    const part: Part = {
      index: partIndex,
      xmlId,
      name: info.name,
      staves: 1,
      instruments: info.instruments,
      notes: [],
      dynamics: [],
      wedges: [],
      transpositions: [],
    };

    let currentDivisions = 1;
    let cursor = 0;
    let currentMeasureIndex = -1;
    let currentStaves = 1;
    const firstPart = partIndex === 0;

    const measureNodes = getChildren(partNode, 'measure');
    for (let mi = 0; mi < measureNodes.length; mi++) {
      const measureNode = measureNodes[mi];
      currentMeasureIndex++;
      if (!measureNode) continue;
      const measureLabel = getAttr(measureNode, 'number') || `${currentMeasureIndex}`;

      let measureStartCursor = cursor;
      let measureMaxCursor = cursor;

      if (firstPart) {
        const implicit = getAttr(measureNode, 'implicit') === 'yes';
        score.measures.push({
          index: currentMeasureIndex,
          id: buildMeasureId({ index: currentMeasureIndex }),
          label: measureLabel,
          startTick: measureStartCursor,
          lengthTicks: 0,
          nominalTicks: 0,
          implicit,
          beatOffsetTicks: 0,
          time: null,
        });
      }

      const mInfo = score.measures[currentMeasureIndex];
      if (!mInfo) continue;
      if (!firstPart) {
        cursor = mInfo.startTick;
        measureStartCursor = cursor;
        measureMaxCursor = cursor;
      } else {
        mInfo.startTick = measureStartCursor;
      }

      const measureNotes: any[] = [];

      for (const el of measureNode.children) {
        if (!(el instanceof XmlElement)) continue;
        if (!supportedElements.has(el.name)) {
          report.add('info', 'unsupportedElement', measureLabel, el.name);
          report.skippedElementCount++;
          continue;
        }

        if (el.name === 'attributes') {
          const divEl = getChild(el, 'divisions');
          if (divEl) currentDivisions = parseInt(getText(divEl), 10) || currentDivisions;

          const stavesEl = getChild(el, 'staves');
          if (stavesEl) currentStaves = parseInt(getText(stavesEl), 10) || currentStaves;

          const timeEl = getChild(el, 'time');
          if (timeEl && firstPart) {
            const senzaMisura = getChild(timeEl, 'senza-misura');
            if (senzaMisura) {
              mInfo.time = null;
            } else {
              const beats = getText(getChild(timeEl, 'beats')) || '4';
              const beatType = parseInt(getText(getChild(timeEl, 'beat-type')), 10) || 4;
              mInfo.time = { beats, beatType };
            }
          }

          const transEls = getChildren(el, 'transpose');
          for (const transEl of transEls) {
            const chromatic = parseInt(getText(getChild(transEl, 'chromatic')), 10) || 0;
            const diatonic = getChild(transEl, 'diatonic')
              ? parseInt(getText(getChild(transEl, 'diatonic')), 10)
              : undefined;
            const double = getChild(transEl, 'double') ? 1 : 0;
            const octaveChangeTxt = getText(getChild(transEl, 'octave-change'));
            let octaveChange = octaveChangeTxt ? parseInt(octaveChangeTxt, 10) : 0;
            if (double) octaveChange += 1;

            part.transpositions.push({
              measureIndex: currentMeasureIndex,
              onsetInMeasure: cursor - measureStartCursor,
              chromatic,
              octaveChange,
              ...(diatonic !== undefined ? { diatonic } : {}),
            });
          }
        } else if (el.name === 'note') {
          const isCue = getChild(el, 'cue') !== undefined;
          const chord = getChild(el, 'chord') !== undefined;
          const durTxt = getText(getChild(el, 'duration'));
          let durationTicks = 0;
          if (durTxt) {
            const dec = parseFloat(durTxt);
            durationTicks = Math.round(dec * (ppq / currentDivisions));
          }

          let noteCursor = cursor;
          if (chord) {
            noteCursor = measureNotes.length > 0 ? measureNotes[measureNotes.length - 1].startCursor : cursor;
          }

          const voice = getText(getChild(el, 'voice')) || '1';
          const staff = parseInt(getText(getChild(el, 'staff')), 10) || 1;
          const isRest = getChild(el, 'rest') !== undefined;
          const isGrace = getChild(el, 'grace') !== undefined;
          const isUnpitched = getChild(el, 'unpitched') !== undefined;
          const pitchEl = getChild(el, 'pitch');

          if (!chord && !isGrace) {
            cursor += durationTicks;
            measureMaxCursor = Math.max(measureMaxCursor, cursor);
          }

          let writtenKey = 0;
          if (pitchEl) {
            const step = getText(getChild(pitchEl, 'step'));
            const alter = parseFloat(getText(getChild(pitchEl, 'alter'))) || 0;
            const octave = parseInt(getText(getChild(pitchEl, 'octave')), 10) || 4;
            writtenKey = getMidiKey(step, Math.round(alter), octave);
          } else if (isUnpitched) {
            const unpEl = getChild(el, 'unpitched');
            if (unpEl) {
              const step = getText(getChild(unpEl, 'display-step')) || 'C';
              const octave = parseInt(getText(getChild(unpEl, 'display-octave')), 10) || 4;
              writtenKey = getUnpitchedDisplayKey(step, octave);
            } else {
              writtenKey = getUnpitchedDisplayKey('C', 4);
            }
          }

          if (!isRest && !isCue && (pitchEl || isUnpitched)) {
            let tieStart = false;
            let tieStop = false;
            const ties = getChildren(el, 'tie');
            if (ties.length > 0) {
              for (const t of ties) {
                if (getAttr(t, 'type') === 'start') tieStart = true;
                if (getAttr(t, 'type') === 'stop') tieStop = true;
              }
            } else {
              const tieds = getChildren(el, 'tied');
              for (const t of tieds) {
                if (getAttr(t, 'type') === 'let-ring') continue;
                if (getAttr(t, 'type') === 'start') tieStart = true;
                if (getAttr(t, 'type') === 'stop') tieStop = true;
              }
            }

            const instrumentEl = getChild(el, 'instrument');
            const instrumentId = instrumentEl ? getAttr(instrumentEl, 'id') || null : null;

            let velocityOverride = null;
            let accent = false;
            const notations = getChildren(el, 'notations');
            const fingerings: Fingering[] = [];
            for (const not of notations) {
              const dyn = getChild(not, 'dynamics');
              if (dyn) {
                for (const ch of dyn.children) {
                  if (!(ch instanceof XmlElement)) continue;
                  const velocity = DYNAMIC_VELOCITY[ch.name];
                  if (velocity) velocityOverride = Math.round(0.9 * velocity);
                }
              }
              const artic = getChild(not, 'articulations');
              if (artic && getChild(artic, 'accent')) accent = true;

              const tech = getChild(not, 'technical');
              if (tech) {
                for (const f of getChildren(tech, 'fingering')) {
                  const text = getText(f);
                  const substitution = getAttr(f, 'substitution') === 'yes';
                  const alternate = getAttr(f, 'alternate') === 'yes';
                  const placement = getAttr(f, 'placement') as 'above' | 'below' | undefined;
                  let finger: 1 | 2 | 3 | 4 | 5 | null = null;
                  if (/^[1-5]$/.test(text)) finger = parseInt(text, 10) as 1 | 2 | 3 | 4 | 5;
                  fingerings.push({
                    text,
                    finger,
                    substitution,
                    alternate,
                    placement: placement || null,
                  });
                }
              }
            }

            let grace = null;
            if (isGrace) {
              const gEl = getChild(el, 'grace');
              if (gEl) {
                grace = {
                  index: 0,
                  slash: getAttr(gEl, 'slash') === 'yes',
                  stealPrevious: getAttr(gEl, 'steal-time-previous')
                    ? parseFloat(getAttr(gEl, 'steal-time-previous')!)
                    : null,
                  stealFollowing: getAttr(gEl, 'steal-time-following')
                    ? parseFloat(getAttr(gEl, 'steal-time-following')!)
                    : null,
                  makeTime: getAttr(gEl, 'make-time') ? parseFloat(getAttr(gEl, 'make-time')!) : null,
                };
              }
            }

            const onsetTicks = noteCursor - measureStartCursor;
            const onsetQuarters = reduceFraction(onsetTicks, ppq);

            let soundingKey = writtenKey;
            let lastTrans: Transposition | null = null;
            for (const tr of part.transpositions) {
              if (
                tr.measureIndex < currentMeasureIndex ||
                (tr.measureIndex === currentMeasureIndex && tr.onsetInMeasure <= onsetTicks)
              ) {
                lastTrans = tr;
              }
            }
            if (lastTrans) {
              soundingKey = applyTransposition(writtenKey, lastTrans.chromatic, lastTrans.octaveChange || 0, false);
            }

            measureNotes.push({
              startCursor: noteCursor,
              note: {
                id: '',
                part: partIndex,
                staff,
                voice,
                measureIndex: currentMeasureIndex,
                onsetInMeasure: onsetTicks,
                onsetQuarters,
                durationTicks,
                writtenKey,
                soundingKey,
                unpitched: isUnpitched,
                grace,
                tie: { start: tieStart, stop: tieStop },
                chord,
                instrument: instrumentId,
                velocityOverride,
                accent,
                fingerings,
                printed: getAttr(el, 'print-object') !== 'no',
                source: { start: (el as any).start || 0, end: (el as any).end || 0 },
              },
            });
          }
        } else if (el.name === 'backup') {
          const durTxt = getText(getChild(el, 'duration'));
          if (durTxt) {
            cursor -= Math.round(parseFloat(durTxt) * (ppq / currentDivisions));
          }
        } else if (el.name === 'forward') {
          const durTxt = getText(getChild(el, 'duration'));
          if (durTxt) {
            cursor += Math.round(parseFloat(durTxt) * (ppq / currentDivisions));
            measureMaxCursor = Math.max(measureMaxCursor, cursor);
          }
        } else if (el.name === 'direction') {
          const onsetInMeasure = cursor - measureStartCursor;
          const dirType = getChild(el, 'direction-type');
          const sound = getChild(el, 'sound');
          const offsetEl = getChild(el, 'offset');
          let tempoOnsetInMeasure = onsetInMeasure;
          if (offsetEl && getAttr(offsetEl, 'sound') === 'yes') {
            const offsetTxt = getText(offsetEl);
            if (offsetTxt) {
              const offsetTicks = Math.round(parseFloat(offsetTxt) * (ppq / currentDivisions));
              tempoOnsetInMeasure = Math.max(0, onsetInMeasure + offsetTicks);
              if (onsetInMeasure + offsetTicks < 0) {
                report.add('warning', 'cursorClamped', measureLabel, 'offset');
              }
            }
          }

          if (dirType) {
            const metronome = getChild(dirType, 'metronome');
            let qpm = 0;
            if (sound && getAttr(sound, 'tempo')) {
              qpm = parseFloat(getAttr(sound, 'tempo')!);
              hasTempo = true;
            } else if (metronome) {
              const beatUnit = getText(getChild(metronome, 'beat-unit'));
              const dot = getChild(metronome, 'beat-unit-dot') ? 1.5 : 1;
              const perMinute = getText(getChild(metronome, 'per-minute'));
              if (beatUnit && perMinute) {
                let multiplier = 1;
                if (beatUnit === 'quarter') multiplier = 1;
                if (beatUnit === 'eighth') multiplier = 0.5;
                if (beatUnit === 'half') multiplier = 2;
                qpm = parseFloat(perMinute) * multiplier * dot;
                hasTempo = true;
              }
            }
            if (qpm > 0) {
              score.tempoMarks.push({
                measureIndex: currentMeasureIndex,
                onsetInMeasure: tempoOnsetInMeasure,
                qpmNum: Math.round(qpm * 100),
                qpmDen: 100,
              });
            }

            const words = getChild(dirType, 'words');
            if (words) {
              if (INFER_JUMPS_FROM_TEXT) {
                const text = getText(words)
                  .toLowerCase()
                  .replace(/[^a-z]/g, '');
                if (text === 'dcalf' || text === 'dacapoalfine') {
                  score.navigation.jumps.push({ measureIndex: currentMeasureIndex, type: 'da-capo', al: 'fine' });
                }
                if (text === 'dc') {
                  score.navigation.jumps.push({ measureIndex: currentMeasureIndex, type: 'da-capo' });
                }
                if (text === 'dsalc' || text === 'dalsegnoalcoda') {
                  score.navigation.jumps.push({ measureIndex: currentMeasureIndex, type: 'dal-segno', al: 'coda' });
                }
                if (text === 'fine') {
                  score.navigation.targets.push({ measureIndex: currentMeasureIndex, type: 'fine' });
                }
              }
            }

            const dynamics = getChild(dirType, 'dynamics');
            if (dynamics) {
              for (const d of dynamics.children) {
                if (d instanceof XmlElement && DYNAMIC_VELOCITY[d.name]) {
                  part.dynamics.push({
                    measureIndex: currentMeasureIndex,
                    onsetInMeasure,
                    type: d.name,
                  });
                }
              }
            }
            const wedge = getChild(dirType, 'wedge');
            if (wedge) {
              part.wedges.push({
                measureIndex: currentMeasureIndex,
                onsetInMeasure,
                type: getAttr(wedge, 'type') as any,
              });
            }
            if (firstPart) {
              const visualSegno = getChild(dirType, 'segno');
              if (visualSegno && !(sound && getAttr(sound, 'segno'))) {
                score.navigation.targets.push({ measureIndex: currentMeasureIndex, type: 'segno' });
              }
              const visualCoda = getChild(dirType, 'coda');
              if (visualCoda && !(sound && getAttr(sound, 'coda'))) {
                score.navigation.targets.push({ measureIndex: currentMeasureIndex, type: 'coda' });
              }
            }
          }
          if (sound) {
            const timeOnlyAttr = getAttr(sound, 'time-only');
            const timeOnly = timeOnlyAttr
              ? timeOnlyAttr
                  .split(',')
                  .map((n) => parseInt(n.trim(), 10))
                  .filter((n) => !isNaN(n))
              : undefined;
            const dacapo = getAttr(sound, 'dacapo');
            if (dacapo)
              score.navigation.jumps.push({
                measureIndex: currentMeasureIndex,
                type: 'da-capo',
                ...(timeOnly ? { timeOnly } : {}),
              });
            const dalsegno = getAttr(sound, 'dalsegno');
            if (dalsegno)
              score.navigation.jumps.push({
                measureIndex: currentMeasureIndex,
                type: 'dal-segno',
                name: dalsegno,
                ...(timeOnly ? { timeOnly } : {}),
              });
            const tocoda = getAttr(sound, 'tocoda');
            if (tocoda)
              score.navigation.jumps.push({
                measureIndex: currentMeasureIndex,
                type: 'to-coda',
                name: tocoda,
                ...(timeOnly ? { timeOnly } : {}),
              });
            const fine = getAttr(sound, 'fine');
            if (fine) score.navigation.targets.push({ measureIndex: currentMeasureIndex, type: 'fine' });
            const segno = getAttr(sound, 'segno');
            if (segno) score.navigation.targets.push({ measureIndex: currentMeasureIndex, type: 'segno', name: segno });
            const coda = getAttr(sound, 'coda');
            if (coda) score.navigation.targets.push({ measureIndex: currentMeasureIndex, type: 'coda', name: coda });
          }
        } else if (el.name === 'barline') {
          const repeat = getChild(el, 'repeat');
          if (repeat) {
            const dir = getAttr(repeat, 'direction') as 'forward' | 'backward';
            let times = 2;
            const timesAttr = getAttr(repeat, 'times');
            if (timesAttr) times = parseInt(timesAttr, 10) || 2;
            const afterJump = getAttr(repeat, 'after-jump') === 'yes';
            score.navigation.repeats.push({
              measureIndex: currentMeasureIndex,
              direction: dir,
              times,
              ...(afterJump ? { afterJump: true } : {}),
            });
          }
          const ending = getChild(el, 'ending');
          if (ending) {
            const type = getAttr(ending, 'type') as 'start' | 'stop' | 'discontinue';
            const numAttr = getAttr(ending, 'number');
            const numbers = numAttr
              ? numAttr
                  .split(/[,.-]/)
                  .map((n) => parseInt(n, 10))
                  .filter((n) => !isNaN(n))
              : [];
            score.navigation.endings.push({ measureIndex: currentMeasureIndex, type, numbers });
          }
        }
      }

      if (firstPart) {
        let nomLength = 0;
        if (mInfo.time) {
          let beatsNum = 4;
          const split = mInfo.time.beats.split('+');
          if (split.length > 0) beatsNum = split.reduce((acc, v) => acc + (parseInt(v, 10) || 0), 0);
          else beatsNum = parseInt(mInfo.time.beats, 10) || 4;
          nomLength = (beatsNum * ppq) / (mInfo.time.beatType / 4);
        } else if (currentMeasureIndex > 0) {
          nomLength = score.measures[currentMeasureIndex - 1]?.nominalTicks ?? 0;
        }
        mInfo.nominalTicks = Math.round(nomLength);
        mInfo.lengthTicks = measureMaxCursor - measureStartCursor;

        if (mInfo.implicit) {
          mInfo.beatOffsetTicks = mInfo.nominalTicks - mInfo.lengthTicks;
        } else {
          if (mInfo.lengthTicks !== mInfo.nominalTicks) {
            report.add('info', 'measureLengthMismatch', measureLabel);
          }
        }
      } else {
        const expectedStart = mInfo.startTick;
        const diff = measureMaxCursor - expectedStart;
        if (diff > mInfo.lengthTicks) {
          mInfo.lengthTicks = diff;
        }
      }

      const noteCounters = new Map<string, number>();

      let graceGroupIndex = 0;
      let lastGraceCursor = -1;

      for (const mn of measureNotes) {
        if (mn.note.grace) {
          if (mn.startCursor !== lastGraceCursor) {
            graceGroupIndex = 1;
            lastGraceCursor = mn.startCursor;
          } else {
            graceGroupIndex++;
          }
          mn.note.grace.index = graceGroupIndex;
        }

        const baseId = buildNoteId({
          part: mn.note.part,
          staff: mn.note.staff,
          measure: mn.note.measureIndex,
          voice: mn.note.voice,
          onset: mn.note.onsetQuarters,
          pitch: mn.note.unpitched ? `u${mn.note.writtenKey}` : mn.note.writtenKey,
          isGrace: mn.note.grace !== null,
          graceIndex: mn.note.grace?.index,
        });

        const dupCount = (noteCounters.get(baseId) || 0) + 1;
        noteCounters.set(baseId, dupCount);

        const duplicateIndex = dupCount > 1 ? dupCount : undefined;
        mn.note.id = buildNoteId({
          part: mn.note.part,
          staff: mn.note.staff,
          measure: mn.note.measureIndex,
          voice: mn.note.voice,
          onset: mn.note.onsetQuarters,
          pitch: mn.note.unpitched ? `u${mn.note.writtenKey}` : mn.note.writtenKey,
          isGrace: mn.note.grace !== null,
          graceIndex: mn.note.grace?.index,
          ...(duplicateIndex !== undefined ? { duplicateIndex } : {}),
        });

        part.notes.push(mn.note);
      }
    }
    part.staves = currentStaves;
    score.parts.push(part);
    partIndex++;
  }

  score.tempoMarks.sort((a, b) =>
    a.measureIndex !== b.measureIndex ? a.measureIndex - b.measureIndex : a.onsetInMeasure - b.onsetInMeasure,
  );
  for (const part of score.parts) {
    part.notes.sort((a, b) => {
      if (a.measureIndex !== b.measureIndex) return a.measureIndex - b.measureIndex;
      if (a.onsetInMeasure !== b.onsetInMeasure) return a.onsetInMeasure - b.onsetInMeasure;
      if (a.staff !== b.staff) return a.staff - b.staff;
      if (a.voice !== b.voice) return a.voice.localeCompare(b.voice);
      return a.writtenKey - b.writtenKey;
    });
  }

  if (!hasTempo) {
    score.defaultTempoUsed = true;
    score.tempoMarks.push({ measureIndex: 0, onsetInMeasure: 0, qpmNum: DEFAULT_TEMPO_QPM * 100, qpmDen: 100 });
    report.add('info', 'defaultTempo', '0');
  }

  return { score, report: report.getReport() };
}
