## 1. Prompt API

- [ ] 1.1 在 `PromptOptions` 中增加 `strictness?: "standard" | "strict"` 类型字段
- [ ] 1.2 确认 `lang-core` 的 `generatePrompt()` 不消费 strictness，避免把 React UI DSL prompt 强度语义下沉到通用 prompt 组装器
- [ ] 1.3 为 `dslLibrary.prompt()` 的 standard 默认行为补充类型或单元测试覆盖

## 2. Standard Prompt 重构

- [ ] 2.1 将当前 `DEFAULT_PROMPT_ADDITIONAL_RULES` 重命名并重构为 `STANDARD_PROMPT_ADDITIONAL_RULES`
- [ ] 2.2 合并重复或重叠的规则，保留覆盖 data fidelity、scoping、formatting、component choice、null fallback、object map、chart/MiniChart 的可复用规则
- [ ] 2.3 将当前 `DEFAULT_PROMPT_EXAMPLES` 重命名并重构为 `STANDARD_PROMPT_EXAMPLES`
- [ ] 2.4 将示例整理为可复用模式示例，避免只服务单个 fixture 的历史补丁
- [ ] 2.5 保证调用方传入的 `additionalRules` 和 `examples` 仍追加到 standard base 内容之后

## 3. Strict Prompt 强度

- [ ] 3.1 新增 `STRICT_PROMPT_ADDITIONAL_RULES`，用于在 standard 基础上重申高频硬约束
- [ ] 3.2 新增 `STRICT_PROMPT_EXAMPLES`，初始可为空；只有 bench 显示需要正例时才加入可复用 strict 示例
- [ ] 3.3 更新 `mergePromptOptions()`，当 `strictness === "strict"` 时追加 strict extra rules/examples
- [ ] 3.4 添加测试证明 strict prompt 包含 standard 内容和 strict extra 内容，且不包含模型名绑定规则

## 4. Eval / Regen 接入

- [ ] 4.1 为 `pnpm eval start` 增加 `--strictness standard|strict` 命令参数
- [ ] 4.2 对非法 strictness 值 fail fast，并在未传参数时默认使用 `standard`
- [ ] 4.3 将 strictness 从 eval runner 传递到 Vitest 子进程
- [ ] 4.4 在 `llm.ts` regen 路径中读取 strictness 并传给 `dslLibrary.prompt({ strictness })`

## 5. Report Metadata

- [ ] 5.1 在 eval run manifest 或 report run metadata 中记录 strictness
- [ ] 5.2 更新 report 相关类型和测试，确保 strictness 是 run 级字段
- [ ] 5.3 确认 report entry 不重复记录 per-fixture strictness

## 6. Bench 验证

- [ ] 6.1 跑 deepseek/ds-flash 旧 prompt baseline，并记录 bench 结果
- [ ] 6.2 跑 deepseek/ds-flash standard prompt，并确认 bench 质量不回退
- [ ] 6.3 跑 qwen3 standard prompt，建立迁移对照
- [ ] 6.4 跑 qwen3 strict prompt，确认 strict 是否改善 qwen3 bench 质量
- [ ] 6.5 如果 strict 仍存在可复用失败模式，再根据 bench 证据补充 strict extra examples 并复跑相关 bench

## 7. 常规验证

- [ ] 7.1 运行相关 unit tests，覆盖 prompt strictness 合并逻辑和 eval CLI 参数解析
- [ ] 7.2 运行 React UI DSL e2e/benchmark report 流程中与本 change 相关的最小验证命令
- [ ] 7.3 更新实现说明或开发文档中涉及 prompt strictness 的使用示例
