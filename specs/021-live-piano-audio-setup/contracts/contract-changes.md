# Contract changes to earlier features (feature 021)

Applied by the implementation tasks, contract first, then code (AGENTS.md section 6). Reasons:
[research.md](../research.md). New contracts of this feature: [live-sound.md](live-sound.md),
[audio-setup.md](audio-setup.md), [top-bar.md](top-bar.md).

| Contract | From -> to | Change |
|---|---|---|
| `001/contracts/ports.md` | 2.2.0 -> **2.3.0** (MINOR) | `AudioEngine`: `prepare()`, `setLatencyCalibration()`, `outputCapability()`, `listOutputs()`, `setOutput()`, `activeOutputId()`, event `outputFallback`; `latencyProfile()` returns the calibration when set. `SettingsStore`: `saveLatencyProfile(profile, outputDeviceId?)`, `loadLatencyOutputDeviceId()`, `clearLatencyProfile()`, `loadAudioOutput()`, `saveAudioOutput()`. Full text: [live-sound.md](live-sound.md) section 1, [audio-setup.md](audio-setup.md) sections 3-4. |
| `003/contracts/play-run.md` | 2.3.0 -> **2.4.0** (MINOR) | `PlaySessionController` no longer sounds input; the `soundInput` effect is informational; the app's live router sounds every message in every state, including the pedal during a run ([live-sound.md](live-sound.md) section 3). The run-start anchoring moves to a shared helper `anchorRunStart()` used by calibration too (no behaviour change). |
| `003/contracts/performance-log.md` | "Latency profile" section, additive | `LatencyProfileFile` gains optional `outputDeviceId`; the writer now writes the wrapper the contract always named (the 003-020 code wrote the bare profile; the reader accepts both). Performance log format unchanged (`LatencyProfile` shape unchanged). |
| `001/contracts/storage.md` | key table, additive | New key `musicanyya.audio.v1` (feature 021, [audio-setup.md](audio-setup.md) section 4). |
| `001/contracts/electron-bridge.md` | 1.0.0 -> **1.1.0** (MINOR) | Main process rules: `webPreferences.autoplayPolicy: 'no-user-gesture-required'` set explicitly; Permissions row gains "permission **check** `media` (audio) allowed for the app origin, so output devices can be listed and chosen; the permission **request** for `media` stays denied". Bridge object unchanged. |
| `004/contracts/ui-shell.md` | 1.5.0 -> **1.6.0** (MINOR) | Slot `#midi-controls` (`mx-midi-status`) after `#menu-controls`; compact fit shows its icon only; panel `'midi'` opened from the bar, allowed during runs (`RUN_OK_PANELS`); Setup menu loses the `midi` entry ([top-bar.md](top-bar.md) sections 1-4). |
| `001/contracts/worklet-protocol.md` | unchanged | No message or processor change: calibration is an ordinary Metronome-only schedule; live messages unchanged. |
| `003/contracts/grading.md` | unchanged | `compensation = output + input` unchanged; a calibrated profile makes the sum equal the measured round trip. |
