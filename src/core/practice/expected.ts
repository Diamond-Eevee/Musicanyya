import type { Note, Part, Score } from '../score/model.js';
import type { PlaybackTimeline } from '../timeline/types.js';
import type { ExpectedEvent, HandSelection, SoundingRef } from './types.js';

export function partOptions(score: Score): {
  readonly parts: readonly { partIndex: number; name: string; staves: number }[];
  readonly preselected: number;
} {
  const parts: { partIndex: number; name: string; staves: number }[] = [];
  let firstPitched = -1;
  let preselected = -1;

  for (const part of score.parts) {
    let hasPitchedPrinted = false;
    for (const note of part.notes) {
      if (!note.unpitched && note.printed !== false) {
        hasPitchedPrinted = true;
        break;
      }
    }
    if (hasPitchedPrinted) {
      parts.push({ partIndex: part.index, name: part.name || `Part ${part.index + 1}`, staves: part.staves });
      if (firstPitched === -1) firstPitched = part.index;
      if (preselected === -1 && part.staves >= 2) {
        preselected = part.index;
      }
    }
  }

  if (preselected === -1) preselected = firstPitched;

  return { parts, preselected };
}

export function handOptions(score: Score, partIndex: number): readonly HandSelection[] {
  const part = score.parts.find((p) => p.index === partIndex);
  if (!part) return [];
  const staves = part.staves;

  if (staves === 1) {
    return [{ preset: 'both', partIndex, staves: [1] }];
  } else if (staves === 2) {
    return [
      { preset: 'both', partIndex, staves: [1, 2] },
      { preset: 'right', partIndex, staves: [1] },
      { preset: 'left', partIndex, staves: [2] },
    ];
  } else {
    const allStaves = Array.from({ length: staves }, (_, i) => i + 1);
    const options: HandSelection[] = [{ preset: 'both', partIndex, staves: allStaves }];
    for (let i = 1; i <= staves; i++) {
      options.push({ preset: 'custom', partIndex, staves: [i] });
    }
    return options;
  }
}

function buildHomeStaves(score: Score): Map<number, Map<string, number>> {
  const map = new Map<number, Map<string, number>>();
  for (const part of score.parts) {
    const voiceStaff = new Map<string, number>();
    const voiceDurations = new Map<string, Map<number, number>>();
    for (const note of part.notes) {
      let staves = voiceDurations.get(note.voice);
      if (!staves) {
        staves = new Map<number, number>();
        voiceDurations.set(note.voice, staves);
      }
      const dur = staves.get(note.staff) || 0;
      staves.set(note.staff, dur + note.durationTicks);
    }

    for (const [voice, staves] of voiceDurations.entries()) {
      let bestStaff = 1;
      let maxDur = -1;
      for (const [staff, dur] of staves.entries()) {
        if (dur > maxDur || (dur === maxDur && staff < bestStaff)) {
          maxDur = dur;
          bestStaff = staff;
        }
      }
      voiceStaff.set(voice, bestStaff);
    }
    map.set(part.index, voiceStaff);
  }
  return map;
}

export function buildExpectedEvents(
  score: Score,
  timeline: PlaybackTimeline,
  selection: HandSelection,
): readonly ExpectedEvent[] {
  const noteMap = new Map<string, { note: Note; part: Part }>();
  for (const part of score.parts) {
    for (const note of part.notes) {
      noteMap.set(note.id, { note, part });
    }
  }

  const homeStaves = buildHomeStaves(score);

  interface RawEvent {
    passIndex: number;
    measureIndex: number;
    onsetTick: number;
    required: Map<number, { key: number; noteIds: string[]; staff: number }>;
    accompaniment: SoundingRef[];
  }

  const eventGroups = new Map<string, RawEvent>();

  for (const ev of timeline.events) {
    const headId = ev.head.noteId;
    const meta = noteMap.get(headId);
    if (!meta) continue;

    const { note, part } = meta;
    const passIndex = ev.head.passIndex;
    const pass = timeline.passes[passIndex];
    if (!pass) continue;

    const onsetTick = pass.startTick + note.onsetInMeasure;
    const groupKey = `${passIndex}:${note.measureIndex}:${note.onsetInMeasure}`;

    let group = eventGroups.get(groupKey);
    if (!group) {
      group = {
        passIndex,
        measureIndex: note.measureIndex,
        onsetTick,
        required: new Map(),
        accompaniment: [],
      };
      eventGroups.set(groupKey, group);
    }

    const homeStaff = homeStaves.get(part.index)?.get(note.voice) ?? note.staff;

    const isRequired =
      !note.unpitched &&
      note.printed !== false &&
      !note.grace &&
      part.index === selection.partIndex &&
      selection.staves.includes(homeStaff);

    if (isRequired) {
      const soundingKey = ev.key;
      const req = group.required.get(soundingKey);
      if (req) {
        req.noteIds.push(...ev.members);
      } else {
        group.required.set(soundingKey, {
          key: soundingKey,
          noteIds: [...ev.members],
          staff: note.staff,
        });
      }
    } else {
      group.accompaniment.push({
        noteId: headId,
        key: ev.key,
        endTick: ev.endTick,
      });
    }
  }

  const expectedEvents: ExpectedEvent[] = [];
  for (const group of eventGroups.values()) {
    if (group.required.size === 0) continue;

    const required = Array.from(group.required.values()).sort((a, b) => a.key - b.key);

    expectedEvents.push({
      index: 0,
      passIndex: group.passIndex,
      measureIndex: group.measureIndex,
      onsetTick: group.onsetTick,
      required,
      accompaniment: group.accompaniment,
    });
  }

  expectedEvents.sort((a, b) => a.onsetTick - b.onsetTick);

  for (let i = 0; i < expectedEvents.length; i++) {
    const ev = expectedEvents[i];
    if (ev) ev.index = i;
  }

  return expectedEvents;
}
