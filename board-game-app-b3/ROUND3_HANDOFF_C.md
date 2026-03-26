# Round 3 Handoff C

## What Is Safe To Review Or Merge Now

- Provider-neutral AI routing contracts and interfaces in `src/ai`.
- Capability registry and model profile catalog structure.
- Cheap-to-strong routing policy skeleton with explicit opt-in handling for non-default models.
- Minimal budget guard interface and static/no-op implementations.
- `InferenceRouter` support for `plan`, `dryRun`, and `infer`.
- Request normalization and task-category presets.
- `createAiRoutingStack` plus `AI_ROUTING_QUICKSTART.md` as the integration entry point and reference.

## What Still Needs Validation

- Real provider adapter implementations against actual SDKs.
- Whether the default `taskType -> minimum strength` mapping matches product expectations.
- Whether the current task-category presets are the right defaults for app behavior.
- Whether route candidate plans expose enough detail for debugging once the app is wired.
- Whether the default example model IDs in the catalog match the providers the app will really use.

## What Future Integration Point Is Now Enabled

- The app can now wire concrete `ProviderAdapter` implementations into `createAiRoutingStack(...)`, call `router.dryRun(...)` to inspect routing safely, and then switch to `router.infer(...)` without changing the surrounding abstraction.

## Likely Overlap Or Conflict Risk With Worker A Or B

- Worker A may be creating runtime composition code and could introduce a parallel way to assemble the router.
- Worker B may add workflow or orchestration code that wants to call providers directly instead of going through the router.
- The safest integration path is for both workers to treat `createAiRoutingStack` and `InferenceRouter` as the single AI entry boundary.
