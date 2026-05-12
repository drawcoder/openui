# GenUI Eval Loop Refactor - Complete

All 61 tasks done. Eval loop fully working end-to-end on Windows.

## Running the Eval Loop

```bash
cd packages/react-ui-dsl

# Full pipeline (vitest render + screenshot + judge)
pnpm eval start --suite e2e

# Step-by-step
pnpm eval regen --suite e2e        # generates DSL snapshots
pnpm eval render <run-id>          # vitest render phase only
pnpm eval judge <run-id>           # screenshot + judge

pnpm eval status <run-id>          # shows phases: regen|render|screenshot|judge
pnpm eval cache:clear              # clear judge hash cache
```

## Judger Config (`.env`)

`claude-code` runner doesn't work inside a Claude Code session (403 on nested auth).
Using `llm-api` with Qwen VL instead:

```
EVAL_JUDGE_RUNNER=llm-api
LLM_JUDGE_MODEL=qwen-vl-max
LLM_API_KEY=<dashscope key>
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

## Key Fixes Applied in Finish-Up

- `report-app-cache.ts` — was missing `__dirname` (ESM crash); cache now saves only Vite artifacts (index.html + assets/), not the whole run dir
- `judge-runner.ts` — `resolveRunnerType` now handles `"llm-api"` (was falling back to gemini)
- `eval-loop.ts` — `cmdStart` reportDir fixed; `buildReportApp` wired to cache; incremental judge mutex; `cmdRegen`/`cmdRender` implemented; phases in `cmdStatus`
- `css-stub-loader.mjs` + `css-stub-hooks.mjs` — tsx can't handle CSS; stubs CSS imports via `module.register()` hooks
- `package.json` eval script — uses `--import ./css-stub-loader.mjs`; vitest called directly (avoids `pnpm exec` triggering workspace prepare)
- `packages/openui-cli/package.json` — `build:templates` now uses cross-platform `node -e` instead of Unix shell
- `tsconfig.json` — added `@openuidev/react-lang` and `@openuidev/lang-core` path aliases for tsx resolution
- `regen.test.ts` — new unit tests for concurrency cap, atomic rename, failure isolation
- `judge.test.ts` — new cache unit tests (hit on repeat, miss on rubric/DSL change)
