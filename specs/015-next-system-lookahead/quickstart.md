# Quickstart: See the Next System While Playing (015)

No new command, script, dependency or setup.

```bash
pnpm dev                     # the app at http://localhost:5173
```

Focused tests while working:

```bash
pnpm test -- tests/ui/follow.test.ts          # look-ahead target and glide (pure)
pnpm test -- tests/ui/pages.test.ts           # per-page heights, estimates, scroll compensation
pnpm test -- tests/verovio/page-units.test.ts # cropped pages, margins, compact spacing pins
pnpm test:e2e -- tests/e2e/lookahead.spec.ts  # system changes, per-frame steps, reduced motion, page gaps
pnpm library:fidelity --check                 # the audit still passes with the new engraving options
```

Full gate at a checkpoint: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`.

Note for cloud containers: `pnpm screenshot` launches Playwright's own Chromium build; where only an older build is
installed (`/opt/pw-browsers`), it fails with "Executable doesn't exist". The e2e suite uses the configured browser
and is not affected.

## Manual verification

Look at every picture; a check is not done until the PNG was opened. Window sizes are CSS px.

### US1 - the next system is always visible (P1)

1. `pnpm dev`, window 1920 x 1080 (browser maximised on a 1080p screen), piano strip **off** (View menu). Open
   *Für Elise (complete)* from the Score browser, default size (100 %), Follow ticked, Listen, Play.
2. Watch at least three system changes and two page changes. Expect: whenever the cursor enters a new system whose
   next system is not fully on screen, the view glides so that the cursor's system sits just below the top edge and
   the next system is fully visible below it; no empty band ever separates two systems (page changes look like any
   other system change).
3. Scroll with the wheel during playback: Follow unticks and the view stays. Tick Follow: the view glides back
   (under half a second) to the cursor's system with the next one below.
4. Practice mode (fake or real MIDI keyboard), same Score: at the last note of a system, while the app waits, the next
   system is already visible.
5. Play mode: same behaviour as Listen.

### US2 - fluent scrolling (P2)

1. Same setup as US1. Expect every movement to be a short smooth glide (about 0.4 s), never a jump, and the line
   being played never disappears during the glide.
2. Click a measure two pages back during playback: the view glides there quickly (same short duration), not a long
   slow scroll.
3. Turn on the OS setting "reduce motion" (Windows: Settings > Accessibility > Visual effects > Animation effects
   off), reload: view movements are instant.
4. Scroll with the wheel in the middle of a glide: the glide stops at once and Follow unticks.

### US3 - two systems fit more often; otherwise show what fits (P3)

1. Window 1920 x 950, piano strip **on**, default size. Open *Clementi - Sonatina op. 36 no. 1*, Listen: at every
   system change both systems are fully visible above the piano strip.
2. Same window, *Für Elise (complete)*: at every system change the cursor's system is fully visible at the top and
   the rest of the space above the strip shows the top of the next system (at least its treble staff). The Score size
   control still says 100 %.
3. Window 1280 x 720 with the piano strip, and 1920 x 1080 at 200 %: same as step 2; nothing resizes, no hint.
4. Engraving review (SC-008): `pnpm screenshot --item <id> --width 1920 --height 950` for every piano piece in
   `public/library/repertoire/**` and for `tests/fixtures/musicxml/real` piano files; check that treble and bass
   staves are closer than before but nothing collides (notes, beams, slurs, dynamics, hairpins, pedal marks,
   cross-staff beams), and that voice + piano Scores keep their wider gap between the voice and the piano.

### Owner hand test (SC-006)

The owner plays along in Listen and Practice mode on a one-page piece (*Mary Had a Little Lamb*) and a multi-page
piece (*Für Elise (complete)*), including a line change inside a fast passage (a run of short notes; raise the tempo
if needed so a system lasts under two seconds) and the line change after the first repeat, and confirms they can read
the next line before reaching it.

### Behaviour neutrality (SC-005)

`pnpm test -- tests/core/grade tests/core/practice` - the golden Grades and Practice replays are unchanged.
