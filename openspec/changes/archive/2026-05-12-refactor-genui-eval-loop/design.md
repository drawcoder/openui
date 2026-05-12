## Context

`packages/react-ui-dsl` 现在的 eval loop 由 `eval-loop.ts` 编排，几个核心阶段交织在一起：

- `runVitest` 启动一个 vitest 子进程，在 `dsl-benchmark.test.tsx` 等套件里串行执行每个 fixture——其中 `loadOrGenerate`（`llm.ts:20`）在 `REGEN_SNAPSHOTS=1` 时同步写入 `.dsl` snapshot。
- vitest 完成后 `buildReportApp` 一次性把 `report-data.json` 内联进 `index.html`，随后 `captureFixtureScreenshots` 启动 Playwright 抓 `.preview-shell`，再串行调用 `judge.ts:judgeFixtures` 评分。
- `judgeFixtures` 上周刚改为有界并发 worker pool（默认 6，`EVAL_JUDGE_CONCURRENCY` 覆盖），并把 `spawnSync` 改成异步 `spawn`，已经合入。

实际使用中暴露的痛点：

1. **regen 串行 + 立即写文件**：44 fixture × 数秒 LLM 调用 → 串行几分钟；vitest 进程被砍后只生成了一半 `.dsl`，需要人工 `git checkout`。
2. **整条流水线不可恢复**：超出 Bash 10 分钟限制时已完成的 regen / screenshot 无法续用，必须 `pnpm eval start` 从头来。
3. **verify 整轮全量重判**：即便只动了几个 fixture，verify 仍跑完整 vitest + screenshot + judge 流程，几乎和 baseline 一样昂贵。
4. **report HTML 拿不到分数**：`buildReportApp` 在 judge 之前内联报告数据，judge 完成后只写回 `report-data.json`，`index.html` 看不到分数与 feedback。

约束：

- 不能丢掉 vitest 在 fixture 解析/渲染失败时的报错诊断价值。
- 评测脚本运行在 Node + Windows 与 Linux 之间，子进程并发已经被验证可行（judge runner 阶段）。
- snapshot 目录是 git 跟踪的，原子性是硬要求。
- judge runner 仍走 `codex` / `claude-code` / `llm-api` 三种 backend，并发同样适用。

## Goals / Non-Goals

**Goals:**

- 把 eval pipeline 拆成 `regen` / `render` / `screenshot` / `judge` 四个独立可恢复的阶段，每个阶段写入 `run.json` 的 `phases` 字段。
- regen 阶段并发调用 LLM 并采用 staging 目录 + 原子 rename 写入 snapshot。
- verify 阶段读 `claimed-affected-fixtures.json` 做增量判分，未受影响 fixture 复用 baseline 分数。
- judge 结果按内容哈希缓存，rubric 或 model 变更自然失效。
- vite build 一次缓存，跨 run 复用，源码变更自动失效。
- judge 阶段每完成一个 fixture 就持久化分数；崩溃恢复时跳过已判 fixture。
- `index.html` 在 judge 完成后重新注入最新 `report-data.json`；`report-app` UI 把 feedback、四维 ScoreBar、issue chips、overall 分数从 `<details>` 折叠改为一级视图。

**Non-Goals:**

- 不抛弃 vitest，render 阶段继续使用 vitest 跑 `dsl-benchmark.test.tsx` 等套件来获得诊断输出。
- 不把 judge 改成 batch（一次发多个 fixture），保持每 fixture 一次 prompt 的判分稳定性。
- 不引入跨 run 的全局 history 单文件（继续每个 run 自带 `eval-history.json`）。
- 不实现 adapter 模板预编译（用户已明确去掉）。
- 不变更 DSL 语言、组件库或运行时行为。

## Decisions

### 决策 1：phases 状态以 `run.json` 单一字段表达

**选择**：在 `RunManifest` 增加 `phases: { regen?: 'done' | 'failed'; render?: ...; screenshot?: ...; judge?: ... }`，每个阶段成功结束后写一次。

**替代**：每个阶段单独写一个 `phase-<name>.json` 标记文件。

**理由**：

- `run.json` 已经是 run-level 的事实真源；单点写入避免多文件之间一致性问题。
- 字段缺失 → 视作"未完成"，对老 run 自然向前兼容。
- `phases.<name> = 'failed'` 时可以保留失败上下文，方便人或后续命令针对性重试。

### 决策 2：regen 阶段彻底脱离 vitest，单独走 Node

**选择**：新增 `eval/regen.ts` 模块，由 `cmdRegen` / `cmdStart` 直接调用——并发用 `Promise` worker pool（复用 judge 的模式），输入是从 `benchmark-loader` / `loadBenchmarkCases` 读出的 fixture 列表，输出写入 `eval/.regen-staging/<run-id>/<fixture-id>.dsl`，全部成功后 `renameSync` 进入 `benchmark-snapshots/`（或对应 suite 的 snapshot 目录）。

vitest 套件中 `loadOrGenerate` 在 `REGEN_SNAPSHOTS=1` 路径下的 LLM 调用 MUST 被移除，转为"snapshot 文件必须存在；否则抛错指导用户先跑 `pnpm eval regen`"。`REGEN_SNAPSHOTS=0` 行为保持不变。

**替代**：保留 vitest 内部 regen，靠 vitest 的 concurrent describe + 写入临时目录 + 后置移动。

**理由**：

- vitest 的并发模型是为"测试断言并行"设计的，做"协调写入 + 全成功后 commit"反而需要钻 vitest API 的牛角尖。
- 把 LLM 调用搬出来后，render 阶段的 vitest 角色更纯——只读 snapshot、parse、render、断言、写 report-data。
- 同时也让 `pnpm eval regen <run-id>` 单独入口的语义自然成立。

### 决策 3：rename 在同分区完成原子写

**选择**：staging 目录放在 `eval/.regen-staging/<run-id>/`，与 snapshot 目录同盘符（仓库内）。全部成功后逐文件 `renameSync` 覆盖目标。所有 rename 之间允许出现短暂"部分新"窗口，但**单文件 rename 是原子的**，对 git 来说每个 `.dsl` 只在最后一刻被完整替换。

**替代**：用单个 tar/zip 一次性解压，或在 git 层做 `git stash`。

**理由**：

- 跨平台简单可靠，`fs.rename` 在同盘符上是原子操作。
- "全部成功才 rename"保证了"用户中断 → 一个文件都不被替换"。
- 假如用户主动 kill 在多个 rename 之间，受影响窗口非常短（<100ms 级别），且仍处在 staging→snapshot 的同方向迁移，不会回退。

### 决策 4：judge cache 用单文件 SQLite-less 设计（JSON-per-key）

**选择**：缓存目录 `eval/.judge-cache/<key-prefix>/<key>.json`，key 是 `sha256(dsl_text + screenshot_sha256 + rubric_text + judge_model)` 的 hex；按前 2 hex 字符分子目录避免单目录文件过多。

**替代**：用 SQLite、用单一 JSON 索引文件、用 LMDB 等。

**理由**：

- 当前评测规模（每次 ≤ 50 fixture，run 数量也是数十到数百）远不需要数据库。
- 单文件 per key 让"看哪些缓存条目存在/手动清理某条"成本极低。
- 与 `report-data.json` 持久化策略一致（人可读 JSON）。
- 加入 `.gitignore`，不进入版本控制。

`rubric_text` 的取法：从 `rubric.ts:DEFAULT_RUBRIC` 与 `calibrated-rubric.md`（若 run 内存在）实际渲染出的完整 prompt 文本，不只是版本号——这样自动跟随任何 rubric 编辑。

### 决策 5：vite build 缓存以"源码 + 依赖摘要"为 key

**选择**：每次 `buildReportApp` 之前计算 `hash(report-app 源码文件树 + package.json deps 版本)`。共享缓存目录 `eval/.report-app-cache/<hash>/` 存 `index.html`、`assets/` 等产物。命中 → 直接拷贝到 run 工作区，再单独注入 `report-data.json`；未命中 → 跑 vite build 写入缓存。

**替代**：完全用 vite 自身的 build cache（位于 `node_modules/.vite/`）；或用 dev server 跳过 build。

**理由**：

- vite 的 incremental cache 只在 dev/watch 模式下有效，build 模式每次仍会重新 emit 产物到目标目录。
- dev server 不适合截图阶段（需要稳定的 file://-style 路径供 Playwright 访问 + 后续可重开 HTML 文件）。
- 自管哈希让缓存 invalidation 完全可控，与 git 状态无关。

### 决策 6：verify 增量判分以 `claimed-affected-fixtures.json` 为信源

**选择**：

- 受影响 fixture（在 claimed 列表里的）→ 重跑 render（vitest 该 fixture）+ screenshot + judge runner，结果覆盖到 baseline。
- 未受影响 fixture → 复用 baseline `judge_scores`，但 vitest 整轮仍跑，作为"agent 没有把其它 fixture 弄崩"的回归门禁。
- 若 vitest 在未受影响 fixture 上失败 → 标记为 regression 并降级分数为 0（沿用 `makeFailedFixtureScore` 语义）。

**替代**：随机抽样若干未受影响 fixture 也重判（"信任但抽查"）。

**理由**：

- 抽样会带来非确定性 score 波动，使得 verify 通过/失败结果不可重现，对工作流体验更差。
- vitest 整轮回归本身已经把"agent 是不是把别的 fixture 弄崩"的风险覆盖掉了。

### 决策 7：增量持久化 judge score 直接复用 `report-data.json`

**选择**：judge worker 每完成一个 fixture 就：

1. 读当前磁盘上的 `report-data.json`
2. 合并新 `JudgeScore` 到 `judge_scores` 数组与对应 `entries[].judgeScore`
3. 写回磁盘（原子写：先写 `.tmp` 再 rename）

并发场景下用一把 in-process mutex 串行化写入。

**替代**：写到一个独立的 `judge-progress.jsonl`，最后再合并。

**理由**：

- 单一事实源，少一种文件状态。
- 流水线后续阶段（report 注入、verify 计算 delta）本来就读 `report-data.json`，不需要额外路径。

### 决策 8：report HTML 注入由 `injectReportData(reportDir)` 统一负责

**选择**：抽出独立函数 `injectReportData(reportDir)`，找到 `index.html` 里的 `<script id="e2e-report-data" type="application/json">…</script>`，用最新 `report-data.json` 内容替换。该函数被以下时机调用：

- `buildReportApp` 末尾（首次注入）
- judge 阶段每次写完 `report-data.json` 之后（保证 HTML 与 JSON 同步）
- verify 结束写入新分数与 delta 之后

**替代**：让 report-app 在浏览器里 `fetch('./report-data.json')`。

**理由**：

- 用户经常直接 `file://` 双击 `index.html` 看报告，浏览器对 `file://` 下的 fetch 默认拒绝。
- 注入函数轻量，几行字符串替换。

### 决策 9：report-app UI 提升不引入新组件库

**选择**：在 `main.tsx` 的 `PreviewCard` / `JudgeScorePanel` 里直接调整结构与 CSS——把 feedback、4 维 ScoreBar、issue chips 移出 `<details>`；overall 分数提到 header；degraded 标识用一个 `.judge-degraded-banner` class。不引入 antd、shadcn 之类第三方组件库。

**理由**：

- 当前 report-app 是 vite + 纯 React，无 UI 库依赖；为了一次微调引入大依赖会显著放大 bundle 体积和 build 时间，影响 #5 的缓存收益。
- 视觉变更本身是几个 `<div>` + CSS 的事，原生足够。

## Risks / Trade-offs

- **regen 并发触发上游 rate limit** → 默认并发 6 留出余量，提供 `EVAL_REGEN_CONCURRENCY=2` 降级；DashScope / 各家 API 的 RPM 在文档中可查，6 远低于默认配额。
- **rename 顺序在 100ms 级窗口内被中断** → 单文件 rename 仍原子；如确实被中断，下一次执行会发现 staging 还存在并提示用户清理，加上 `pnpm eval regen <run-id>` 可重跑覆盖。
- **judge cache 跨 run 共享导致脏数据** → key 包含 `dsl`、`screenshot_sha256`、`rubric_text`、`judge_model` 四要素；任何一项变化都自然 miss。提供 `pnpm eval cache:clear` 兜底（在 `eval-loop.ts` 加个简单命令）。
- **verify 增量复用 baseline 分数 hide 了某些场景** → 当 agent 改了组件实现影响多个 fixture 但忘了写入 `claimed-affected-fixtures.json`，verify 会给出虚假的稳定分数。缓解：在 verify 输出中显式列出"复用 baseline 的 fixture id 数量"，让 reviewer 一眼能看出风险范围；同时 vitest 整轮回归门禁仍能抓到 render 层崩坏。
- **vite build 缓存因为环境差异未命中** → key 仅含源码 + deps 版本；node 版本、操作系统等差异不进 key。第一次跨机器跑会重新 build，可以接受。
- **report HTML 注入和 `report-data.json` 写入时序错位** → 全部走 `injectReportData` 单一函数，且每次写 JSON 后立即注入；in-process 串行化，不存在并发竞态。

## Migration Plan

1. 现有 run 工作区（含 archive 之外的所有 `runs/<run-id>/`）的 `run.json` MAY 缺少 `phases` 字段——代码读到缺失时按"无任何 phase 完成"处理。
2. 现有 `pnpm eval start` 行为保持完全兼容：默认行为下仍编排所有阶段；只有显式调用 `pnpm eval regen <run-id>` 等子命令才走单阶段路径。
3. 老 run 的 `index.html` 不会被回填——只对新 run 生效（重新生成 report 的成本不值得回填）。
4. 已合入的 `EVAL_JUDGE_CONCURRENCY`（默认 6）继续生效；`EVAL_REGEN_CONCURRENCY` 引入相同语义，文档同步更新到 README / SKILL.md。
5. 实施分批：先做 #1 / #2（regen 阶段化 + 原子化）与 #8（report 注入与 UI 提升），再做 #3 verify 增量，最后做 #4 缓存与 #5 vite cache。每批独立可验证，不强求一次性合一个 PR。

## Open Questions

- **rubric 写入 cache key 时是否需要 normalize**（比如去掉行尾空白）？倾向不 normalize——简单一致，让用户主动管理 rubric 改动。
- **是否需要 `pnpm eval status <run-id>` 显示 phase 进度**？目前 `cmdStatus` 已经打印 state；建议追加显示 `phases` 字典——任务清单里包含。
- **跨 run 的 judge cache 是否要给个最大大小或 LRU**？短期不做，单条缓存几 KB；先观察实际增长。
