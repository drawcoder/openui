## Context

`packages/lang-core/src/parser/prompt.ts` 现在已经以 section function 方式生成通用 openui-lang prompt，包含 syntax rules、component signatures、data model、builtins、tools、streaming、examples 和 additional rules。当前混乱主要不在 `lang-core` 的组装器，而在 `packages/react-ui-dsl/src/genui-lib/dslLibrary.tsx` 传入的 React UI DSL rules/examples：46 条规则和 19 条示例混合了语言约束、组件策略、格式化建议、chart 特例和历史 bench 修补。

本 change 的目标是先把 React UI DSL prompt 内容治理清楚，而不是建立新的 prompt framework。模型参数、validation、repair 和 runtime contract 都不进入本次范围。

## Goals / Non-Goals

**Goals:**

- 基于当前 deepseek/ds-flash 表现重构 React UI DSL 的 `standard` prompt 内容，并以 bench 质量不回退作为验收 gate。
- 增加 `strictness?: "standard" | "strict"` prompt 选项，默认 `standard`。
- 让 `strict` 在 `standard` 基础上追加严格约束规则，并在 bench 证明需要时追加少量严格示例。
- eval/regen 能通过命令参数选择 strictness，并在 run 级 report metadata 中记录 strictness。

**Non-Goals:**

- 不修改 `lang-core/src/parser/prompt.ts` 的 section 组装顺序。
- 不引入 prompt recipe registry、model profile、模型参数管理或自动模型映射。
- 不做 validation、diagnostics、repair 或 Java/runtime contract。
- 不做 data-shape classifier、hints 或 dynamic example selection。
- 不改变 DSL 语法、parser、component schema 或 runtime rendering 语义。

## Decisions

### D1: 在 `react-ui-dsl` 层治理 prompt 内容

`lang-core` 继续负责通用 openui-lang prompt assembly；React UI DSL 继续通过 `additionalRules` 和 `examples` 注入组件库相关 prompt 内容。本 change 不向 `lang-core` 添加 React 语义，也不改变 `generatePrompt()` 的结构。

替代方案：在 `lang-core` 新增 prompt slots 或 recipe。拒绝原因是当前需求只需要治理 React UI DSL 传入的内容，提前抽象会把范围拉回通用 prompt 管理平台。

### D2: `standard` 是重构后的默认 prompt，不是旧 prompt 原样保留

`standard` 将替换当前 46 条规则和 19 条示例为更清晰的默认规则/示例集合。旧 prompt 只作为 eval baseline 用于比较，不作为长期 API 语义。

验收标准不是“prompt 更短”或“结构更漂亮”，而是 deepseek/ds-flash bench 质量不回退。更短、更清晰只是达成该目标的手段。

### D3: `strict` 是 `standard + extra`

`strict` 不独立维护另一套完整 prompt，而是在 `standard` 基础上追加 `STRICT_PROMPT_ADDITIONAL_RULES`，并可追加 `STRICT_PROMPT_EXAMPLES`。严格示例不预设必须存在，只有 qwen3 bench 显示某类可复用失败需要正例时才加入。

替代方案：让 `strict` 完全替换 standard rules/examples。拒绝原因是这会形成两套 prompt 主线，长期维护成本更高，也不符合“严格程度增强”的 API 直觉。

### D4: strictness 表达指令强度，不表达模型身份

API 使用 `strictness?: "standard" | "strict"`，不使用 `modelProfile`、`promptPack`、`qwen3` 等命名。`strict` 可以用于 qwen3 迁移实验，但不会绑定任何模型名，也不会包含模型参数。

### D5: eval 通过命令参数选择 strictness

`pnpm eval start` 增加 `--strictness standard|strict`。eval runner 将该值传给测试子进程，regen 时由 `llm.ts` 传入 `dslLibrary.prompt({ strictness })`。report 只记录 run 级 strictness，因为单次 run 内 strictness 应保持一致。

## Risks / Trade-offs

- [standard 重构导致 deepseek/ds-flash 回退] → 保留旧 prompt 作为 eval baseline，standard 必须通过 bench 不回退 gate 后才能接受。
- [strict 变成新的规则堆积点] → strict extra rules 只允许重申高频硬约束；strict examples 需要 bench 失败证据并覆盖可复用模式。
- [run 级 strictness 不支持同一 run 混合比较] → P0 先要求一次 run 使用单一 strictness，跨 run 比较即可；需要混合矩阵时再扩展报告结构。
- [不做 validation/repair 导致 parse fail 仍存在] → 这是有意取舍；validation/repair 后续单独开 change，避免本次 prompt-only change 膨胀。

## Migration Plan

1. 在 `PromptOptions` 类型中增加 `strictness?: "standard" | "strict"`。
2. 在 `dslLibrary.tsx` 中重命名并重构 standard rules/examples，新增 strict extra rules/examples。
3. 更新 `mergePromptOptions()`：默认使用 standard；strict 时追加 strict extra 内容；调用方传入的 `additionalRules`/`examples` 仍追加在最终集合末尾。
4. 在 eval CLI 中解析 `--strictness`，传递到测试子进程并在 regen prompt 生成时使用。
5. 将 strictness 写入 run 级 report metadata。
6. 跑 deepseek/ds-flash legacy vs standard；若 standard bench 质量回退，则回滚 standard prompt 内容。
7. 跑 qwen3 standard vs strict；根据 bench 结果决定 strict extra examples 是否需要加入。

Rollback：将 eval strictness 设回 `standard`，并恢复上一版 standard rules/examples。

## Open Questions

- 旧 prompt baseline 是通过保留临时 internal helper、独立 fixture snapshot，还是通过 git revision 对比获取？
- strict extra examples 初始是否为空，还是先放入一条 qwen3 已知失败模式的正例后再跑 bench？
