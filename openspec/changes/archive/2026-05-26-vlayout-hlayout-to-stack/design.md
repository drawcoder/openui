## Context

`react-ui-dsl` 当前使用两个独立组件表达 flex 布局：

- `VLayout`：固定 `flexDirection: "column"`，schema 无 `direction` 字段
- `HLayout`：固定 `flexDirection: "row"`，schema 无 `direction` 字段

两者共享相同的 flex 属性集（`gap`、`align`、`justify`、`wrap`），渲染层均通过 Ant Design `<Flex>` 实现。`VLayout` 同时承担 DSL root 组件的角色。

目标：引入统一的 `Stack` 组件，通过 `direction` 属性控制方向，移除 `VLayout` 和 `HLayout`。

## Goals / Non-Goals

**Goals:**
- 新增 `Stack` 组件，schema 包含 `direction: "row" | "column"`，默认 `"column"`
- 保留全部现有 flex 属性（`gap`、`align`、`justify`、`wrap`）及其语义不变
- `Stack` 成为新的 DSL root 组件
- 移除 `VLayout` 和 `HLayout` 及其所有代码

**Non-Goals:**
- 不改变底层渲染方案（继续使用 Ant Design `<Flex>`）
- 不改变 `gap` token 的像素映射（保留现有 `gapMap`）
- 不迁移到 CSS variable 方案
- 不修改 `react-ui-dsl` 以外的包

## Decisions

### 1. 单组件 + direction 属性，而非保留两个组件

**决定**：用一个 `Stack` 组件替代 `VLayout` + `HLayout`。

**理由**：两个组件的唯一区别是硬编码的方向，合并后 schema 更简洁，LLM 生成时无需在组件名之间做选择，降低出错概率。

**替代方案**：保留两个组件并增加别名（`Stack` = `VLayout` | `HLayout`）。否决原因：增加了别名层，没有减少 schema 复杂度。

### 2. `direction` 默认值为 `"column"`

**决定**：`direction` 未指定时默认 `"column"`（即原 VLayout 行为）。

**理由**：`VLayout` 是当前 root 组件，垂直方向是页面布局的最常见起点，保持默认行为不变可降低迁移成本。

### 3. Schema 字段顺序：`children, direction, gap, align, justify, wrap`

**决定**：与 `@react-ui` Stack 的字段顺序完全对齐，`direction` 排在 `gap` 前面（位置参数第 2 位）。

**理由**：跨包一致性；LLM 在两个库之间的迁移成本最低。

**影响**：现有 VLayout/HLayout snapshot 的迁移需注意顺序：
- `VLayout([x], "m")` → `Stack([x], "column", "m")` 或 `Stack([x], gap: "m")`（direction 默认 column 可省略）
- `HLayout([x], "l", true)` → `Stack([x], "row", "l", wrap: true)` 或 `Stack([x], "row", "l", _, _, true)`

### 4. 渲染层改用 plain `<div>`，gap 改为 CSS variable

**决定**：`Stack` 渲染层使用 plain `<div style={{ display: "flex", ... }}>` 而非 Ant Design `<Flex>`；gap 映射改为 rem 值（`none:"0", xs:"0.375rem", s:"0.5rem", m:"0.75rem", l:"1.125rem", xl:"1.5rem", 2xl:"2.25rem"`），未指定 gap 时默认 `"m"`（0.75rem）。

**理由**：rem 不依赖 CSS variable 注入，在 react-ui-dsl 环境中开箱可用；数值与现有像素值（基准 16px 换算）保持视觉等价；去掉 Ant Design 依赖使渲染更纯粹。

**影响**：gap 从固定像素改为相对单位，随用户根字体大小缩放。

### 4. 文件结构：新建 Stack/ 目录，删除 VLayout/ 和 HLayout/ 目录

**决定**：在 `genui-lib/` 下新建 `Stack/`（含 `index.tsx`、`schema.ts`、`view/antd.tsx`），完整删除 `VLayout/` 和 `HLayout/`。

**理由**：保持与现有组件目录结构一致；彻底删除避免遗留代码引发混淆。

## Risks / Trade-offs

- **快照全量失效** → 所有含 `vLayout` / `hLayout` 的 e2e snapshot 和 benchmark snapshot 必须重新生成。需在 PR 中一并提交，否则 CI 失败。
- **DSL Breaking Change** → 任何外部存储或缓存的 DSL 字符串若包含 `VLayout`/`HLayout` 将无法解析。缓解：在 PR 说明中明确列出 breaking 变更。
- **LLM prompt 内容** → 若系统 prompt 中显式列出了 `VLayout`/`HLayout` 组件描述，需同步更新（此部分由 `dslLibrary` 中的 `description` 字段自动生成，更新组件注册即可）。

## Migration Plan

1. 新增 `Stack` 组件（schema、component、view）
2. 在 `dslLibrary.tsx` 中注册 `Stack`，设为 root，移除 `VLayout` 和 `HLayout` 注册
3. 删除 `VLayout/` 和 `HLayout/` 目录
4. 更新 `flexPropsSchema.ts`，加入 `direction` 字段
5. 运行 e2e snapshot 重新生成脚本，提交新快照
6. 更新单元测试

回滚：revert PR，快照文件随 PR 一并还原。
