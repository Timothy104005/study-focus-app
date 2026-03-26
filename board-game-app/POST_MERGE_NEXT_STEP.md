# Post Merge Next Step

## What should happen after the first successful merge

- Treat the Worker B core ingestion foundation as the stable contract base.
- Review Worker C as the next integration slice and merge only its source files if the routing defaults are accepted.
- Keep Worker B's review/compile-gating layer out until confirmed-layer semantics are available.

## Worker direction

- Worker A
  - Remain paused.
- Worker B
  - Narrow.
  - Focus only on tests and targeted alignment for the deferred review/compile-gating layer.
- Worker C
  - Narrow.
  - Focus on integration support, one concrete provider adapter, and tests after the source slice is accepted.

## Highest-value next step for the whole project

- Complete the second staged merge by reviewing and landing Worker C source files into the canonical base without generated output.
