## ADDED Requirements

### Requirement: MarkDownRenderer 组件 schema

`MarkDownRenderer` 组件 SHALL 接受以下 props：
- `textMarkdown: string`（必填）：markdown 格式的文本内容
- `variant?: "clear" | "card" | "sunk"`（可选）：容器视觉样式，默认 `"clear"`

#### Scenario: 注册为 DSL 组件

- **WHEN** `dslLibrary` 初始化时
- **THEN** `MarkDownRenderer` SHALL 出现在组件注册表中

#### Scenario: schema 校验通过

- **WHEN** LLM 生成 `MarkDownRenderer(data.readme, "card")`
- **THEN** Zod schema 校验 SHALL 通过，组件正常渲染

#### Scenario: variant 省略时使用 clear

- **WHEN** LLM 生成 `MarkDownRenderer(text)`（不传 variant）
- **THEN** 组件 SHALL 以无容器样式（clear）渲染

### Requirement: MarkDownRenderer 渲染 markdown 内容

`MarkDownRenderer` SHALL 将 `textMarkdown` 的内容通过 markdown 渲染器处理，支持标题、列表、代码块、表格等常见 markdown 元素。

#### Scenario: 代码块正确渲染

- **WHEN** `textMarkdown` 包含 fenced code block（如 ` ```js ... ``` `）
- **THEN** 组件 SHALL 输出 `<pre><code>` 元素，保留代码格式

#### Scenario: 段落首尾 margin 处理

- **WHEN** `textMarkdown` 包含多个段落
- **THEN** 首个 `<p>` 的 `margin-top` SHALL 为 0，最后一个 `<p>` 的 `margin-bottom` SHALL 为 0

### Requirement: MarkDownRenderer variant 控制容器样式

`MarkDownRenderer` 的 `variant` prop SHALL 控制外层容器的视觉样式：

| variant | 样式描述 |
|---------|---------|
| `clear` | 无边框、透明背景（无额外容器样式） |
| `card` | 有边框、白色背景、圆角、内边距 |
| `sunk` | 有边框、浅灰背景、圆角、内边距 |

容器样式 SHALL 复用 `Card` 组件中已定义的 CSS 变量（`--openui-foreground`、`--openui-sunk`、`--openui-border-default`、`--openui-radius-3xl`、`--openui-space-l` 等）。

#### Scenario: card variant 显示边框和背景

- **WHEN** 渲染 `MarkDownRenderer(text, "card")`
- **THEN** 根元素 SHALL 应用 card CSS class，包含边框色和白色背景

#### Scenario: sunk variant 显示凹陷背景

- **WHEN** 渲染 `MarkDownRenderer(text, "sunk")`
- **THEN** 根元素 SHALL 应用 sunk CSS class，背景色为 `--openui-sunk`

#### Scenario: clear variant 无容器样式

- **WHEN** 渲染 `MarkDownRenderer(text, "clear")`
- **THEN** 根元素 SHALL 无边框、无额外背景色

### Requirement: MarkDownRenderer LLM 描述清晰

`MarkDownRenderer` 的 `description` 字段 SHALL 向 LLM 说明：适用于富文档/长 markdown 内容，可选容器样式。

#### Scenario: description 说明使用场景

- **WHEN** library prompt 生成时
- **THEN** `MarkDownRenderer` 的描述 SHALL 区分其与 `TextContent` 的使用场景（文档内容 vs UI 文字元素）

### Requirement: 共享内部 markdown 渲染器

`TextContent` 和 `MarkDownRenderer` SHALL 复用同一个内部渲染器组件（`Components/MarkdownView`），该组件 SHALL：
- 仅支持 markdown 渲染模式
- 不暴露为 DSL 组件
- 处理 `<p>` 首尾 margin

#### Scenario: MarkdownView 不在 DSL 注册表中

- **WHEN** `dslLibrary` 初始化时
- **THEN** `MarkdownView` SHALL NOT 出现在 DSL 组件注册表中

#### Scenario: html 模式不再支持

- **WHEN** 任何 DSL 组件尝试以 `dangerouslySetInnerHTML` 渲染内容
- **THEN** 该能力 SHALL NOT 存在于任何 DSL 组件的 schema 或实现中
