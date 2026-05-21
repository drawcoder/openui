# OpenUI Upstream Sync — Reference

## Failure classification

When a patch fails to apply or verify fails, classify into one of these. The class drives the repair action.

| Code | Trigger | Class | Repair |
|---|---|---|---|
| **A1** | 3-way merge conflict in a function/region the local fork has rewritten | Healthy divergence | Level 2 (1 proposal, human review) |
| **A2** | `error: No such file or directory` — upstream path doesn't exist locally (structural fork) | Structural divergence | Reject — suggest divergence registry entry |
| **A3** | Deleted-file conflict — local has removed a file upstream still edits | Healthy local pruning | Level 1 — strip hunk |
| **A4** | Hunk fails at line X but no semantic conflict (whitespace/context drift) | Mechanical | Level 1 — retry with `--ignore-whitespace` |
| **B1** | Package-internal test/fixture missing | Missed fixture in pathspec | Investigate — likely scope/pathspec leak |
| **B2** | Package-internal test fails after apply | Took feature commit but skipped its test-update commit | Reject — flag wrong theme grouping |
| **C1** | `react-ui-dsl` build red (downstream API consumer broke) | Adapter debt | Reject — never auto-fix downstream |
| **C2** | DSL snapshot render diff in `test:e2e` | DSL contract drift | Human decides: accept new contract + regen (outside sync) OR untake theme |
| **D1** | Cross-package type chain broken (took lang-core type change, but upstream's react-lang adapter was filtered out) | Pathspec side-effect | Reject — never auto-write adapter |

## Repair levels

| Level | Scope of agent action | Default | Examples covered |
|---|---|---|---|
| **L0** | Mechanical retry (no code understanding) | ✅ On | A4 |
| **L1** | Patch trimming (drop hunks for files no longer present) | ✅ On | A3 |
| **L2** | Smart merge proposal for in-scope conflicts | ⚠ Per-theme, **1 attempt only**, human review required | A1 |
| **L3** | Auto-adapt downstream code (e.g., react-ui-dsl) | ❌ Rejected | C1, D1 |
| **L4** | Fully autonomous debug-and-fix loop | ❌ Rejected | n/a |

L3/L4 are rejected because they break the scope contract — sync must never write outside the two target packages.

## Exit gates

The agent must stop and switch to "pending" flow when any of:

| Gate | Trigger |
|---|---|
| Level 2 exhausted | Merge proposal attempted once and failed (or verify red on proposal) |
| Multi-class failure | A single patch triggers ≥ 2 failure codes (e.g., A1 + B2) |
| Runtime budget | Total wall-clock > 10 minutes from Phase 3 start |
| Token budget | Cumulative agent token spend exceeds project ceiling |
| Verify regression | β build/test failure not attributable to a single taken theme |

On any gate trigger: commit what already succeeded (trailer lists actual taken SHAs only), then three-channel notify (chat echo + `.sync/PENDING_REVIEW.md` + root `SYNC_NEEDS_REVIEW.md`).

## Divergence registry

`.sync/divergence.md` records points where local has permanently diverged from upstream. Future sync runs default to `skip` for any upstream commit touching these.

Format:

```markdown
# Divergence registry

## packages/lang-core

- `src/evaluator.ts::evaluateBinaryExpr` — diverged 2026-05-21
  Reason: local rewrote with ScopedRefs threading; upstream's expression evaluator no longer compatible.
  Action on upstream change here: default skip, manual review only.

- `src/parser/expr.ts` — diverged 2026-03-10
  Reason: local split monolithic parser.ts into parser/ directory; upstream still has single-file parser.
  Action: A2 will fire; do not attempt structural mapping.
```

When agent generates Phase 2 report, it consults this registry and pre-fills `[x] skip` + `(diverged YYYY-MM-DD — <reason>)` annotation for matching themes.

## Baseline reverse-lookup command

```bash
git log --grep='Synced-From:.*<pkg>' -n 1 --pretty=%B \
  | git interpret-trailers --parse --if-missing=doNothing \
  | grep '^Synced-From:' | grep '<pkg>' | tail -1 \
  | sed -E 's/Synced-From: [^@]+@([a-f0-9]+) .*/\1/'
```

If no match (first sync ever): use `git rev-list --max-parents=0 upstream/main | head -1` as initial baseline.

## Why these choices (one-liners)

- **No baseline file, trailer instead** — single source of truth, action and metadata co-located.
- **`git diff` + `git apply --3way`, not `cherry-pick`** — `cherry-pick` doesn't accept pathspec; can't enforce scope.
- **3-way base from fetched blobs** — after `git fetch upstream`, all upstream blobs sit in `.git/objects` even without shared history.
- **Themes over commits** — agent compresses N commits into M themes; human reviews M, agent re-expands to N for execution.
- **L2 single attempt** — multi-attempt repair drifts toward L4 autonomy, which loses scope guarantees.
- **(γ-1) partial commit** — preserves progress in low-frequency sync; trailer accurately reflects what was actually taken.
- **Forbid `:regen`** — regen would launder real regressions into new "good" baselines.
