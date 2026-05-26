## ADDED Requirements

### Requirement: Stack 组件存在且 schema 正确
DSL 库 SHALL 提供名为 `Stack` 的组件，其 schema 字段按以下顺序定义（顺序决定 DSL 位置参数顺序），与 `@react-ui` Stack 的 schema 完全一致：
1. `children`: 子节点数组（可选）
2. `direction`: `"row" | "column"`（可选）
3. `gap`: `"none" | "xs" | "s" | "m" | "l" | "xl" | "2xl"`（可选）
4. `align`: `"start" | "center" | "end" | "stretch" | "baseline"`（可选）
5. `justify`: `"start" | "center" | "end" | "between" | "around" | "evenly"`（可选）
6. `wrap`: `boolean`（可选）

DSL 位置参数示例：`Stack([items], "row", "m")` 表示横向排列、gap 为 m。

#### Scenario: 组件注册后可在 DSL 中使用
- **WHEN** DSL 库初始化完成
- **THEN** `Stack` 组件 MUST 出现在库的组件列表中，且 schema 验证通过

#### Scenario: schema 拒绝无效 direction 值
- **WHEN** DSL 传入 `direction: "diagonal"`
- **THEN** schema 验证 MUST 返回错误

### Requirement: Stack 组件的 description 与 @react-ui 完全一致
`Stack` 组件的 `description` 字段（用于 LLM 组件提示）MUST 为：

```
Flex container. direction: "row"|"column" (default "column"). gap: "none"|"xs"|"s"|"m"|"l"|"xl"|"2xl" (default "m"). align: "start"|"center"|"end"|"stretch"|"baseline". justify: "start"|"center"|"end"|"between"|"around"|"evenly".
```

#### Scenario: LLM 看到的组件描述包含 direction 和 gap 默认值
- **WHEN** 调用 `dslLibrary.prompt()` 或读取组件 description
- **THEN** description MUST 包含 `default "column"` 和 `default "m"`

### Requirement: direction 属性控制渲染方向，默认 "column"
`Stack` 组件 SHALL 根据 `direction` 属性渲染对应方向的 flex 容器，未指定时默认 `"column"`。

#### Scenario: direction 为 "column" 时竖向排列
- **WHEN** `Stack` 的 `direction` 为 `"column"` 或未指定
- **THEN** 渲染结果的 `flexDirection` MUST 为 `"column"`

#### Scenario: direction 为 "row" 时横向排列
- **WHEN** `Stack` 的 `direction` 为 `"row"`
- **THEN** 渲染结果的 `flexDirection` MUST 为 `"row"`

### Requirement: gap 默认为 "m"，token 映射为 rem 值
`Stack` 组件 SHALL 将 gap token 映射为 rem 值，未指定 gap 时默认使用 `"m"`。映射关系：
`none: "0", xs: "0.375rem", s: "0.5rem", m: "0.75rem", l: "1.125rem", xl: "1.5rem", 2xl: "2.25rem"`

#### Scenario: gap 未指定时默认 "m"
- **WHEN** `Stack` 的 `gap` 未指定
- **THEN** 渲染结果的 gap MUST 为 `0.75rem`

#### Scenario: gap token 映射为 rem 值
- **WHEN** `Stack` 的 `gap` 为 `"l"`
- **THEN** 渲染结果的 gap MUST 为 `1.125rem`

#### Scenario: 数字 gap 被拒绝
- **WHEN** DSL 传入 `gap: 16`（数字类型）
- **THEN** schema 验证 MUST 返回错误

### Requirement: wrap 与 justify="between" 的特殊处理
当 `wrap` 为 `true` 且 `justify` 为 `"between"` 时，实际渲染的 justifyContent SHALL 回退为 `"start"`（即 `flex-start`），以避免换行时末行对齐异常。

#### Scenario: wrap+justify="between" 时 justifyContent 回退
- **WHEN** `Stack` 的 `wrap` 为 `true` 且 `justify` 为 `"between"`
- **THEN** 渲染结果的 `justifyContent` MUST 为 `flex-start`（而非 `space-between`）

#### Scenario: wrap=false 时 justify="between" 正常生效
- **WHEN** `Stack` 的 `wrap` 未设置或为 `false`，`justify` 为 `"between"`
- **THEN** 渲染结果的 `justifyContent` MUST 为 `space-between`

### Requirement: Stack 是 DSL 的 root 组件，且 LLM prompt 中体现
`dslLibrary` MUST 将 `Stack` 设为 root 组件（即 DSL 顶层默认容器）。`createLibrary` 的 `root` 字段驱动 LLM system prompt 中的入口约束文本，因此 root 设置正确后 prompt 中 MUST 出现 `root = Stack(...)` 而非 `root = VLayout(...)`。

#### Scenario: root 组件为 Stack
- **WHEN** 创建新 DSL workspace 且无显式 root
- **THEN** 库的 `root` 字段 MUST 为 `"Stack"`

#### Scenario: LLM system prompt 引用 Stack 作为入口
- **WHEN** 调用 `dslLibrary.prompt()` 生成 system prompt
- **THEN** 生成的 prompt 文本 MUST 包含 `root = Stack(` 且 MUST NOT 包含 `root = VLayout(`

### Requirement: VLayout 和 HLayout 不再存在
DSL 库 MUST NOT 导出或注册 `VLayout` 或 `HLayout` 组件。

#### Scenario: VLayout 不可用
- **WHEN** DSL 中使用 `VLayout` 组件名
- **THEN** 组件解析 MUST 失败（未知组件）

#### Scenario: HLayout 不可用
- **WHEN** DSL 中使用 `HLayout` 组件名
- **THEN** 组件解析 MUST 失败（未知组件）
