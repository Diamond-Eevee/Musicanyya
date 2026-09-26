# Quickstart: Tempo as an Editable BPM Number

Feature 012. No new setup, dependency or command.

```bash
pnpm install
pnpm dev                       # browser Shell
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```

Focused runs while implementing:

```bash
pnpm test -- tests/core/tempo          # beat-unit, tempo-display, rate/dispatch with fractional percent
pnpm test -- tests/core/musicxml       # metronome-mark parsing (beat units, dots, "c. 90", ranges, bounds)
pnpm test -- tests/ui/tempo-field.test.ts tests/ui/transport.test.ts tests/ui/setup-panel.test.ts
pnpm test -- tests/engine/storage       # settings 2.1.0, play settings with fractional percent
pnpm test:e2e -- us2-listen us3-play-setup tempo-field
```

Fixtures (`tests/fixtures/musicxml/`): existing `tempo-dotted-beat-unit`, `tempo-sound-vs-metronome`,
`tempo-none-default`, `tempo-change-mid-measure-offset`, `community/31c-MetronomeMarks`; new ones added by the tasks
for a 90 -> 60 change, a 6/8 mark followed by a sound-only change and a `<time>` change, "c. 90" / "90-100" text, and
a whole-note unit. Behaviour is also checked on the real corpora (`tests/fixtures/musicxml/real`) and the library.

## Manual verification (AGENTS.md "Seeing the app": look at the picture)

`pnpm screenshot --item <library id>` or `--file <path>`, then open the PNG it prints.

### US1 - see the tempo

1. `pnpm screenshot --item learning/key-changes/a-major-to-a-minor/beginner` -> the transport reads
   "Tempo [-] 72 BPM [+]" with no beat symbol, no "written" hint, reset disabled.
2. `pnpm screenshot --file tests/fixtures/musicxml/tempo-dotted-beat-unit.musicxml` -> "60 BPM" followed by a
   dotted-quarter symbol.
3. `pnpm screenshot --file tests/fixtures/musicxml/tempo-none-default.musicxml` -> "100 BPM" and "default".
4. In `pnpm dev`, open the 90 -> 60 fixture, press Play in Listen mode: the number changes from 90 to 60 when the
   cursor reaches the change; click a measure after the change while stopped: it shows 60.

### US2 - type the tempo

1. Open a Score written at 90. Click the number, type 72, press Enter: "72 BPM", "written 90" appears, reset enabled.
   Press Play: the Metronome (Play mode) / the beat of the music (Listen) is at 72 per minute.
2. While Listen plays, press + three times: 73, 74, 75; the music speeds up without a gap or restart.
3. Type 500, Enter: the field shows 180 (200 % of 90). Type 10: 23. Type "abc" or clear it and press Escape: the
   previous value returns. Type a space in the field: playback does not toggle.
4. Press reset: 90, hint gone, reset disabled.
5. Open a different Score written at 120: it starts at 120 (no carry-over, FR-015).
6. On the 90 -> 60 fixture, with the cursor in the 60 section, type 45: after the repeat back to m1 the 90 section
   shows 68.

### US3 - Play mode and the Grade

1. Open a Score written at 120, switch to Play: the Play setup and the transport both show "120 BPM". Set 90 in the
   setup: the transport shows 90 too.
2. Start a run: both fields are read-only during count-in and run; the count-in clicks at 90 per minute.
3. After the run, the attempts list shows "90 BPM (75% of written)". Regrade it: identical Grade.
4. An attempt recorded before this feature (e.g. at 70 %) shows "84 BPM (70% of written)".

### Phone width

`pnpm screenshot --item <id> --width 375` (or resize the browser to 375 px): number, unit, beat symbol and step
buttons are fully visible; the play buttons stay on screen (SC-004).
