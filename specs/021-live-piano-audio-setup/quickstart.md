# Quickstart: Live Piano and Audio Setup (feature 021)

No new dependency and no new command. Run the app as usual:

```bash
pnpm dev
```

```bash
pnpm electron:dev
```

Automated checks for what this feature touches (task tier):

```bash
pnpm test -- tests/engine/live-router.test.ts tests/engine/play-session.test.ts tests/core/play/calibration.test.ts
```

```bash
npx playwright test tests/e2e/live-piano.spec.ts tests/e2e/latency-setup.spec.ts tests/e2e/midi-topbar.spec.ts tests/e2e/transport-icons.spec.ts --project=chromium
```

The desktop half (needs `pnpm exec vite build -c vite.electron.config.ts` first, and a working MIDI service on Windows - the
app opens the machine's MIDI ports only when the Connect button is used):

```bash
npx playwright test tests/e2e/electron-live-piano.spec.ts tests/e2e/electron-audio-output.spec.ts --project=electron
```

Pictures for the visual checks: `pnpm screenshot --item <library id>` (light and dark theme), then open the PNG.

## Manual verification per user story

Use a real MIDI keyboard where possible; the e2e specs cover the same steps with the fake MIDI keyboard.

### US1 - The piano always plays

1. Desktop app: start `pnpm electron:dev`, do not click. Wait until the top-bar control no longer shows "sound
   loading". Press a key: piano sound.
2. Browser: open `pnpm dev` in Chrome. Press a key before clicking: no sound, the hint "Click anywhere on the page to turn
   the sound on" appears once. Click anywhere (e.g. the score browser background). Press a key: sound.
3. Open a Score, switch to Play mode, do not start a run: keys sound. Hold the pedal: notes sustain.
4. Start a Play run: keys sound once (no doubled attack), pedal works during the run. Stop: keys still sound.
5. Hold a key and switch mode / start Listen / open another Score: the held note keeps sounding until released.
6. Listen playing, Practice waiting, Grade popup open, score browser open: keys sound in each.

### US2 - Latency that works

1. Fresh browser profile (or clear `musicanyya.latency.v1`), no Play run: Setup > Latency shows an output latency in ms
   and "Assumed (not calibrated)".
2. Calibrate: four accented count-in clicks, then sixteen clicks; play any key on each. Result "Calibrated: n ms".
   Reload: still calibrated. Without a MIDI keyboard, the space bar works as the tap key and does not start playback.
3. Tap randomly: the failure is explained; the previous profile stays.
4. Play a run, open its Grade: it names the calibrated profile. An older attempt from Recent attempts regrades with its
   own old profile (same Grade as before).
5. "Use assumed latency": back to "Assumed".

### US3 - MIDI keyboard in the top bar

1. Start with a keyboard connected: the top bar offers "Connect MIDI keyboard"; click it (the browser may ask for MIDI
   permission once): the keyboard's name is then in the top bar. MIDI is never requested by itself at start-up.
2. Unplug it: "MIDI keyboard disconnected" within a second; plug in: its name again.
3. Click the control: popover with the device list; Setup menu has no "MIDI keyboard" entry.
4. During a Play run, open the popover: the run goes on and the cursor's system stays visible.

### US4 - Icon transport

1. Each mode: play / pause / stop / skip buttons show icons only; hovering shows the name and shortcut.
2. Screen reader or accessibility tree: names "Play", "Pause", "Stop", "Start", "Skip Back", "Skip Forward" as before.
3. Light and dark themes (`pnpm screenshot`): icons legible; disabled skip buttons dashed and faded.

### US5 - Sound output

1. Desktop app: Setup > Latency > Sound output lists the system default and your devices by name. Choose another one:
   piano and Listen sound there. Restart: still chosen.
2. Unplug that device (e.g. USB headphones): within two seconds sound continues on the default, one notice ("The chosen
   sound output was disconnected; playing through the system default."). Plug it back: sound returns to it, silently.
   (The automated test simulates the unplugging; a real unplug is a manual check.)
3. Browser: "System default output - change it in your system's sound settings." and the ASIO line; no driver choices.
