# TODO Next C

## Highest-Value Next Tasks

- Add one or two concrete provider adapter implementations behind `ProviderAdapter` without leaking SDK types into the router.
- Add unit tests for:
  - dry-run routing output
  - automatic cheap-first selection
  - explicit regional opt-in behavior
  - blocked-by-budget behavior
  - escalation ordering and fallback execution
  - task-category request normalization
- Decide whether `InferenceRequest` needs stricter schema options for structured outputs beyond `outputMode: "json"`.
- Decide whether dry-run should remain a mode on `infer(...)` only or also surface a dedicated app-level planning endpoint.
- Add richer policy/budget reporting if downstream observability needs rejected-candidate detail beyond the current candidate plan.

## Dependencies On Worker A Or Worker B

- Worker A
  - Should integrate call sites against `createAiRoutingStack` / `InferenceRouter` rather than a provider SDK directly.
  - Should confirm where runtime configuration for provider credentials and deployment policy will live.
- Worker B
  - Should avoid hardcoding provider/model names in UI or workflow layers; use the router surface instead.
  - Should confirm whether any workflow needs task-category defaults or custom routing hints.

## Review First Tomorrow

- Review `src/ai/inference-router.ts` first because Round 3 added the dry-run and planning path.
- Review `src/ai/request-normalization.ts` and `src/ai/task-categories.ts` next because they define how raw requests become routable.
- Review `src/ai/routing.ts` and `src/ai/policy.ts` after that because they still define the core automatic selection and regional opt-in boundaries.
