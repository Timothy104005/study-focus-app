# Merge Recommendation

## Recommended merge order

1. Re-establish the real canonical `board-game-app` base and confirm its package/build conventions.
2. Review and merge Worker B from `board-game-app-b2` into `src/ingestion` first.
3. Review and merge Worker C from `board-game-app-b3` into `src/ai` second.
4. Hold Worker A until `board-game-app-b1` or `MORNING_REPORT_A.md` exists.

## Likely non-conflicting areas

- Worker B `src/ingestion/**`
- Worker C `src/ai/**`
- Worker-local report and TODO files

## Likely conflict areas

- Root package/build setup such as `package.json`, `tsconfig`, module target, and declaration output
- Root barrel exports such as `src/index.ts`
- Shared config, runtime wiring, and app-level dependency boundaries once the canonical repo appears
- Any confirmed IR naming that must align between Worker A and Worker B

## Review before merging

- Worker B
  - Review `contracts.ts` before merge because it defines the long-lived ingestion schema.
  - Review `validation.ts` before merge because it defines structural rules and traceability expectations.
- Worker C
  - Review `routing.ts` before merge because it defines the default automatic-selection behavior.
  - Review `policy.ts` and `config/default-model-profiles.ts` before merge because they control opt-in semantics and provider assumptions.
- Both workers
  - Validate naming, module format, and export conventions against the real canonical repo before copying files.
