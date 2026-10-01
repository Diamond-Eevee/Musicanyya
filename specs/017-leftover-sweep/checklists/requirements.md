# Spec quality checklist: 017-leftover-sweep

- [x] No new design or implementation detail beyond what the moved tasks already state (each FR cites its origin)
- [x] Requirements testable and unambiguous (each maps to a task with a failing-first test or a recorded check)
- [x] Success criteria measurable (status script counts, allocation probe, 3 consecutive e2e runs, recorded results)
- [x] Stories independently testable (US1 unit + RT review; US2 real files; US3 e2e runs; US4 audit; US5 records)
- [x] Edge cases identified (already fixed elsewhere, owner check impossible, unverifiable source, looser threshold)
- [x] Scope bounded (only the 16 moved tasks plus the glide flake; Out of Scope names new behaviour)
- [x] Assumptions listed (tiers kept, no dependency, existing library pipeline)
- [x] One open decision marked for the owner (OD-1 title rule, T018); no [NEEDS CLARIFICATION] markers
