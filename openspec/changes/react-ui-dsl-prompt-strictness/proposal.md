## Why

`react-ui-dsl` 的系统 prompt 已经从多轮 bench 修补中累积成 46 条规则和 19 条示例，规则职责混杂、示例偏历史用例，继续直接追加 qwen3 迁移补丁会让 prompt 更难维护。我们需要先以 ds-flash/deepseek bench 质量不回退为基线重构默认 prompt，再提供一个显式的严格指令强度用于 qwen3 等弱指令遵循模型的迁移调优。

## What Changes

- 重构 `react-ui-dsl` 默认 prompt 规则和示例：
  - 将当前历史堆积的 `additionalRules` 整理、合并、压缩为更清晰的 standard 规则集。
  - 将当前 19 条示例整理为覆盖可复用生成模式的 standard 示例集。
  - 以 deepseek/ds-flash bench 质量不回退作为 standard 重构的验收 gate。
- 新增 `strictness?: "standard" | "strict"` prompt 选项：
  - `standard` 是默认值，代表重构后的默认 prompt。
  - `strict` 在 standard 基础上追加严格约束规则，并可按 bench 结果追加少量严格示例。
  - `strict` 不绑定模型名，不管理模型参数，不引入 qwen3 专属产品规则。
- eval/regen 支持通过命令参数选择 prompt strictness：
  - 例如 `pnpm eval start --regen --suite benchmark --strictness strict`。
  - report 以 run 级 metadata 记录本次使用的 strictness，便于比较 deepseek standard、qwen3 standard、qwen3 strict 等结果。

本 change 明确不包含 validation、repair、diagnostics、data-shape classifier、dynamic example selection、模型参数架构、prompt recipe registry 或 `lang-core/src/parser/prompt.ts` 组装顺序重构。

## Capabilities

### New Capabilities

- `react-ui-dsl-prompt-strictness`: React UI DSL prompt 支持重构后的 standard 指令集和显式 strict 指令强度。

### Modified Capabilities

- `semantic-regression-testing`: React UI DSL eval/report 在 run 级记录 prompt strictness，使 bench 对比可以归因到 prompt 指令强度。

## Impact

- `packages/react-lang/src/library.ts`: `PromptOptions` 增加 `strictness?: "standard" | "strict"` 类型字段。
- `packages/react-ui-dsl/src/genui-lib/dslLibrary.tsx`: 重构 standard rules/examples，新增 strict extra rules/examples，并根据 strictness 合并 prompt 选项。
- `packages/react-ui-dsl/src/__tests__/e2e/llm.ts`: regen 时将配置的 strictness 传给 `dslLibrary.prompt()`。
- `packages/react-ui-dsl/src/__tests__/e2e/eval-loop.ts`: `pnpm eval start` 支持 `--strictness` 参数，并传递给测试子进程。
- `packages/react-ui-dsl/src/__tests__/e2e/report*` 与 eval manifest/report 数据：记录 run 级 strictness。
- 不新增第三方依赖；不改变 `lang-core` prompt 组装顺序；不改变 DSL 语法或组件 runtime 语义。
