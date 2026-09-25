import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LibrarySessionController } from '../../src/app/library-session.js';
import type { LibraryIndex, LibraryItem } from '../../src/core/library/types.js';
import { handleMessage } from '../../src/workers/score.worker.js';
import { FakeLibraryCatalog } from '../fakes/fake-library-catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(__dirname, '../fixtures/musicxml/scale-c-major-q100.musicxml');
const fixtureBuffer = fs.readFileSync(fixturePath);
const fixtureBytes = fixtureBuffer.buffer.slice(
  fixtureBuffer.byteOffset,
  fixtureBuffer.byteOffset + fixtureBuffer.byteLength,
) as ArrayBuffer;

function item(overrides: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id: 'repertoire/beginner/scale',
    section: 'repertoire/beginner',
    file: 'repertoire/beginner/scale.musicxml',
    bytes: fixtureBytes.byteLength,
    hash: 'a'.repeat(64),
    meta: {
      version: 1,
      title: 'A Scale',
      kind: 'piece',
      level: 'beginner',
      tags: ['sight-reading'],
      provenance: { origin: 'authored', licence: 'CC0-1.0', author: 'Musicanyya', created: '2026-09-22' },
      reviewedBy: 'music-domain-expert',
      reviewedOn: '2026-09-22',
    },
    facts: {
      measures: 1,
      notes: 4,
      durationSeconds: 2.4,
      keys: ['C major'],
      metres: ['4/4'],
      tempoBpm: 100,
      lowestMidi: 60,
      highestMidi: 65,
      maxSpanSemitones: 0,
      staves: 1,
      shortestDivision: 4,
      notesPerBeat: 1,
      accidentals: 0,
      notices: [],
    },
    ...overrides,
  };
}

function index(items: LibraryItem[]): LibraryIndex {
  return { version: 1, generated: '2026-09-22T00:00:00.000Z', sections: [], items };
}

interface WorkerLoadedMessage {
  type: 'loaded' | 'failed';
  summary: { measureIds: string[] };
  fullScore: { parts: { notes: { id: string }[] }[] };
  report: unknown;
}

/** Runs the same pipeline `Session.loadBytes` does (`requestScoreLoad` posts to this worker), directly
 *  in Node, so a library item's result can be compared against a "dragged-in" file's. */
async function load(fileName: string, bytes: ArrayBuffer): Promise<WorkerLoadedMessage> {
  const messages: WorkerLoadedMessage[] = [];
  await handleMessage({ data: { type: 'load', requestId: 1, fileName, bytes } } as MessageEvent, (msg) =>
    messages.push(msg as WorkerLoadedMessage),
  );
  const message = messages[0];
  if (!message) throw new Error('expected the worker to post one message');
  return message;
}

describe('LibrarySessionController (session-library, US1 T016)', () => {
  it('fetches the bytes and hands them to loadBytes, identical to a dragged-in file', async () => {
    const catalog = new FakeLibraryCatalog();
    catalog.setItem('repertoire/beginner/scale.musicxml', fixtureBytes);

    let received: { fileName: string; bytes: ArrayBuffer } | null = null;
    const notices: string[] = [];
    const controller = new LibrarySessionController(catalog, {
      loadBytes: async (fileName, bytes) => {
        received = { fileName, bytes };
      },
      onNotice: (code) => notices.push(code),
    });

    const ok = await controller.openItem(index([item()]), 'repertoire/beginner/scale');
    expect(ok).toBe(true);
    expect(notices).toEqual([]);
    expect(controller.openedLibraryItemId).toBe('repertoire/beginner/scale');
    if (!received) throw new Error('expected loadBytes to have been called');

    const viaLibrary = await load(received.fileName, received.bytes);
    const viaDragIn = await load('scale-c-major-q100.musicxml', fixtureBytes.slice(0));

    expect(viaLibrary.type).toBe('loaded');
    expect(viaLibrary.summary.measureIds).toEqual(viaDragIn.summary.measureIds);
    expect(viaLibrary.fullScore.parts[0]?.notes.map((n) => n.id)).toEqual(
      viaDragIn.fullScore.parts[0]?.notes.map((n) => n.id),
    );
    expect(viaLibrary.report).toEqual(viaDragIn.report);
  });

  it("passes the index entry's hash to catalog.item, so a stale cached copy is never used (feature 007 FR-024)", async () => {
    const catalog = new FakeLibraryCatalog();
    catalog.setItem('repertoire/beginner/scale.musicxml', fixtureBytes);
    const controller = new LibrarySessionController(catalog, { loadBytes: async () => {}, onNotice: () => {} });

    await controller.openItem(index([item({ hash: 'b'.repeat(64) })]), 'repertoire/beginner/scale');
    expect(catalog.itemRequests).toEqual([
      { file: 'repertoire/beginner/scale.musicxml', expectedHash: 'b'.repeat(64) },
    ]);
  });

  it('a fetch failure raises a notice and never calls loadBytes (the current Score stays untouched)', async () => {
    const catalog = new FakeLibraryCatalog();
    catalog.failNextItem = 'unavailable';

    let loadBytesCalled = false;
    const notices: string[] = [];
    const controller = new LibrarySessionController(catalog, {
      loadBytes: async () => {
        loadBytesCalled = true;
      },
      onNotice: (code) => notices.push(code),
    });

    const ok = await controller.openItem(index([item()]), 'repertoire/beginner/scale');
    expect(ok).toBe(false);
    expect(loadBytesCalled).toBe(false);
    expect(notices).toEqual(['libraryUnavailable']);
    expect(controller.openedLibraryItemId).toBeNull();
  });

  it('an unknown item id raises a notice without calling loadBytes', async () => {
    const catalog = new FakeLibraryCatalog();
    let loadBytesCalled = false;
    const notices: string[] = [];
    const controller = new LibrarySessionController(catalog, {
      loadBytes: async () => {
        loadBytesCalled = true;
      },
      onNotice: (code) => notices.push(code),
    });

    const ok = await controller.openItem(index([]), 'repertoire/beginner/missing');
    expect(ok).toBe(false);
    expect(loadBytesCalled).toBe(false);
    expect(notices).toEqual(['libraryItemMissing']);
  });

  it('opening a user file clears openedLibraryItemId', async () => {
    const catalog = new FakeLibraryCatalog();
    catalog.setItem('repertoire/beginner/scale.musicxml', fixtureBytes);
    const controller = new LibrarySessionController(catalog, {
      loadBytes: async () => {},
      onNotice: () => {},
    });

    await controller.openItem(index([item()]), 'repertoire/beginner/scale');
    expect(controller.openedLibraryItemId).toBe('repertoire/beginner/scale');

    controller.clearOpenedItem();
    expect(controller.openedLibraryItemId).toBeNull();
  });
});
