## Context

`react-ui-dsl` 是一个 LLM 驱动的生成式 UI 库。当前 prompt 链路是：

```
dslLibrary.prompt(options)
  └─ baseDslLibrary.prompt(mergePromptOptions(options))
      └─ generatePrompt(spec)   // packages/lang-core/src/parser/prompt.ts
          ├─ PREAMBLE
          ├─ syntaxRules
          ├─ generateComponentSignatures
          ├─ dataModelSection (可选)
          ├─ templateBuiltinFunctionsSection
          ├─ dataBuiltinFunctionsSection
          ├─ querySection (可选)
          ├─ mutationSection (可选)
          ├─ actionSection (可选)
          ├─ interactiveFiltersSection (可选)
          ├─ toolWorkflowSection (可选)
          ├─ renderToolsSection (可选)
          ├─ streamingRules
          ├─ examples (19 条静态)
          ├─ editModeSection (可选)
          ├─ inlineModeSection (可选)
          ├─ importantRules
          └─ additionalRules (46 条静态)
```

`dslLibrary.tsx` 通过 `mergePromptOptions` 把 `DEFAULT_PROMPT_ADDITIONAL_RULES`（46 条）和 `DEFAULT_PROMPT_EXAMPLES`（19 条）拼到任何调用方传入的 options 上。

本次迁移问题（`runs/20260507_195347_e8q3`）暴露的**具体失败模式**：

| Fixture | qwen3 输出问题 | 对应（已存在但被忽视的）规则 |
|---|---|---|
| `actual-target-gap` | 多写一个 `)`，bracket 数错 → `invalid-prop` | 无（bracket 纪律） |
| `aggregated-only` | `data.totalDevices.toString()`、`Card(..., "card", "card")` 多 arg、`GaugeChart` 不该传的位置参数 | rule 5 明令禁用 JS API |
| `grouped-object-of-arrays` | `List(@Each(...)` 多处未闭合；自定义伪组件 `ListItem = HLayout([...])` | "Do not declare pseudo-reusable component templates that reference undeclared variables" |
| `primitive-number-array` | 又是 `.toString()`、把 `@Render(...)` 当 field 名传给 `Col` | rule 5 |

判定：失败的是"指令位置"而非"指令缺失"。Qwen3 对长 prompt 末段 attention 衰减更明显，加上 JS prior 更强，导致这 46 条规则中的关键反模式条目实质失效。

## Goals / Non-Goals

**Goals**

- 当前迁移：`qwen3-30b-a3b-instruct-2507` 在现有 benchmark 集上达到不低于 deepseek 历史 baseline 的 parse 通过率与 judge 总分
- 长期可维护：新增任何模型的适配工作 ≤ 半天（写一个 profile + 跑一遍 ablate）
- 反 bloat：把 46 条历史规则按贡献量裁剪，目标 prompt 总 token 数下降 ≥ 25%
- 度量驱动：所有规则的去留必须有 ablate 数据支撑，不再凭直觉加规则
- 向后兼容：调用方不传 `model` 时走 `default` profile，行为与改造前等价

**Non-Goals**

- 不重写 lang-core parser，不改 DSL 语法本身
- 不引入第三方 prompt 框架（BAML/DSPy/Guidance/LMQL/Outlines）
- 不上 embedding 检索；example 选择仅基于规则 tag overlap
- 不本次实施 grammar-constrained decoding（XGrammar / vLLM `guided_grammar`）
- 不本次自动化 prompt 优化（DSPy MIPROv2 / GEPA），但接口预留为以后可 swap
- 不改 eval / judge / report 主流程；仅扩展一个 ablate 子命令
- 不评估 cost / latency 维度（profile 仅提供 sampling 参数，不做计费决策）

## Architecture

### A1：三层内容分离（L1 / L2 / L3）

判定准则："换一个模型，这一段措辞需不需要改？"

| 层 | 内容 | 位置 | 共享性 |
|---|---|---|---|
| **L1 语言事实** | DSL 语法、builtins API、组件签名、Query/Mutation/Action 用法、streaming 规则 | `lang-core/src/parser/prompt.ts` | 所有模型共享，**严禁**按 model 分叉 |
| **L2 渲染策略** | "单条记录用 Descriptions"、"byte 字段用 @FormatBytes"、"6+ 字段用 columns=2"、null-dominant 处理、MiniChart 用法等产品级准则 | `react-ui-dsl/src/genui-lib/corePolicy.ts`（新增） | 所有模型共享 |
| **L3 模型反模式** | "qwen3 别用 `.toString()`"、"qwen3 别自定义伪组件"、特定模型的输出格式 anchor 等 | `lang-core/src/profiles/<model>.{yaml,ts}` | 仅该模型注入 |

为什么把 corePolicy 放在 `react-ui-dsl` 而不是 `lang-core`：lang-core 是语言层（不知道 React 组件具体语义）；产品级渲染策略与具体组件库强相关，属于 react-ui-dsl 关心的事。`prompt.ts` 通过 `additionalRules` 接口接收 corePolicy，二者解耦。

### A2：Model profile

profile shape（YAML 与 TS interface 同构）：

```ts
interface ModelProfile {
  /** 显式继承另一个 profile，仅做覆盖；缺省继承 default */
  extends?: string;

  /** L3 反模式条目；写成正例（"do Y"）优于反例（"never X"） */
  antiPatterns?: string[];
  antiPatternSlots?: ('top' | 'bottom' | 'both')[];  // 默认 ['both']

  /** examples 选择策略 */
  exampleCategories?: string[];   // 限制可选 tag 集
  exampleLimit?: number;          // 默认 8
  exampleSelection?: 'tag-overlap' | 'static-all';  // 默认 tag-overlap

  /** 段落排版 */
  sectionOrder?: SectionId[];     // 默认顺序定义在 prompt.ts
  verbosity?: 'full' | 'terse';   // terse 砍 streamingRules / interactiveFilters 等可选段
  maxPromptChars?: number;        // 软上限，超过 build-time warn

  /** 推理参数（profile 同时持有，调用方可读取） */
  sampling?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    minP?: number;
    extra?: Record<string, unknown>;  // 例如 enable_thinking: false
  };
}
```

继承语义：profile 字段是**深 merge**（数组 concat、对象覆盖、scalar 覆盖）。`default` profile 等价于改造前的现状（接近 deepseek 的全量 prompt）。

初始 profile 集合：

- `profiles/default.yaml`：沿用现状，只把 sampling 留空（由调用方自定）
- `profiles/qwen3-30b-a3b-instruct-2507.yaml`：sampling 用官方推荐值 + `enable_thinking=false`；antiPatterns 包含 JS-API ban、bracket 纪律、伪组件禁令、输出 anchor；`exampleLimit=6`；`verbosity='terse'`
- `profiles/deepseek-chat.yaml`：仅设 sampling（沿用现行参数）

### A3：Anti-pattern 槽位

`prompt.ts` 的 sectioned 输出新增两个具名槽位：

```
[PREAMBLE]
[syntaxRules]
[ANTI-PATTERN SLOT: top]      ← profile.antiPatterns 注入位置 1
[Component Signatures]
[Data Model] (可选)
[Builtins / Query / Mutation / Action / Filters / ToolWorkflow / Tools]
[streamingRules]
[Examples]   ← 由 example selector 动态挑选
[editMode] / [inlineMode] (可选)
[importantRules]
[ANTI-PATTERN SLOT: bottom]   ← profile.antiPatterns 注入位置 2（重复关键条目）
```

这两个槽位都在 prompt 的高 attention 区（开头与末尾），缓解 lost-in-the-middle 衰减。`profile.antiPatternSlots` 控制每条 anti-pattern 注入哪些槽（默认 `both`）。

### A4：Example 动态选择

文件结构：

```
react-ui-dsl/src/genui-lib/examples/
  index.ts                  // 导出 examples + classifyDataShape
  table-list.ts             // tags: ['table', 'list']
  byte-fields.ts            // tags: ['byte-field', 'table']
  single-record.ts          // tags: ['single-record', 'descriptions']
  null-dominant.ts          // tags: ['null-dominant', 'single-record']
  pagination-envelope.ts    // tags: ['paginated', 'envelope']
  chart-trend.ts            // tags: ['chart', 'epoch-ms']
  multi-series-line.ts      // tags: ['chart', 'multi-series', 'partition']
  mini-chart-row.ts         // tags: ['mini-chart', 'row-local', 'number-array']
  mini-chart-summary.ts     // tags: ['mini-chart', 'scalar-pairing']
  scalar-summary.ts         // tags: ['kpi-card', 'scalar-only']
  nested-array.ts           // tags: ['nested-array']
  dynamic-key-map.ts        // tags: ['object-map']
  link-table.ts             // tags: ['table', 'tooltip']
  ... (从 19 条 examples 拆分而来；同时把 corePolicy 中的反模式条目反写成 tagged 正例)
```

每条 example：

```ts
export const example: TaggedExample = {
  id: 'byte-fields',
  tags: ['byte-field', 'table'],
  body: `root = VLayout([volumeTable])
volumeTable = Table([nameCol, totalCol, usedCol, usageCol], data.volumes)
...`,
  caption?: 'Format byte fields with @FormatBytes; derive usage with @FormatPercent.',
};
```

`classifyDataShape` 是纯代码 classifier（无 embedding、无 LLM）：

```ts
function classifyDataShape(data: unknown): string[] {
  const tags: string[] = [];
  // 顶层是 array of records: ['table', 'list']
  // 顶层是 single object 且 fields 多数 scalar: ['single-record', 'descriptions']
  // 含 *Bytes / inBytes / outBytes / totalBytes: ['byte-field']
  // 含 bandwidth / bps / bitrate: ['rate-field']
  // 含 number[] field: ['number-array']
  // 含 epoch ms (number > 1e12): ['epoch-ms']
  // 含 success/code/message + data 嵌套: ['envelope']
  // 含 total/pageSize/pageIndex: ['paginated']
  // 含 dynamic key map (object 全是 object value 且 key 不固定): ['object-map']
  // 大多数字段是 null: ['null-dominant']
  // 顶层 object 含 number[] field 且其余是 scalar: ['scalar-pairing']
  // ...
  return tags;
}
```

选择算法：

1. `inputTags = classifyDataShape(spec.dataModel?.raw)`
2. 按 `score = |inputTags ∩ exampleTags|` 排序（带 tie-break：tag 多样性优先，避免 N 条都集中在同一类）
3. 取 top `profile.exampleLimit`
4. 受 `profile.exampleCategories` 过滤（白名单）

无 `dataModel` 时：退化到 profile 默认 example 集（一个跨类别的小样本）。

### A5：Self-repair retry

调用流：

```
generate(spec, prompt, model)
  └─ try parse(output)
     ├─ ok → return
     └─ error
        └─ generate(spec, prompt + repairAppendix(output, error), model)
           └─ try parse(output')
              ├─ ok → return
              └─ error → throw (no infinite retry)
```

`repairAppendix(prevOutput, parseError)`：

```
The previous response did not parse:

<previous output, truncated to 800 chars at the error region>

Parser error:
<failureReason, single line>

Re-emit the FULL program, fixing the issue. Do NOT add explanations.
```

只重试 1 次（防成本爆炸）。落点：`react-ui-dsl/src/__tests__/e2e/llm.ts` 的 `generateDsl` 入口；生产 runtime 的入口同步。

可由 profile 关闭（`profile.selfRepair = false`），用于消融测试与 baseline 对比。

### A6：Ablation harness

CLI：

```
pnpm eval ablate --rule <rule-id> [--model <profile-name>] [--suite e2e|benchmark|fuzz]
pnpm eval ablate:all --model <profile-name>          # 扫所有 corePolicy + profile.antiPatterns 条目
pnpm eval ablate --example <example-id> --model ...  # 对 example 做消融
```

实现：

1. 读取 baseline run（最近一次完整 eval 的 score）
2. 临时生成一个"减一"版本：corePolicy 或 profile 中删除指定条目
3. 重新跑 fixture（仅 holdout 子集，避免对 train 过拟合）
4. 调用 judge，给 delta 报告：

```
Rule "never use JS conversion APIs":
  qwen3-30b:    parse 91% → 75%   judge 7.6 → 5.4   (Δ critical, KEEP in qwen3 profile)
  deepseek:     parse 100% → 100% judge 8.4 → 8.3   (Δ none, DROP from default)
  → classification: L3 (qwen3 only)
```

train/holdout 拆分：

- `e2e/snapshots/` ⇒ train（开发期反复看到的 fixture）
- `benchmark-snapshots/` ⇒ holdout（评估时使用的 fixture）
- `fuzz-snapshots/` ⇒ extra holdout（随机数据健壮性）

跑 `ablate:all` 一遍后产出三类清单：

- **L2-keep**（两个模型都掉分）：保留在 corePolicy
- **L3-migrate**（仅一个模型掉分）：迁到对应 profile
- **drop**（两个都不掉）：从 corePolicy 删除

成本：46 条 × 2 模型 × ~44 fixtures × ~3000 tokens = 几小时一次性投入。

### A7：Prompt bloat lint

`generatePrompt` 末尾：

```ts
if (profile.maxPromptChars && output.length > profile.maxPromptChars) {
  console.warn(`[prompt-bloat] ${output.length} > ${profile.maxPromptChars} for profile ${profile.id}`);
  // 可选：在 dev 模式 throw；prod 仅 warn
}
```

为不同 profile 设不同上限（qwen3 严格、default 宽松）。CI 中可选启用 `--strict` 把 warn 升级为 fail。

### A8：调用流变更

```ts
// 改造前
const sys = dslLibrary.prompt({ tools, dataModel });

// 改造后
const sys = dslLibrary.prompt({
  tools,
  dataModel,
  model: 'qwen3-30b-a3b-instruct-2507',  // optional
});

// 同时拿到 sampling 配置（profile 暴露）
const samplingConfig = dslLibrary.profileFor('qwen3-30b-a3b-instruct-2507').sampling;
```

不传 `model` ⇒ 走 `default` profile ⇒ 行为与改造前等价（向后兼容）。

## 关键决策与权衡

### D1：profile 用 YAML 而非纯 TS

**选 YAML + TS interface 同构**。理由：

- profile 是配置数据，YAML 更适合 ops 编辑（生产环境替换、按客户调）
- 需要支持多层叠加（user / repo / cwd），Aider 的同名 pattern 已经验证可行
- TS interface 用于校验 schema 与类型推导

代价：build 时多一个 YAML loader。可接受。

### D2：corePolicy 留在 react-ui-dsl 而非 lang-core

**留在 react-ui-dsl**。理由：

- L2 是产品级渲染策略，与 React 组件库强绑定；放 lang-core 会让 lang-core 知道太多组件语义
- `prompt.ts` 通过 `additionalRules` 已经是开放接口，corePolicy 走这个接口注入即可
- 未来若有第二套组件库（非 ant design / 非 React），它的 corePolicy 不应该污染 lang-core

### D3：Self-repair 限制 1 次重试

**严格 1 次**。理由：

- 多轮重试成本爆炸，对 30B 模型尤其明显
- Mermaid 数据：第一轮 80%+ 修回；第二轮收益边际化
- 失败仍走原有错误处理（fixture 标 fail），不掩盖问题

### D4：Example 选择不上 embedding

**用规则匹配**。理由：

- 输入形状是离散有限集（≤ 30 个标签），完全可枚举
- 规则匹配可解释、可调试、零依赖
- embedding 在 OOD-prone 的 code generation 场景反而不如 structural similarity（CEDAR 论文）
- 如果未来确实需要更细粒度，再 swap 进 embedding 不迟（接口已抽象）

### D5：暂不上 grammar-constrained decoding

**等 B 完成后再评估**。理由：

- vLLM 在 `Instruct-2507` 上 guided_grammar 有报告中的 bug（vllm#27447, #18819）
- judge 分掉的部分是**语义**问题（component_fit / data_completeness），grammar 救不了
- prompt 层做扎实后若仍有 parse error 残留，再上 grammar 作为根治层
- 同时 prompt 层的工作（profile / examples / corePolicy / ablate）是 grammar 之外仍然必需的，先做不亏

### D6：DSL 本身的"末尾可选 positional 参数过多"问题单独成 change

**不在本 change 内改**。理由：

- 改 DSL 语法影响所有现有 fixture / snapshot / 文档，blast radius 大
- 应单独提一个 change（暂名 `flatten-positional-args`），用同一个 ablate harness 验证收益
- 本 change 先用 prompt 层的 anti-pattern + example 缓解，争取时间窗口

## 落地阶段（执行顺序）

1. **零成本快速回血**（最先）
   - 应用 Qwen3 官方 sampling 参数
   - 把当前 46 条规则中最关键的 5-8 条手动提升到顶部 + 末尾两槽
   - 衡量：单独跑一次 benchmark，看 4 个 parse fail 是否减少
2. **Self-repair retry**（半天）
   - 在 `llm.ts` 加一层；同时落 profile.selfRepair 开关用于 ablate 对照
3. **Profile 抽象 + L2/L3 拆分**（落 corePolicy.ts + profiles/）
   - 先按经验把 46 条分桶，**未消融的标 `pending-ablation`** 注释
4. **Examples 重构 + classifyDataShape**
   - 拆 19 条 + 反模式条目改写为正例
5. **Ablation harness**
   - 实现 ablate / ablate:all
   - 跑一遍，回收 `pending-ablation` 标记，确定最终归属
6. **Prompt bloat lint** + 文档（CLAUDE.md / AGENTS.md 更新）

每一步都可以独立合入，互不阻塞。

## 风险

| 风险 | 概率 | 缓解 |
|---|---|---|
| Ablate 跑出来发现 corePolicy 也大量过拟合 → 实际 prompt 大幅缩水后 deepseek 反而退步 | 中 | 分 train/holdout，且 ablate 仅用 holdout 决策；deepseek 真退步则相应 anti-pattern 沉到 default profile |
| Profile YAML 多层叠加引入复杂性，调试困难 | 中 | 暴露 `dslLibrary.dumpResolvedProfile(model)` 工具供调试；CI 中打印 resolved profile |
| Self-repair 重试在生产把成本翻倍 | 低 | 默认仅 dev/eval 启用；生产 profile 显式关闭，由调用方自决 |
| Example 动态选择把"基础语言示例"也漏掉，导致基础场景退步 | 低 | profile 提供 `requiredExamples: string[]` 兜底；至少保留 2 条"通用 table + 通用 chart"始终可见 |
| Sampling 参数变化导致已经调好的 fixture 流失 | 低 | sampling 仅在 profile 显式开启时应用；不传 model 时维持原参数 |

## 仍待确定的问题（用户回家后继续）

1. **ablate 的并发与缓存策略** — 一次 ablate:all 跑几小时，能否复用上一轮的 LLM 输出（基于"被消融的规则"hash）减少调用？
2. **corePolicy 与 profile 的版本管理** — 是否需要显式版本号，便于回滚到"上周的 prompt 配方"做对照？
3. **eval 报告里要不要展示 resolved profile / 命中的 example tag** — 利于诊断 fail，但报告会变长
4. **`require_examples` 兜底集合谁来定** — 写死在 base 里，还是放进 default profile，还是每个产品 profile 自定？
5. **生产 runtime 是否也启用 self-repair** — eval/regen 启用是定的；生产视成本与延迟权衡再决定
6. **`flatten-positional-args` 是否真的提为独立 change** — 还是先在 prompt 层用例子掩盖；以及优先级
7. **profile 文件位置** — `lang-core/profiles/` vs `react-ui-dsl/profiles/`。lang-core 更通用、所有调用方共享；react-ui-dsl 更与组件库耦合。倾向 lang-core，但 antiPatterns 内容可能涉及组件名（如"GaugeChart 不要传 min/max"），有耦合点
8. **是否要把"ablate 报告"作为 commit 必须 artifact**（每次改 corePolicy 都要附 ablate 数据）—— 制度建设问题
