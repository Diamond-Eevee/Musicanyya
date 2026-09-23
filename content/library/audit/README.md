# Library Audit Records

This directory contains the audit records for the Musicanyya library. There is one record per shelf item, plus records for removed items. 
The records are authored; the final report (`docs/library-audit.md`) is generated from them.

## Audit Record Contract

The records adhere to the schema and rules defined in the [audit-record contract](../../specs/007-library-fidelity-audit/contracts/audit-record.md).

## Outcomes

Each record specifies an outcome, which means:

- **`verified`**: The item matches the source (or theory rules) exactly as claimed, with no modifications required, or with visual confirmation.
- **`fixed`**: The item was updated to correct a mistake found during the audit (e.g., a wrong note fixed against the source).
- **`replaced`**: The item was replaced entirely by a direct conversion from a verified machine-readable source.
- **`relabelled`**: The item's claims were changed to be accurate (e.g., marked as an arrangement, adding departures, changing title), but the notes themselves were not modified.
- **`removed`**: The item was removed from the library because it could not be verified against a valid public-domain source or violated licensing constraints.
