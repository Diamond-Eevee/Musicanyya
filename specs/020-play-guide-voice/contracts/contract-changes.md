# Contract changes to earlier features (feature 020)

Applied by the implementation tasks, contract first, then code (AGENTS.md section 6). Reasons:
[research.md](../research.md). New contract of this feature: [guide-voice.md](guide-voice.md).

| Contract | From -> to | Change |
|---|---|---|
| `003/contracts/play-run.md` | 2.2.0 -> **2.3.0** (MINOR) | `PlayScheduleOptions.guide` (required), `PlaySchedule.guideChannel`; rule 1 amended (graded events move to the guide channel when guiding); new rules on the guide channel, accompaniment independence and count-in. Full text: [guide-voice.md](guide-voice.md) §1-§2. |
| `019/contracts/mixer-levels.md` | 1.0.0 -> **1.1.0** (MINOR) | §1 item 2: the Orchestra slider is never disabled; on a Score without an Orchestra it shows the guide hint (`levels.guideVoice`, replaces `levels.noOrchestra`). §5 behaviour gains "Play run without an Orchestra: the level governs the Guide voice". [guide-voice.md](guide-voice.md) §3. |
| `001/contracts/worklet-protocol.md` | 1.6.1 -> **1.7.0** (MINOR) | (a) The tick-0 setup of every used channel except `METRONOME_CHANNEL` always contains CC7 (`volume ?? DEFAULT_CHANNEL_VOLUME` = 100) and CC10 (`pan ?? DEFAULT_CHANNEL_PAN` = 64), so no channel keeps a previous schedule's volume or pan (research R-10, spec FR-015); the Metronome channel's CC7 stays the session's `channelVolume`. No message shape and no worklet change. (b) Wording: `orchestraMask` = the channels the Orchestra level governs: Orchestra instruments, or the Guide voice's channel in a Play run. |
| `003/contracts/grading.md` | unchanged | Grading reads no schedule; stated in [guide-voice.md](guide-voice.md) §4. |
