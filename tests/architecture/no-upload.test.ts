import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

/**
 * The Play path (plan.md "Project Structure", FR-016): every file a Play run, its grading or its storage
 * touches, from the core state machine down to the panels that show a Grade. Performance logs and Grades are
 * kept on the device and never uploaded (FR-016) - none of these files may reach the network.
 */
const PLAY_PATH_ENTRIES = [
  'src/core/play',
  'src/core/grade',
  'src/core/schedule/play-schedule.ts',
  'src/engine/midi/clock-map.ts',
  'src/engine/storage/indexeddb-performance-store.ts',
  'src/engine/storage/local-settings-store.ts',
  'src/workers/grade.worker.ts',
  'src/ui/elements/mx-play-panel.ts',
  'src/ui/elements/mx-grade-panel.ts',
  'src/ui/elements/mx-attempts-list.ts',
  'src/ui/elements/mx-latency-panel.ts',
  'src/ui/score/grade-marks.ts',
  'src/ui/state/playState.ts',
  'src/app/play-session.ts',
  'src/app/session.ts',
];

function getTsFiles(entryPath: string): string[] {
  const full = path.join(repoRoot, entryPath);
  if (!fs.existsSync(full)) return [];
  if (fs.statSync(full).isFile()) return full.endsWith('.ts') ? [full] : [];
  const entries = fs.readdirSync(full, { withFileTypes: true });
  return entries.flatMap((entry) => getTsFiles(path.join(entryPath, entry.name)));
}

const FORBIDDEN: readonly [name: string, pattern: RegExp][] = [
  ['fetch(...)', /\bfetch\s*\(/],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/],
  ['navigator.sendBeacon', /\bnavigator\s*\.\s*sendBeacon\b/],
  ['WebSocket', /\bnew\s+WebSocket\b/],
];

describe('the Play path never reaches the network (FR-016)', () => {
  const files = PLAY_PATH_ENTRIES.flatMap(getTsFiles);

  it('resolved at least the expected number of Play-path source files', () => {
    // Guards the file list above: if a rename or move emptied it, every it.each below would vacuously pass.
    expect(files.length).toBeGreaterThanOrEqual(PLAY_PATH_ENTRIES.length);
  });

  it.each(files.map((file) => [path.relative(repoRoot, file), file] as const))(
    '%s has no fetch, XMLHttpRequest, sendBeacon or WebSocket',
    (_relativePath, file) => {
      const content = fs
        .readFileSync(file, 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      for (const [name, pattern] of FORBIDDEN) {
        expect(content, name).not.toMatch(pattern);
      }
    },
  );
});
