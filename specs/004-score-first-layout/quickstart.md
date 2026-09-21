# Quickstart: Score-First Application Window

Feature `004-score-first-layout`. No new tooling, no new dependency - the commands are the project's
usual ones.

## Run it

```bash
pnpm install
pnpm dev            # Vite dev server; open in Chrome or Edge
```

```bash
pnpm electron:dev   # the same UI in the Electron shell
```

Load `tests/fixtures/musicxml/c-major-scale-and-chords.musicxml` (or any MusicXML file) by dropping it
on the window or through **Open score**.

## Quality gate

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```

---

## Manual verification per user story

Do this in a **maximised window on the 1080p laptop screen**, which is the reference target.

### US1 - the Score fills the window (P1)

1. Open a multi-page score.
2. Confirm: no panel on the left, right or bottom; one slim bar at the top, no taller than a normal
   button row.
3. Confirm: the music spans the full window width and at least two systems are readable without
   scrolling.
4. Resize the window from full screen down to about half width and back. The music re-flows, the bar
   stays one row, nothing is clipped, and there is never a horizontal scrollbar.
5. Close the score (or reload with none): the whole area shows one invitation to open or drop a file,
   and dropping a file anywhere in that area opens it.

**Passes when**: steps 2-5 all hold. (`SC-001`, `SC-002`, `SC-006`)

### US2 - secondary tools live in menus and popups (P2)

1. Open each menu in turn (Score, Setup, View, Help) and each entry inside it.
2. Confirm each opens over the music as a popup, and the music underneath does not move or re-render.
3. With one open, open another: the first closes.
4. Press Escape: the popup closes and the keyboard focus is back on the menu button.
5. Tab through an open popup: every control is reachable; Escape still closes it.
6. With a popup open, press Play: the popup closes by itself and the run starts - no dialog, no
   confirmation.

**Passes when**: steps 2-6 all hold. (`SC-003`, `SC-007`)

### US3 - setup before the run, minimal chrome during it (P2)

1. Switch to Practice mode, open **Setup**, choose a part, hands and a loop, close the popup.
2. Start Practice. Confirm: no setup controls anywhere; the bar shows mode, the current measure and a
   Stop control; the Stop control ends the run in one press.
3. Unplug the MIDI keyboard mid-run: a notice appears in the corner, nothing modal appears, the layout
   does not jump, and the run continues.
4. Switch to Play mode, run a short range, and let it finish. The Grade appears over the music; dismiss
   it and confirm the per-note marks are still on the notes.

**Passes when**: steps 2-4 all hold. (`SC-004`)

### US4 - overlays never hide the music (P3)

1. Start Listen mode on a score of 30+ measures and watch a full pass.
2. Confirm the system holding the cursor is never underneath the bar, a notice or the piano strip.
3. Turn the piano keys on in the **View** panel: the music keeps clear of the strip. Turn it off again.
4. Switch each overlay layer off and on in the **View** panel and confirm each takes effect
   immediately.

**Passes when**: steps 2-4 all hold. (`SC-005`)

### Score size (FR-014a/b, the owner's sight requirement)

1. Press the **larger** control repeatedly: the staves grow, the music re-flows into fewer measures per
   system, and no horizontal scrollbar ever appears.
2. Confirm the staves can be made at least twice as tall as the default. (`SC-008a`)
3. `Ctrl/Cmd 0` returns to the default size.
4. Reload the page: the chosen size and the overlay switches are exactly as they were left. (`SC-008`)

### Behaviour neutrality

```bash
pnpm test           # every existing timing, Practice and grading suite must pass unchanged
```

Grade the same stored attempt before and after the change: the Grade must be identical. (`SC-009`)
