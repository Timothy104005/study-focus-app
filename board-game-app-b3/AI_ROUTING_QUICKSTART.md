# AI Routing Quickstart

This folder contains a provider-neutral routing slice under `src/ai`.

## Minimal Assembly

```ts
import {
  createAiRoutingStack,
  NoopBudgetGuard,
  type ProviderAdapter,
} from "./src/ai";

const providers: ProviderAdapter[] = [
  // Add concrete adapters here.
];

const ai = createAiRoutingStack({
  providers,
  budgetGuard: new NoopBudgetGuard(),
});

const result = await ai.router.infer({
  taskType: "summarization",
  messages: [{ role: "user", content: "Summarize this game log." }],
  priority: "cost",
});
```

## Dry Run

Use dry-run mode to inspect routing without invoking a provider adapter:

```ts
const planOnly = await ai.router.infer({
  taskType: "extraction",
  executionMode: "dry-run",
  messages: [{ role: "user", content: "Extract the scoring summary." }],
});

console.log(planOnly.route.selectedModelId);
console.log(planOnly.route.candidatePlan);
```

## Mock Adapter

Use the mock adapter when you want to exercise the real `infer(...)` path
without wiring a vendor SDK yet:

```ts
import {
  createAiRoutingStack,
  MockProviderAdapter,
} from "./src/ai";

const providers = [
  new MockProviderAdapter({
    descriptor: {
      providerId: "openai",
      displayName: "Mock OpenAI",
      providerPath: "primary",
      enabled: true,
      regions: ["global"],
    },
  }),
];

const ai = createAiRoutingStack({ providers });

const result = await ai.router.infer({
  taskType: "summarization",
  messages: [{ role: "user", content: "Summarize the board state." }],
});
```

## Task Categories

Optional task categories can prefill routing hints without implementing a full workflow:

```ts
const result = await ai.router.infer({
  taskType: "generation",
  taskCategory: "multimodal-assist",
  inputAssets: [{ kind: "image", uri: "https://example.com/board-state.png" }],
  messages: [{ role: "user", content: "Explain the likely next move." }],
});
```

## Explicit Regional Optional Opt-In

Regional low-cost models stay out of automatic routing by default.
To allow that path intentionally:

```ts
import {
  createAiRoutingStack,
  createRegionalOptionalDeploymentPolicy,
} from "./src/ai";

const ai = createAiRoutingStack({
  providers,
  defaultDeploymentPolicy: createRegionalOptionalDeploymentPolicy(),
});
```

## What This Layer Owns

- provider-neutral request/result contracts
- request normalization for task-category defaults and multimodal capability hints
- model capability catalog and filtering
- cheap-to-strong route selection
- budget/policy guard hooks
- dry-run routing inspection
- mock execution without a real provider SDK
- execution orchestration across fallback candidates

## What This Layer Does Not Own

- ingestion pipelines
- UI/runtime wiring
- provider credential management
- persistence or quota ledgers
