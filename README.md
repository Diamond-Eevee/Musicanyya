# Musicanyya

A sheet-music practice app in the spirit of Piano Marvel. Open a MusicXML score, see it engraved like a printed
music book, and practise it with a MIDI keyboard:

- **Listen**: the app plays the score with a moving cursor.
- **Practice**: the app waits for you to play the right note or chord before it moves on.
- **Play**: the metronome runs and the music keeps going; afterwards every note is graded (correct, wrong, missed,
  extra, early, late).
- **Advice**: fingering, hand position and tips from JSON files, shown on the score.

It runs in the **browser**, as an **Electron desktop app**, and with an optional **native audio plugin** for
low-latency audio (ASIO / WASAPI / ...).

Built with framework-free TypeScript, HTML5 and CSS3; Verovio for engraving (SVG) with a canvas overlay; Web Audio
and Web MIDI.

Status: project set-up. Rules: [.specify/memory/constitution.md](.specify/memory/constitution.md). Stack:
[docs/adr/0001-technology-stack.md](docs/adr/0001-technology-stack.md). Contributors and AI agents: start with
[AGENTS.md](AGENTS.md).
