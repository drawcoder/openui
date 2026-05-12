## ADDED Requirements

### Requirement: 评测流水线 SHALL 由独立可恢复的阶段组成

GenUI eval loop SHALL 将一次 run 的端到端工作切分为四个独立阶段：`regen`、`render`、`screenshot`、`judge`。每个阶段完成后 MUST 将状态持久化到 `run.json` 的 `phases` 字段。再次进入流水线时 MUST 跳过已完成阶段，仅补跑缺失阶段。

#### Scenario: 已完成 regen 阶段后进程被终止

- **WHEN** `pnpm eval start --regen` 已完成 regen 阶段并写入 `phases.regen = "done"`，但在 render 阶段被终止
- **THEN** 再次执行 `pnpm eval start <same-run-id>` 或对应阶段命令时，MUST 跳过 regen 阶段，从 render 阶段开始
- **AND** MUST NOT 重复调用 LLM 重新生成已经存在的 snapshot

#### Scenario: 各阶段提供独立 CLI 入口

- **WHEN** 用户需要单独运行某个阶段（例如重判某个已有 run）
- **THEN** CLI MUST 提供 `pnpm eval regen <run-id>`、`pnpm eval render <run-id>`、`pnpm eval judge <run-id>` 三个独立命令
- **AND** 每个命令 MUST 校验前置阶段已完成，未完成时 MUST 报错指引用户先跑前置阶段

#### Scenario: `pnpm eval start` 作为编排器

- **WHEN** 用户运行 `pnpm eval start [options]`
- **THEN** CLI MUST 依次编排 regen（如启用）→ render → screenshot → judge 阶段
- **AND** 任意阶段失败 MUST 停止流水线并保留已完成阶段的状态，使后续可续跑

### Requirement: Regen 阶段 SHALL 并发调用 LLM 且原子化写入 snapshot

Regen 阶段（fixture DSL 生成）MUST 在 vitest 之外独立完成，并发调用 LLM 生成所有受影响 fixture 的 DSL。并发数 MUST 默认为 6，且 MUST 可通过 `EVAL_REGEN_CONCURRENCY` 环境变量覆盖。所有 fixture 全部成功后 MUST 通过 staging 目录原子替换 snapshot 目录中的对应文件；任意 fixture 失败 MUST NOT 修改 snapshot 目录中的任何已存在文件。

#### Scenario: 全部成功后才更新 snapshot

- **WHEN** regen 对 44 个 fixture 发起 LLM 调用，全部成功返回
- **THEN** snapshot 目录（`benchmark-snapshots/` 等）MUST 在所有文件生成完成后一次性更新
- **AND** 更新前的 git working tree 状态 MUST 不出现"部分文件已新生成、其它未变"的中间态

#### Scenario: 中途失败不污染 snapshot

- **WHEN** regen 已成功生成 25 个 fixture 后，第 26 个调用失败或进程被终止
- **THEN** snapshot 目录中的 `.dsl` 文件 MUST 保持执行前的内容
- **AND** staging 区域中已生成的文件 MUST 被清理或保留在 run 工作区内供调试，但不进入 snapshot 目录

#### Scenario: 通过 env var 调整并发数

- **WHEN** 用户设置 `EVAL_REGEN_CONCURRENCY=3` 后执行 regen
- **THEN** 同一时刻活跃的 LLM 调用数 MUST 不超过 3

### Requirement: Judge 阶段 SHALL 并发调用 judge runner

Judge 阶段 MUST 使用有界 worker pool 并发对 fixture 调用 judge runner。并发数 MUST 默认为 6，且 MUST 可通过 `EVAL_JUDGE_CONCURRENCY` 环境变量覆盖。判分结果数组 MUST 保持与输入 fixture 顺序一致。

#### Scenario: 默认并发数

- **WHEN** 未设置 `EVAL_JUDGE_CONCURRENCY` 时执行 judge 阶段
- **THEN** 同一时刻活跃的 judge runner 调用数 MUST 不超过 6

#### Scenario: env var 覆盖

- **WHEN** 用户设置 `EVAL_JUDGE_CONCURRENCY=10`
- **THEN** 同一时刻活跃 judge runner 调用数 MUST 不超过 10

#### Scenario: 输出顺序与输入对齐

- **WHEN** 多个 fixture 并发完成顺序与提交顺序不同
- **THEN** 返回的 `JudgeScore[]` MUST 仍按输入 fixture 顺序排列

### Requirement: Judge 结果 SHALL 按内容哈希缓存

Judge 阶段 MUST 在调用 judge runner 之前查询本地内容寻址缓存。缓存 key MUST 由 `hash(dsl + screenshot_sha256 + rubric_text + judge_model)` 组成。缓存命中时 MUST 跳过 runner 调用直接返回缓存的 `JudgeScore`。Rubric 文本变更或 judge model 切换 MUST 自然导致 cache miss。

#### Scenario: 相同输入命中缓存

- **WHEN** 两次 run 的同一 fixture 具有完全相同的 DSL、screenshot、rubric 与 model
- **THEN** 第二次执行 judge MUST 命中缓存
- **AND** MUST NOT 触发 judge runner 调用

#### Scenario: rubric 变更后失效

- **WHEN** 用户编辑了 rubric 文本，对相同 fixture 再次执行 judge
- **THEN** cache key MUST 变化导致 cache miss
- **AND** judge runner MUST 被重新调用

#### Scenario: 缓存位置

- **WHEN** 流水线写入或读取 judge 缓存
- **THEN** 缓存目录 MUST 位于 `packages/react-ui-dsl/src/__tests__/e2e/eval/.judge-cache/` 且 MUST 在 `.gitignore` 中被排除

### Requirement: Verify 阶段 SHALL 增量重判

`pnpm eval verify <run-id>` MUST 读取 `result-bundle/claimed-affected-fixtures.json`。受影响 fixture MUST 重跑 render + screenshot + judge；未受影响 fixture MUST 复用 baseline `report-data.json` 中的 `judge_scores`。整轮 vitest 仍 MUST 作为回归门禁运行，但不重新调用 judge runner。

#### Scenario: 只判受影响 fixture

- **WHEN** `claimed-affected-fixtures.json` 列出 5 个 fixture，run 共有 44 个 fixture
- **THEN** judge runner MUST 仅被调用 5 次（除非未受影响 fixture 命中缓存失效场景）
- **AND** 其余 39 个 fixture 的 score MUST 来自 baseline `report-data.json`

#### Scenario: claimed 列表为空时退化

- **WHEN** `claimed-affected-fixtures.json` 不存在或为空数组
- **THEN** verify MUST 退化为全量重判（与现有行为一致），并在输出中提示用户

#### Scenario: vitest regression gate 仍然执行

- **WHEN** verify 阶段运行
- **THEN** vitest 整轮 MUST 仍被执行用于检测渲染失败
- **AND** 任一 fixture 在 vitest 阶段失败 MUST 在 verify 总结中标记为 regression

### Requirement: Report HTML SHALL 反映最新判分结果

Report-app 的 `index.html` MUST 在判分阶段完成后包含最新的 `report-data.json`（含 `judge_scores`、`failing_patterns`、`delta`）。当 `report-data.json` 在 run 工作区被更新时，`index.html` 的内联 `<script id="e2e-report-data">` 标签 MUST 同步更新。

#### Scenario: judge 完成后 HTML 含分数

- **WHEN** `pnpm eval start` 完成全流程后用户打开 `runs/<run-id>/index.html`
- **THEN** 浏览器渲染的页面 MUST 显示每个 fixture 的 judge 分数与 feedback
- **AND** 内联的 `<script id="e2e-report-data">` 文本 MUST 包含 `judge_scores` 字段

#### Scenario: verify 完成后 HTML 含 delta

- **WHEN** `pnpm eval verify <run-id>` 完成后用户打开 run 的 `index.html`
- **THEN** 页面 MUST 显示新分数和与 baseline 的 delta

### Requirement: Report-app SHALL 把判分详情作为一级视图

报告中每个 fixture 卡片 MUST 在不需要用户点击展开的前提下显示：feedback 文本、四个维度（`component_fit` / `data_completeness` / `format_quality` / `layout_coherence`）的 ScoreBar、visual issue chips、以及位于卡片 header 的 overall 分数。DSL 与 Data Model 等次要信息 MAY 继续保留在折叠 `<details>` 中。

#### Scenario: 默认展开判分详情

- **WHEN** 用户在浏览器中打开报告页面
- **THEN** 每个 fixture 卡片 MUST 默认显示 feedback 文本与四维 ScoreBar
- **AND** MUST NOT 要求用户点击才能看到 feedback 与维度分数

#### Scenario: Overall 分数位于卡片 header

- **WHEN** 一个 fixture 有 judge 结果
- **THEN** 卡片 header MUST 显示 `overall N/10` 评分
- **AND** 当存在 verify delta 时 MUST 显示与 baseline 的差值

#### Scenario: degraded 状态明确标识

- **WHEN** 某 fixture 的截图缺失导致 `judgeScore.degraded === true`
- **THEN** 卡片 MUST 在判分区域显著标记"degraded"或同义提示
- **AND** MUST NOT 把 degraded 分数与正常分数混合展示成同等可信结果

### Requirement: Report-app bundle SHALL 跨 run 复用

`buildReportApp` 阶段生成的 HTML 模板、JS、CSS 资源 MUST 一次性构建到共享缓存目录，每个 run 仅拷贝资源并注入 `report-data.json`，而不重复运行 vite build。当报告 app 源代码或依赖发生变更时，缓存 MUST 失效并重新构建。

#### Scenario: 第二个 run 跳过 vite build

- **WHEN** 同一 commit、同一依赖状态下连续执行两次 `pnpm eval start`
- **THEN** 第二次执行 MUST NOT 重新运行 vite build
- **AND** 第二个 run 的 `index.html` 与 assets MUST 来自共享缓存的拷贝

#### Scenario: 源码变更后缓存失效

- **WHEN** 用户修改了 `report-app/main.tsx` 或 `styles.css` 等源文件
- **THEN** 下一次 `pnpm eval start` MUST 检测到缓存失效并重新构建
- **AND** 新构建的产物 MUST 重新写入共享缓存

### Requirement: Judge 进度 SHALL 增量持久化

Judge 阶段每完成一个 fixture 的判分 MUST 立即将其 `JudgeScore` 写入 `report-data.json`（或等价的中间文件）。流水线在 judge 阶段中途崩溃后再次启动 MUST 跳过已写入分数的 fixture（配合内容哈希缓存）。

#### Scenario: 崩溃后能接着判

- **WHEN** judge 阶段已完成 30 个 fixture 后进程被终止
- **THEN** `report-data.json` MUST 包含这 30 个 fixture 的 `judge_scores`
- **AND** 再次运行 judge 阶段 MUST 仅对剩余 14 个 fixture 调用 runner

#### Scenario: 持久化频率

- **WHEN** judge 阶段处于运行中
- **THEN** 每完成单个 fixture 的判分 MUST 在合理时间内（不晚于下一个 fixture 完成）将分数持久化到磁盘
