# MusicXML Support

This document lists the supported MusicXML elements.

| Category | Element | Status | Notes |
|---|---|---|---|
| Structure | `<part>` | Supported | |
| Structure | `<measure>` | Supported | |
| Notes | `<note>` | Supported | |
| Notes | `<pitch>` | Supported | |
| Notes | `<rest>` | Supported | |
| Notes | `<tie>` | Supported | |
| Notes | `<grace>` | Supported | Acciaccatura and appoggiatura |
| Notes | `<fingering>` | Supported | Engraved by Verovio; also read by Practice mode for its help overlay (feature 002) |
| Time & Repeats | `<repeat>` | Supported | Backward and forward repeats. Note: middle-barline repeats not supported |
| Time & Repeats | `<ending>` | Supported | Voltas (1., 2. endings) |
| Time & Repeats | `<direction>` | Supported | Jumps (D.C., D.S., To Coda, Fine). Note: mid-measure jumps not supported |
| Time & Repeats | `<sound tempo>` | Supported | Note: continuous changes (rit./accel.) not supported |
| Time & Repeats | `<fermata>` | Unsupported | Ignored for playback |
| Dynamics | `<dynamics>` | Supported | Marks and wedges |
| Instruments | `<midi-instrument>` | Supported | MIDI programs and unpitched percussion |
