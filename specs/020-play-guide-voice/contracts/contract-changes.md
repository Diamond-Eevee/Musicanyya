# Contract changes to earlier features (feature 020)

Applied by the implementation tasks, contract first, then code (AGENTS.md section 6). Reasons:
[research.md](../research.md). New contract of this feature: [guide-voice.md](guide-voice.md).

| Contract | From -> to | Change |
|---|---|---|
| `003/contracts/play-run.md` | 2.2.0 -> **2.3.0** (MINOR) | `PlayScheduleOptions.guide` (required), `PlaySchedule.guideChannel`; rule 1 amended (graded events move to the guide channel when guiding); new rules on the guide channel, accompaniment independence and count-in. Full text: [guide-voice.md](guide-voice.md) §1-§2. |
| `019/contracts/mixer-levels.md` | 1.0.0 -> **1.1.0** (MINOR) | §1 item 2: the Orchestra slider is never disabled; on a Score without an Orchestra it shows the guide hint (`levels.guideVoice`, replaces `levels.noOrchestra`). §5 behaviour gains "Play run without an Orchestra: the level governs the Guide voice". [guide-voice.md](guide-voice.md) §3. |
| `001/contracts/worklet-protocol.md` | 1.6.1 -> **1.6.2** (PATCH, wording) | `orchestraMask` = the channels the Orchestra level governs: Orchestra instruments, or the Guide voice's channel in a Play run. No message or behaviour change. |
| `003/contracts/grading.md` | unchanged | Grading reads no schedule; stated in [guide-voice.md](guide-voice.md) §4. |
