# Contract: live sound from start-up (engine port, start-up sequence, live router)

**Version**: `1.0.0` (new, feature 021). Owners: `src/engine/ports.ts`, `src/engine/audio/web-audio-engine.ts`,
`src/app/session.ts`, `src/app/play-session.ts`, `electron/main.ts`. Decisions: research R-1 to R-5.
Spec: US1, FR-001 to FR-008.

## 1. `AudioEngine` port additions (ports 2.2.0 -> 2.3.0, MINOR)

```ts
interface AudioEngine {
  // existing ...
  /** Creates the audio context (suspended where the Shell requires a user gesture), the worklet node and its
   *  channel defaults. Never needs a gesture; idempotent; rejects only when Web Audio is unusable (state 'error').
   *  After it resolves, live messages reach the worklet. Emits state 'suspended' with reason 'browserPolicy'
   *  when the context could not start without a gesture. */
  prepare(): Promise<void>;
  /** unchanged meaning: resume the context; must be called from a user-activation handler in the browser. */
  unlock(): Promise<void>;
  /** The calibrated Latency profile, or null for the assumed one (feature 021, audio-setup.md section 2). */
  setLatencyCalibration(profile: LatencyProfile | null): void;
  // latencyProfile(): now returns the calibration when set, else the assumed profile (unchanged shape)
  // output device: audio-setup.md section 3
}
```

Rules:

- `ensureSoundLoaded()` may be called right after `prepare()`, before any gesture.
- `liveNoteOn/Off/Sustain/AllOff` before `prepare()` resolves are dropped (no node). After it, they are queued to the
  worklet whatever the context state; a suspended context renders nothing, so nothing sounds late on unlock (the
  worklet applies live messages at the next rendered block; messages that piled up while suspended are applied at once
  and the voices of released keys end in their release).
- `prepare()` and `unlock()` together create exactly one `AudioContext` per engine.

## 2. Start-up sequence (`session.ts`)

1. After the shell is mounted: `audioEngine.prepare()`, then `audioEngine.ensureSoundLoaded()` (not awaited by the UI;
   progress through `state` events), then `midiInput.request()` where MIDI exists (research R-5).
2. Install a one-shot first-activation listener on `window` (`pointerdown`, `keydown`; capture; passive) that calls
   `audioEngine.unlock()`; removed after the context reports running. `handlePlay()` still calls `unlock()` too.
3. At start-up, too: `audioEngine.setLatencyCalibration(stored.source === 'measured' ? stored : null)` with
   `stored = settingsStore.loadLatencyProfile()`, and the output rule
   of audio-setup.md section 3.
4. Desktop: `electron/main.ts` sets `webPreferences.autoplayPolicy: 'no-user-gesture-required'` explicitly
   (electron-bridge 1.1.0), so step 1 leaves the context running.

## 3. Live router (single owner of the musician's sound)

`session.ts`'s `midiInput.on` listener is the only code that sounds the musician's input:

| Message | Engine call, always, first | Then |
|---|---|---|
| `noteOn` (velocity > 0) | `liveNoteOn(key, velocity)` | pressed keys, Practice input, calibration tap, Play recording (by their own listeners) |
| `noteOn` velocity 0, `noteOff` | `liveNoteOff(key)` | as above |
| `sustain` | `liveSustain(down)` | as above |
| `deviceLost` | `liveAllOff()` | as today |

- No condition on mode, run phase, Score, popup or calibration (FR-004, FR-005).
- `PlaySessionController` MUST NOT call `liveNoteOn`, `liveNoteOff` or `liveSustain` for input (play-run 2.4.0): the
  reducer's `soundInput` effect is informational only.
- Nothing in this feature calls `liveAllOff()` on a mode switch, run start or stop, or Score change (FR-006).
- While `midiState.liveSound === 'locked'`, the first note-on sets `lockedHintShown` (data-model section 1).

## 4. Tests that pin this contract

- Unit (`tests/engine/live-router.test.ts`, fake engine + fake MIDI): for every state in the FR-004 list (at least 20,
  SC-003) one note-on/note-off pair produces exactly one `liveNoteOn` and one `liveNoteOff`; sustain likewise.
- Unit (`tests/engine/play-session.test.ts`): the controller records input and sends no live command (expected-value
  change, research R-3).
- Unit (`tests/engine/audio/web-audio-engine.test.ts`): `prepare()` without a gesture creates one context and one node;
  `unlock()` after it creates no second one; live messages before `prepare()` are dropped without throwing.
- e2e (chromium, browser): no Score open, fake MIDI note-on before any click -> nothing sounds and the hint shows; after
  one click on the page -> the next note-on reaches the worklet (worklet spy), SC-002.
- e2e (electron project): no click at all, note-on 5 s after the window appears reaches the worklet with the sound
  loaded, SC-001.
