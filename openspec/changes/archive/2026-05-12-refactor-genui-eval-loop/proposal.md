## Why

`react-ui-dsl` 的 GenUI 评测循环（`pnpm eval start` / `judge` / `verify`）现在是日常验证 DSL 质量的核心工具，但跑一次完整 bench（`--suite benchmark --regen`，44 个 fixture）的端到端耗时和恢复路径都很差：

- **regen 串行调 LLM**：44 次 LLM 调用在 vitest 里挨个走，几分钟才能跑完，且每个 fixture 生成成功就立即写 `.dsl`，进程中途被砍会留下半新半旧的 snapshot，需要人工 `git checkout` 收拾。
- **流水线单体不可恢复**：`cmdStart` 是 `regen → vitest → vite build → screenshot → judge` 的单体流程，任何一步挂了就要从头来，超出 Bash 工具 10 分钟限制时无法用前期结果续跑。
- **verify 全量重判**：`cmdVerify` 把所有 fixture 又跑一遍 vitest + screenshot + judge，即使 agent 只改了 5 个 fixture 相关代码，验证开销和初次 baseline 一样。
- **判分结果只在 JSON 可见**：`buildReportApp` 在 judge 步骤之前就把 `report-data.json` 内联进 `index.html`，judge 完成后写回 JSON 但 HTML 是旧快照，浏览器打开 report 看不到分数和 feedback。

判分并发已经先行修了一版，但根本性的效率和可恢复性问题需要把整个 pipeline 重构一遍，同时正式立项把 eval-loop 作为一个 active capability spec 维护起来——目前 `openspec/specs/` 下没有这块的 active 规格。

## What Changes

- **新增 capability spec**：把 GenUI 评测循环的行为契约写进 `openspec/specs/genui-eval-loop/`，覆盖判分并发、流水线阶段化、verify 增量、report 可视化等要求。
- **regen 阶段重构**：把 fixture DSL 生成从 vitest 里抽出来，作为流水线第一阶段；多 fixture 并发调 LLM（默认并发 6，`EVAL_REGEN_CONCURRENCY` 覆盖），并采用 staging 目录 + 原子 rename 写入 snapshot 目录。中途任何失败 → working tree 不动。
- **流水线阶段化与续跑**：`run.json` 增加 `phases: { regen, render, screenshot, judge }` 状态字段，每个 phase 完成后写入。`pnpm eval start` 进入时跳过已完成 phase，新增 `pnpm eval regen <run-id>` / `pnpm eval render <run-id>` 显式入口；现有 `pnpm eval judge <run-id>` 继续保留。
- **verify 增量判分**：`cmdVerify` 读 `result-bundle/claimed-affected-fixtures.json`，受影响 fixture 重跑 render + screenshot + judge，未受影响 fixture 复用 baseline judge score；vitest 整轮仍跑作为回归门禁。
- **judge 结果按内容哈希缓存**：以 `hash(dsl + screenshot_sha256 + rubric_hash + judge_model)` 作 key，把判分结果缓存到运行间共享的 `eval/.judge-cache/`。命中 → 跳过 LLM 调用。
- **vite build 缓存**：report-app 的 bundle 输出（HTML 模板 + JS/CSS 资源）一次构建到 `eval/.report-app-cache/`，每个 run 直接拷贝资源，只重做 `report-data.json` 注入。
- **增量写 `report-data.json`**：judge 每完成一个 fixture 就 append 写一次，崩溃恢复时配合 #4 的 hash cache 跳过已判 fixture。
- **report-app 显示判分详情**：判分完成后重新注入 `index.html` 的 `<script id="e2e-report-data">`；judge UI 从 `<details>` 折叠改为一级视图——overall 分数提升到 fixture header，feedback 段落和 4 维 ScoreBar 不再需要点击展开，issue chips 直接可见。
- **保留并入文档化**：把已经合入的 `EVAL_JUDGE_CONCURRENCY`（judge 阶段并发）作为 capability 的一部分规格化。

## Capabilities

### New Capabilities

- `genui-eval-loop`：定义 `react-ui-dsl` GenUI 评测循环的端到端行为契约，含 pipeline 阶段化、并发和原子性、判分缓存、verify 增量、report 可视化等要求。

### Modified Capabilities

（无：现有 `openspec/specs/` 下没有覆盖 eval-loop 的 spec，本次为新增。）

## Impact

- **代码**
  - `packages/react-ui-dsl/src/__tests__/e2e/eval-loop.ts`：流水线阶段化、续跑、verify 增量化
  - `packages/react-ui-dsl/src/__tests__/e2e/eval/`：新增 regen 并发模块、judge 缓存模块、phases 状态管理；扩展 `run-manifest.ts`、`judge.ts`、`judge-runner.ts`
  - `packages/react-ui-dsl/src/__tests__/e2e/llm.ts`：从 vitest 内联读写抽离为可独立调用模块
  - `packages/react-ui-dsl/src/__tests__/e2e/dsl-benchmark.test.tsx`（以及 `dsl-e2e.test.tsx` / `dsl-fuzz.test.tsx`）：去掉 `REGEN_SNAPSHOTS=1` 路径下的 LLM 调用，预期 snapshot 已由上游 regen 阶段就绪
  - `packages/react-ui-dsl/src/__tests__/e2e/report-app/main.tsx`：判分 UI 提升为一级视图
- **文档**
  - `packages/react-ui-dsl/README.md`、`.claude/skills/react-ui-dsl-genui-eval-loop/SKILL.md`：补 `EVAL_REGEN_CONCURRENCY`、阶段化命令、verify 行为变化
- **磁盘格式**
  - `runs/<run-id>/run.json` 新增 `phases` 字段（向前兼容：缺失字段时按"全部 phase 未完成"处理）
  - 新增 `packages/react-ui-dsl/src/__tests__/e2e/eval/.judge-cache/` 与 `.report-app-cache/`（加入 `.gitignore`）
- **不影响**
  - DSL 语言契约、组件库 API、运行时行为
  - 已有 archive 下的 `2026-05-08-genui-quality-eval-agent-loop` 历史 change
