## ADDED Requirements

### Requirement: TextContent 组件 schema

`TextContent` 组件 SHALL 接受以下 props：
- `text: string`（必填）：文字内容，支持 markdown 语法
- `size?: "small" | "default" | "large" | "small-heavy" | "large-heavy"`（可选）：排版尺寸，默认 `"default"`

#### Scenario: 注册为 DSL 组件

- **WHEN** `dslLibrary` 初始化时
- **THEN** `TextContent` SHALL 出现在组件注册表中，且 `Text` 不再出现

#### Scenario: schema 校验通过

- **WHEN** LLM 生成 `TextContent("Hello", "large")`
- **THEN** Zod schema 校验 SHALL 通过，组件正常渲染

#### Scenario: size 省略时使用默认值

- **WHEN** LLM 生成 `TextContent("Hello")`（不传 size）
- **THEN** 组件 SHALL 以 `"default"` 尺寸渲染

### Requirement: TextContent 始终以 markdown 渲染

`TextContent` SHALL 将 `text` prop 的内容始终通过 markdown 渲染器处理，不提供纯文本模式切换。

#### Scenario: markdown 内容正确渲染

- **WHEN** `text` 包含 markdown 语法（如 `**bold**`、`# heading`）
- **THEN** 组件 SHALL 输出对应的 HTML 元素（`<strong>`、`<h1>` 等）

#### Scenario: 纯文本内容正常显示

- **WHEN** `text` 为普通字符串（无 markdown 语法）
- **THEN** 组件 SHALL 正常显示文字，无多余标签

### Requirement: TextContent 渲染为块级容器

`TextContent` SHALL 使用 `<div>` 作为外层容器（block 元素）。

#### Scenario: 外层容器为 div

- **WHEN** 渲染 `TextContent("hello")`
- **THEN** 根元素 SHALL 为 `<div>`，而非 `<span>`

### Requirement: TextContent size 控制字号

`TextContent` 的 `size` prop SHALL 通过 CSS class 控制字号、字重和行高，各档位对应值如下：

| size | font-size | font-weight | line-height |
|------|-----------|-------------|-------------|
| `small` | 14px | 400 | 20px |
| `default` | 16px | 400 | 24px |
| `large` | 18px | 400 | 28px |
| `small-heavy` | 14px | 600 | 20px |
| `large-heavy` | 18px | 600 | 28px |

#### Scenario: large-heavy 应用正确样式

- **WHEN** 渲染 `TextContent("标题", "large-heavy")`
- **THEN** 根元素 SHALL 应用对应 CSS class，字号为 18px、字重为 600

### Requirement: TextContent LLM 描述清晰

`TextContent` 的 `description` 字段 SHALL 向 LLM 说明：支持 markdown、可选 size 枚举值。

#### Scenario: description 包含 markdown 能力说明

- **WHEN** library prompt 生成时
- **THEN** `TextContent` 的描述 SHALL 包含 "markdown" 关键词及所有 size 枚举值

### Requirement: 移除 Text 组件

`Text` 组件 SHALL 从 DSL 组件库中移除，不保留向后兼容别名。

#### Scenario: Text 不在注册表中

- **WHEN** `dslLibrary` 初始化时
- **THEN** 组件注册表 SHALL NOT 包含名为 `Text` 的组件
