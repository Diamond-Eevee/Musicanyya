# Sources

This folder contains public-domain reference sources (LilyPond, MIDI, PDFs) against which the library items are checked.

## What may be committed here

- **Public domain or CC0 only**: A source whose page shows any licence other than public domain or CC0 is never used, not even for reference.
- **Files unchanged**: Downloaded files must be committed byte-for-byte unchanged.
- **Source manifest**: Each folder must have a `source.json` adhering to `specs/007-library-fidelity-audit/contracts/source-manifest.md`.

## Adding a source

1. **Owner Approval**: Sources may only be added after the owner has approved them.
2. **Download**: Download the `.ly` and `.mid` from the Mutopia piece page into `content/library/sources/<source-id>/`, unchanged.
3. **Manifest**: Write `source.json`: edition, URL, licence as the page states it, `obtained`, `approvedByOwner`, SHA-256 of each file (`certutil -hashfile <file> SHA256` on Windows, `sha256sum` elsewhere), `midiOrder` and `midiNoteTracks` (inspect once with `pnpm library:fidelity --inspect-midi <path>`).
4. **Third Party Notices**: Add the source to `THIRD_PARTY_NOTICES.md`.

## Rejected sources

The following sources were considered but rejected and must not be used:

| Source | Reason for Rejection |
|---|---|
| Mutopia 659 (Schumann Op. 68 No. 10) | Rejected because it is CC BY-SA 2.5. |
| `github.com/musetrainer/library` | No licence file, MuseScore.com uploads, one marked "All rights reserved", and copyrighted works (spec Clarifications 2026-09-23). |
