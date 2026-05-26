## Why

`react-ui-dsl` 目前用两个独立组件 `vLayout`（竖向）和 `hLayout`（横向）表达同一概念——flex 容器。这迫使 LLM 在生成 DSL 时必须在两个名称间做选择，增加了不必要的认知负担，也与"一个组件、一个方向属性"的更简洁模型相悖。统一为 `stack` 后，方向由 `direction` 属性控制，组件模型更一致、更易生成。

## What Changes

- **新增** `Stack` 组件，schema 包含 `direction: "row" | "column"`（默认 `"column"`）以及现有 flex 属性（`gap`、`align`、`justify`、`wrap`）
- **BREAKING** 移除 `VLayout` 和 `HLayout` 组件及其对应目录
- **BREAKING** DSL 语法变更：`VLayout([...], gap)` → `Stack([...], gap)`，`HLayout([...], gap)` → `Stack([...], gap, direction: "row")`
- `dslLibrary` 中 root 组件由 `VLayout` 改为 `Stack`
- 所有使用 `vLayout` / `hLayout` 的 e2e snapshot 及 benchmark snapshot 需重新生成
- 更新相关单元测试

## Capabilities

### New Capabilities

- `dsl-stack-layout`：统一的 flex 布局组件 `Stack`，通过 `direction` 属性控制方向，替代原有的 `vLayout` 和 `hLayout`

### Modified Capabilities

（无需修改现有 spec，原 vLayout/hLayout 无独立 spec 文件）

## Impact

- `packages/react-ui-dsl/src/genui-lib/` — 新增 `Stack/`，删除 `VLayout/` 和 `HLayout/`
- `packages/react-ui-dsl/src/genui-lib/dslLibrary.tsx` — 更新组件注册与 root 组件
- `packages/react-ui-dsl/src/__tests__/e2e/snapshots/` — 重新生成所有含 vLayout/hLayout 的 `.dsl` 快照
- `packages/react-ui-dsl/src/__tests__/e2e/benchmark-snapshots/`（若存在）— 同上
- `packages/react-ui-dsl/src/genui-lib/flexPropsSchema.ts` — 扩展，加入 `direction` 字段
