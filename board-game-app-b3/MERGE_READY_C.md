# Merge Ready C

## Likely Safe To Merge Now

- Provider-neutral AI routing contracts and interfaces in `src/ai`.
- Capability registry and model profile catalog structure.
- Cheap-to-strong routing policy skeleton with explicit opt-in handling for non-default models.
- Minimal budget guard interface and static/no-op implementations.
- `InferenceRouter` execution coordination across fallback candidates.
- `createAiRoutingStack` as the minimal assembly point for future integration.
- `AI_ROUTING_QUICKSTART.md`, `MORNING_REPORT_C.md`, and `TODO_NEXT_C.md` as handoff docs.

## Still Needs Review Before Merge

- Naming of concrete example model IDs in the default catalog.
- Whether `DeploymentPolicy` fields align with how the app will actually express compliance and regional restrictions.
- Whether escalation on provider failure is enough for the first integration, or if semantic retry rules will also be needed later.
- Whether the default `taskType -> minimum strength` mapping in `routing.ts` matches product expectations.

## Likely Overlap Or Conflict Risk With Worker A Or B

- Worker A may be creating runtime wiring or service composition code and could introduce a parallel router assembly path.
- Worker B may add workflow or orchestration code that wants to call providers directly instead of going through `InferenceRouter`.
- The safest merge order is for Workers A and B to consume `createAiRoutingStack` / `InferenceRouter` rather than inventing separate provider-selection boundaries.

## Future Integration Point Now Enabled

- The app can now wire concrete `ProviderAdapter` implementations into `createAiRoutingStack(...)` and obtain a ready-to-use `router.infer(...)` surface with default catalog, policy, and fallback behavior already assembled.
