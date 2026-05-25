## Why

`react-ui-dsl` 中的 `Text` 组件 schema 设计陈旧：markdown 能力隐藏在内部实现中、未暴露给 LLM，且组件语义模糊。将其拆分为 `TextContent` 和 `MarkDownRenderer` 两个职责清晰的组件，使 LLM 能准确选择，同时对齐 `react-ui` 的组件命名与 schema 约定。

## What Changes

- **移除** `Text` DSL 组件及其注册
- **新增** `TextContent` 组件：schema `{ text: string, size?: enum }` ，始终以 markdown 渲染，用于标签、KPI、段落等 UI 文字元素
- **新增** `MarkDownRenderer` 组件：schema `{ textMarkdown: string, variant?: "clear" | "card" | "sunk" }` ，用于富文档、代码块、长 markdown 内容，支持容器样式
- **简化** 内部 `TextView` 组件，移除 `html` 模式，迁移至 `Components/` 目录作为共享 markdown 渲染器
- **BREAKING** `Text(...)` 从 DSL 词汇表中移除；所有现有 `.dsl` snapshot 文件通过 `pnpm test:e2e:regen` 重新生成
- **BREAKING** 渲染容器从 `<span>`（inline）改为 `<div>`（block）

## Capabilities

### New Capabilities

- `textcontent-component`：`TextContent` DSL 组件的 schema、渲染行为与 LLM 使用规范
- `markdownrenderer-component`：`MarkDownRenderer` DSL 组件的 schema、variant 容器样式与 LLM 使用规范

### Modified Capabilities

（无——现有 specs 中无 `Text` 组件的规范文件）

## Impact

- `packages/react-ui-dsl/src/genui-lib/Text/` — 组件删除或重构
- `packages/react-ui-dsl/src/genui-lib/TextContent/` — 新增
- `packages/react-ui-dsl/src/genui-lib/MarkDownRenderer/` — 新增
- `packages/react-ui-dsl/src/genui-lib/Components/MarkdownView/` — 新增（共享内部渲染器）
- `packages/react-ui-dsl/src/genui-lib/dslLibrary.tsx` — 注册表更新
- `packages/react-ui-dsl/src/__tests__/e2e/snapshots/` — 全量 regen（所有引用 `Text` 的 `.dsl` 文件）
- 无外部依赖变更（`react-markdown` 已存在）
