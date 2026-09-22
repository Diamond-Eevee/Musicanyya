import { afterEach, describe, expect, it } from 'vitest';
import '../../src/ui/elements/mx-score-source.js';
import type { LibraryItem } from '../../src/core/library/types.js';
import { libraryState } from '../../src/ui/state/libraryState.js';

function authoredItem(): LibraryItem {
  return {
    id: 'repertoire/beginner/ode-to-joy',
    section: 'repertoire/beginner',
    file: 'repertoire/beginner/ode-to-joy.musicxml',
    bytes: 100,
    hash: 'a'.repeat(64),
    meta: {
      version: 1,
      title: 'Ode to Joy',
      kind: 'piece',
      level: 'beginner',
      tags: ['sight-reading'],
      provenance: { origin: 'authored', licence: 'CC0-1.0', author: 'Musicanyya', created: '2026-09-22' },
      reviewedBy: 'music-domain-expert',
      reviewedOn: '2026-09-22',
    },
    facts: {
      measures: 16,
      notes: 64,
      durationSeconds: 30,
      keys: ['C major'],
      metres: ['4/4'],
      tempoBpm: 100,
      lowestMidi: 60,
      highestMidi: 72,
      maxSpanSemitones: 7,
      staves: 2,
      shortestDivision: 8,
      notesPerBeat: 1,
      accidentals: 0,
      notices: [],
    },
  };
}

function downloadedItem(): LibraryItem {
  const item = authoredItem();
  return {
    ...item,
    id: 'repertoire/intermediate/openscore-lied',
    meta: {
      ...item.meta,
      provenance: {
        origin: 'downloaded',
        licence: 'CC0-1.0',
        source: 'https://github.com/OpenScore/Lieder',
        obtained: '2026-09-22',
        credit: 'OpenScore',
      },
      limitations: ['written pedal is not played'],
    },
  };
}

describe('mx-score-source (FR-019)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    libraryState.reset();
  });

  it('renders nothing for a user file (no opened item)', () => {
    const el = document.createElement('mx-score-source');
    document.body.appendChild(el);
    expect(el.innerHTML.trim()).toBe('');
  });

  it('shows "written for Musicanyya" for an authored item', () => {
    libraryState.setOpenedItem(authoredItem());
    const el = document.createElement('mx-score-source');
    document.body.appendChild(el);
    expect(el.textContent).toContain('Written for Musicanyya');
  });

  it('shows licence, source and credit for a downloaded item, plus its limitations', () => {
    libraryState.setOpenedItem(downloadedItem());
    const el = document.createElement('mx-score-source');
    document.body.appendChild(el);
    expect(el.textContent).toContain('CC0-1.0');
    expect(el.textContent).toContain('https://github.com/OpenScore/Lieder');
    expect(el.textContent).toContain('OpenScore');
    expect(el.textContent).toContain('written pedal is not played');
  });

  it('clears when the opened item is set back to null (a user file was opened)', () => {
    libraryState.setOpenedItem(authoredItem());
    const el = document.createElement('mx-score-source');
    document.body.appendChild(el);
    expect(el.innerHTML.trim()).not.toBe('');

    libraryState.setOpenedItem(null);
    expect(el.innerHTML.trim()).toBe('');
  });
});
