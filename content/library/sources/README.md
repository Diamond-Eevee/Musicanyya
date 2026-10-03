# Sources

This folder contains public-domain reference sources (LilyPond, MIDI, PDFs) against which the library items are checked.

## What may be committed here

- **Accepted licences**: public domain, CC0, and (since 2026-10-01, feature 019 FR-025) CC BY and CC BY-SA 2.0, 2.5, 3.0 or 4.0, written as SPDX ids (`CC-BY-4.0`, `CC-BY-SA-3.0`, ...). Any other licence (NonCommercial, NoDerivatives, none stated) is never used, not even for reference.
- **Attribution**: a CC BY or CC BY-SA source names its author in `credit`, as the source page names them; the credit and the licence also go into `THIRD_PARTY_NOTICES.md`. An item made from a CC BY-SA source carries the same licence (share-alike); songs and exercises written for this project stay CC0 and are never based on such a source.
- **Files unchanged**: Downloaded files must be committed byte-for-byte unchanged.
- **Source manifest**: Each folder must have a `source.json` adhering to `specs/007-library-fidelity-audit/contracts/source-manifest.md`.

## Adding a source

1. **Owner Approval**: Sources may only be added after the owner has approved them.
2. **Download**: Download the `.ly` and `.mid` from the Mutopia piece page into `content/library/sources/<source-id>/`, unchanged.
3. **Manifest**: Write `source.json`: edition, URL, licence as the page states it, `obtained`, `approvedByOwner`, SHA-256 of each file (`certutil -hashfile <file> SHA256` on Windows, `sha256sum` elsewhere), `midiOrder`, `midiNoteTracks` and `midiArticulate` (inspect once with `pnpm library:fidelity --inspect-midi <path>`, which also reads the `.ly` beside it and says whether its `\midi` score unfolds repeats or uses `\articulate`), and `multiPart` - whether a multi-part (ensemble / SATB / orchestral) version of the work exists: `available`, and when it does `where` (its URL; the source's own `url` when the source is that version), `licence` as that page states it and a `note` on the instrumentation (source-manifest 1.4.0; required by `tests/library/fidelity.test.ts` for every source a song definition of feature 022 uses, so a later Orchestra feature can find it).
4. **Third Party Notices**: Add the source to `THIRD_PARTY_NOTICES.md`.

## Rejected sources

The following sources were considered but rejected and must not be used. Rows refused only for a CC BY or CC BY-SA licence were refused under the rule before 2026-10-01; such a source may be proposed again, and needs the owner's approval like any new source.

| Source | Reason for Rejection |
|---|---|
| Mutopia 659 (Schumann Op. 68 No. 10) | Rejected because it is CC BY-SA 2.5. |
| Mutopia 1590 (Chopin Nocturne Op. 9 No. 2) | Rejected because it is CC BY-SA 3.0 (017 T024, 2026-09-30); no other machine-readable edition found on Mutopia. |
| Mutopia 263 (Joplin, The Entertainer; public domain) | Not added (017 T023/T053; owner answer 2026-10-01: leave it out): downloaded, converted with 0 differences and removed again - one hand spans 15 semitones in bars 58 and 66 (criterion 16 allows 14 at Advanced), and its ties into the second endings need a converter change. Hashes: `entertainer.ly` 3a07fcf4...544f7d, `entertainer.mid` 33e4e81e...a467f066. |
| `github.com/musetrainer/library` | No licence file, MuseScore.com uploads, one marked "All rights reserved", and copyrighted works (spec Clarifications 2026-09-23). |
| Mutopia 1121 (Auld Lang Syne, Horetzky guitar version) | Not used (feature 011, 2026-09-26): sixteenth notes, a very high register, a pickup inside a repeated section and a first ending mean it cannot be a Beginner song; downloaded, checked against its MIDI, and removed again. |
| Mutopia 521 (Stille Nacht) | Rejected because it is CC BY-SA 2.0 (feature 011 research R9; Mutopia 1295 is the public-domain Stille Nacht used instead). |
| Mutopia 1641 (Old Folks at Home), 1832 (Amazing Grace) | Rejected because they are CC BY-SA 3.0 / CC BY-SA. |
| Mutopia Swedish dances | Rejected because they are CC BY 2.5 (attribution licence). |
| House of the Rising Sun, Kumbaya, Scarborough Fair (familiar tune), Hush Little Baby, Happy Birthday, 1960s versions of Michael Row the Boat Ashore | Rejected for copyright risk (feature 011 research R9). |
| Frere Jacques, London Bridge, Skip to My Lou, Red River Valley, Shenandoah, Wayfaring Stranger, Aura Lee | Not found in a clean public-domain source on Mutopia (research R9, 2026-09-26); not used. |
