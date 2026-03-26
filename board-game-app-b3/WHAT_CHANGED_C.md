# What Changed C

## Files Changed

- `AI_ROUTING_QUICKSTART.md`
- `src/ai/index.ts`
- `src/ai/mock-provider-adapter.ts`

## What Was Implemented

- Added `MockProviderAdapter`, a minimal provider implementation that satisfies `ProviderAdapter` without requiring a real vendor SDK.
- Added `createMockProviderAdapter(...)` as a convenience factory for tests and integration spikes.
- Updated the AI quickstart doc with a mock-adapter example so future wiring can exercise the real `router.infer(...)` path even before a production provider adapter exists.
- Exported the mock adapter from the main `src/ai` surface.

## What Future Integration Point Is Now Enabled

- App code can now choose between:
  - `router.infer({ executionMode: "dry-run", ... })` to inspect routing only
  - `router.infer(...)` with `MockProviderAdapter` to exercise the execution path without a real provider SDK
- This makes it possible for Worker A or B to wire the AI boundary into services or workflows before provider credentials and SDK integrations are finalized.

## What Still Needs Validation

- Real provider adapter implementations still need to be added and tested against actual SDKs.
- The default mock response shape may need tuning if future integration tests expect structured JSON output.
- The quickstart examples should be validated against the eventual app composition path once Worker A or B wires this layer into runtime code.
