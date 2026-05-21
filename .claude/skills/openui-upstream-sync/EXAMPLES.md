# OpenUI Upstream Sync — Templates

## Sync report

Path: `.sync/reports/<YYYY-MM-DD>-<pkg>.md`

```markdown
# Sync report — 2026-05-21 lang-core

Baseline: `a61223a` (from last sync commit trailer)
Candidates: 23 upstream commits in `packages/lang-core/`
Diverged regions touched: 1 (see Theme 4)

---

## Theme 1: 新增 ?? null-coalescing 运算符
- [ ] take    - [ ] skip    - [ ] defer    - [x] verify-e2e
- Sources:
  - `9f3e1b2` feat(lang-core): add ?? null-coalescing operator
- Files: `src/lexer.ts`, `src/parser.ts`, `src/evaluator.ts`
- Risk: low — pure addition, no signature change.
- Note: touches evaluator → verify-e2e pre-ticked.

## Theme 2: FormatBytes 简化
- [ ] take    - [ ] skip    - [ ] defer    - [ ] verify-e2e
- Sources:
  - `7a2c5d1` refactor(lang-core): simplify FormatBytes to no-param default
  - `b4e8f00` fix: builtin prompt
- Files: `src/builtins/formatBytes.ts`, `src/prompt/builtins.ts`
- Risk: ⚠ HIGH — local `ZOD-USAGE-REPORT.md` mentions custom FormatBytes extension; likely behavior conflict.

## Theme 3: PromptSpec.tools 改名为 PromptSpec.toolSpecs
- [ ] take    - [ ] skip    - [ ] defer    - [ ] verify-e2e
- Sources:
  - `c5d8e91` refactor(lang-core)!: rename PromptSpec.tools to toolSpecs
  - `e2f4a01` chore: update internal callers
- Files: `src/types.ts`, `src/generatePrompt.ts`
- Risk: ⚠ HIGH — breaking change. `react-ui-dsl` consumes `PromptSpec.tools`; taking this will fail verify-β (C1).
- ⚠ 2 files filtered out of scope: upstream commit also updated `packages/react-lang/Renderer.tsx`.

## Theme 4: ScopedRefs threading 修复 [DIVERGED]
- [x] skip  (auto, see .sync/divergence.md:lang-core/evaluator.ts)
- Sources:
  - `d8e1f23` fix(lang-core): propagate scopedRefs through resolveRef
- Reason: local evaluateBinaryExpr was rewritten 2026-05-21 with different ScopedRefs design.
```

## Sync commit message

```
chore(sync): cherry-pick lang-core themes from upstream

Theme 1: 新增 ?? null-coalescing 运算符
Theme 3: PromptSpec.tools 改名为 PromptSpec.toolSpecs (note: requires react-ui-dsl adapter, tracked separately)

Synced-From: thesysdev/openui@9f3e1b2 (packages/lang-core)
Synced-From: thesysdev/openui@c5d8e91 (packages/lang-core)
Synced-From: thesysdev/openui@e2f4a01 (packages/lang-core)
```

Rules:
- Trailer line per actually-taken upstream commit (not per theme).
- Skipped/deferred themes are NOT in trailers — baseline reverse-lookup must reflect what was applied.
- For partial commits (exit-gate triggered): trailer still lists only successful SHAs.

## Repair report

Path: `.sync/reports/<YYYY-MM-DD>-<pkg>-repair.md`

```markdown
# Sync repair report — 2026-05-21 lang-core

## Auto-completed (L0–L1)
- Theme 1 / `9f3e1b2`: A4 context drift — retried with --ignore-whitespace, success.
- Theme 2 / `7a2c5d1`: A3 `src/old-foo.ts` deleted locally (2025-12), stripped hunk from patch.

## Awaiting human review (L2)
- Theme 3 / `b4e8f00`: A1 conflict at `src/evaluator.ts:42-58`
  - Upstream: added ?? short-circuit branch
  - Local: rewrote with ScopedRefs threading
  - Proposal: `.sync/staging/b4e8f00.merged.ts` (ScopedRefs resolve first, then ?? short-circuit)
  - Uncertainty: FormatBytes test not run; possible numeric-coercion edge case
  - Decision: [ ] accept proposal  [ ] hand-edit  [ ] skip theme

## Rejected (L3 — out of scope)
- Theme 5: C1 verify-β failed — `react-ui-dsl` build red
  - Root cause: `PromptSpec.tools` renamed to `toolSpecs` in lang-core, react-ui-dsl still uses `.tools`
  - Out of sync agent's scope (would require editing react-ui-dsl/)
  - Recommended action:
    - Option A: untake Theme 5 (revert this taking)
    - Option B: open separate task `chore(react-ui-dsl): adapt to PromptSpec.toolSpecs rename`

## Divergence registry suggestions
- Theme 3 — if decision is "skip", add to `.sync/divergence.md`:
  `src/evaluator.ts::evaluateBinaryExpr — diverged 2026-05-21, reason: ScopedRefs rewrite`
```

## PENDING_REVIEW.md (exit-gate notification)

Path: `.sync/PENDING_REVIEW.md`

```markdown
# Pending sync review — 2026-05-21 lang-core

Sync partially completed. Committed: 2 themes (see commit `<sha>`).

## Blocked themes

- Theme 3 — L2 merge proposal awaiting review
  See: .sync/reports/2026-05-21-lang-core-repair.md
  Staging: .sync/staging/b4e8f00.merged.ts

- Theme 5 — L3 rejected (react-ui-dsl adapter needed)
  See repair report for options.

## Next steps

1. Open the repair report and decide on each blocked theme.
2. For L2 proposals: review `.sync/staging/*.merged.*`, then either accept (manual apply + commit) or skip.
3. For L3 rejections: open separate adapter tasks, OR re-run sync with those themes unticked.
4. Delete `SYNC_NEEDS_REVIEW.md` at repo root when done.
```

## SYNC_NEEDS_REVIEW.md (untracked, repo root)

```markdown
⚠ Upstream sync incomplete — see .sync/PENDING_REVIEW.md
Created: 2026-05-21
```

Leave this file untracked so `git status` surfaces it in every shell session until manually removed.

## Divergence registry entry

Path: `.sync/divergence.md` (append)

```markdown
- `packages/lang-core/src/evaluator.ts::evaluateBinaryExpr` — diverged 2026-05-21
  Reason: rewrote with ScopedRefs threading; upstream's evaluator no longer compatible.
  Action on upstream change here: default skip, manual review only.
```
