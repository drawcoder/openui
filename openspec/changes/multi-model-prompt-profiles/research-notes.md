# Research Notes

两份社区调研报告的内容固化，便于后续翻阅与佐证 design.md 中的决策。

---

## Report 1 — 多模型 prompt 适配 / 自动优化 / Lost-in-the-middle

### 1. 多模型 prompt 工程的工程模式

业界没有事实标准，最值得参考的是面对相同痛点的几家：

- **Aider** — YAML profile + 多层叠加（home / repo / cwd），后到先得。每个模型一个 dict（`name`, `edit_format`, `use_repo_map`, `use_system_prompt`, `extra_params`...）。`aider/extra_params` 全局生效，具体模型条目覆盖。Coder 实现挑选不同 edit format 与 prompt 变体。
  - https://aider.chat/docs/config/adv-model-settings.html
- **Cursor** — GPT-5 vs Claude **完全不同的 prompt**（GPT-5 668 token、Claude 71 token），甚至给的工具都不一样（GPT-5 用 `apply_patch`/`edit_file`，Claude 用 `search_replace`/`write`），GPT-5 还多出 `multi_tool_use.parallel`。
  - https://www.adiasg.com/blog/comparing-cursors-prompts-across-models
- **DSPy** — 不写 prompt，写 typed signature + metric，让 compiler 用 `MIPROv2` / `GEPA` 针对每个模型生成最优 prompt。
  - https://dspy.ai/learn/optimization/optimizers/
- **LangChain / LlamaIndex** 没有 profile 概念；orchestration 层把 model 差异交给上层模板。

→ 借鉴：Aider 的 YAML + 继承模式；Cursor 的"敢分叉"勇气（profile 应允许改 section 顺序、删 section、改 preamble，不止"加几条 rule"）。

### 2. Prompt 规则膨胀治理

- **Token Ablation / Prompt Debloat** — 逐 token / 逐段移除测 metric。已有商用工具，但 token 级太细，应做 rule 级。
  - https://promptdebloat.datawizz.ai/
- **RAG-MCP**（arxiv 2505.03275）— tool/rule/example 全量塞改为存到 vector index 按 query 取 top-k。原文针对 tool selection 实验，prompt token 砍 50%+，准确率提升 3 倍。机制对 example 同样适用。
  - https://arxiv.org/abs/2505.03275
- **Decagon 的生产经验** — 500 样本反不如 20-100，强制 1500 字符长度上限 4× 压缩质量几乎不掉。强烈提示 46 条 rules 极可能过拟合。
  - https://decagon.ai/blog/optimizing-gepa-for-production
- **Anthropic / OpenAI 官方** — "show, don't tell"；用 examples 而不是 rules。

→ 借鉴：rule-level ablation；用 holdout 集决策；用正例代替反例。

### 3. Qwen3-30B-A3B-Instruct-2507 已知特性

- **官方推荐参数**：`temperature=0.7, topP=0.8, topK=20, minP=0`，output length 16384，context 262144 native。`presence_penalty=0~2` 用来抑制重复但过高会触发**语言混杂**（中英混杂场景注意）。
- **`Instruct-2507` ≠ `Thinking-2507`**：必须 `enable_thinking=False`。
- **vLLM `enable_thinking=False` + `guided_json/guided_choice` 有 bug**：受限解码会被绕过、输出垃圾字符。
  - https://github.com/vllm-project/vllm/issues/27447
  - https://github.com/vllm-project/vllm/issues/18819
  - **直接判了 grammar-constrained decoding 在当前 stack 上不可靠**
- **JS 先验更强**：可能因为训练数据中 JS/TS 占比高；中文 prompt 下"回退到训练 prior"倾向更明显。
- modelcard：https://huggingface.co/Qwen/Qwen3-30B-A3B-Instruct-2507

→ 借鉴：sampling 参数立刻应用；profile 末尾加输出格式 anchor（"Your output must start with: root = VLayout(...)"）；不要指望 vLLM guided_grammar 救场。

### 4. DSPy / GEPA / TextGrad 自动 prompt 优化

- **GEPA** (arxiv 2507.19457, ICLR 2026 Oral)：比 MIPROv2 强 13%，**只需 10 个样本、20-100 次评估**。LLM 反思 trajectory + 提案改进 + Pareto frontier。Decagon 生产里 150 次调用拿到 baseline。
  - https://arxiv.org/abs/2507.19457
- **MIPROv2**：贝叶斯搜索 instruction × demo，sample-hungry。
  - https://dspy.ai/api/optimizers/MIPROv2/
- **Amazon Nova migration paper**：专门针对 model migration。"frontier LM 反思 failure → 自动改 prompt → validate → iterate"。这是 GEPA 的工业版。
  - https://aws.amazon.com/blogs/machine-learning/improve-amazon-nova-migration-performance-with-data-aware-prompt-optimization/

→ 借鉴：当下不上，但 profile 把 `antiPatterns: string[]` / `examples: string[]` 数组化，保留 swap 入口。

### 5. Section ordering / Lost-in-the-middle

- **Lost in the Middle** (Liu et al. arxiv 2307.03172)：U 型 attention，**头尾强、中间弱，30%+ accuracy drop**。RoPE 位置编码是直接成因。Qwen3 native 256K 但实测 32K-64K 之外明显衰减。
  - https://arxiv.org/abs/2307.03172
- **Found in the Middle** (arxiv 2403.04797)：calibration 缓解但没消除根因。
  - https://arxiv.org/pdf/2403.04797
- **Attention Instruction** (arxiv 2406.17095)：用 prompt 显式指挥模型注意中段，有效但补丁式。
  - https://arxiv.org/html/2406.17095v1

Mitigation：
1. 关键约束放头尾不放中间
2. 重复关键约束（头部声明 + 末尾再短重复）
3. Reranking（动态把最相关 example 排到顶尾）

→ 借鉴：anti-pattern 强制注入 syntax rules 之后 + final verification 之前两槽。这一改动零成本，可能就是 4 个 parse fail 中 2 个的解药。

---

## Report 2 — Few-shot 选择 / Grammar 约束 / DSL 设计 / Prompt 框架

### 1. Few-shot 动态选择 / RAG prompting

- **CEDAR** (Nashid et al., ICSE'23)：embedding 相似度（BM25 或 dense）挑 top-K，6-shot retrieval 优于任何 random sampling。"质量 ≫ 数量"是稳定结论。
  - https://people.ece.ubc.ca/amesbah/resources/papers/cedar-icse23.pdf
- **arxiv 2510.27675**：code generation 场景下 input/output **structural similarity**（AST 形状/任务类别匹配）比纯文本 embedding 更鲁棒。
  - https://arxiv.org/pdf/2510.27675
- **GitHub Copilot**：FIM + neighboring tabs + 仓库内 RAG，BM25 检索"看似相关"代码片段塞 prompt。
  - https://www.zenml.io/llmops-database/improving-contextual-understanding-in-github-copilot-through-advanced-prompt-engineering
- **Cursor**：自训练 retrieval 模型，按"当前编辑文件 + 光标位置"动态拼上下文。
- 共同点：**永远不静态喂全部 example**。

→ 借鉴：openui-lang **不需要 embedding**。input dataModel 的形状特征是离散可枚举的（array of records / single object / nested array / contains epoch ms / contains byte field / number[] / 动态 key map / pagination envelope...）。纯代码 classifier 几十行 if/else，规则匹配吊打向量。

### 2. Grammar-constrained decoding 现状

- **XGrammar** (mlc-ai/xgrammar, NeurIPS'24, paper arxiv 2411.15100)：CFG mask 计算从几百 ms/token 压到接近零（JSON < 5%、通用 CFG < 15%）。**已默认集成到 vLLM** (v0.6.5+)，用法 `guided_grammar="..."` 直接传 EBNF/Lark。SGLang 同样原生支持。
  - https://github.com/mlc-ai/xgrammar
  - https://docs.vllm.ai/en/latest/features/structured_outputs/
  - https://blog.vllm.ai/2025/01/14/struct-decode-intro.html
  - https://arxiv.org/pdf/2411.15100
- **可行性**：openui-lang 是标准 CFG（positional args、嵌套 calls、表达式、`@builtin`、`$binding`），完全可从 lang-core parser 反推 EBNF。Hoisting 在 *decoding* 层不是问题（grammar 只管语法合法，不管 reference resolve）。
- **延迟代价**：qwen3-30b-a3b 是 MoE（30B 总 / 3B 激活），per-token 已快，XGrammar mask 开销几十微秒，可忽略。
- **陷阱**：不能保证语义正确（`Card("title", "card", "card")` 若 grammar 允许仍会出现），所以 grammar 写得越严越好（variant/size 用 enum）。OpenAI-compatible API 路径不一定能透传 `guided_grammar`，自建 vLLM 可直接用。

→ 借鉴：**中长期一定做**，**短期不是 P0**。判分掉的部分是语义问题，grammar 救不了。先做 prompt 层修语义，grammar 是后续根治层。

### 3. DSL 设计本身的 LLM 友好度

- **LLM4CAD-DSL**：自定义函数名越多，幻觉率越高；fine-tuned 反而比 RAG 在 syntax error 上更差（few-shot 教 syntax 比 fine-tune 更有效）。
  - https://www.researchgate.net/publication/400420974_LLM4CAD-DSL_An_LLM-Friendly_Domain-Specific_Language_for_Computer-AidedDesign_Generation
- **DSL-Xpert 2.0**：同类结论。
  - https://www.sciencedirect.com/science/article/pii/S0950584925002939
- **Dean Mai "LLM-Hardened DSLs"**：核心准则——
  - 固定模板结构 + 显式枚举的控制流 > 自由表达式
  - 少而正交的 builtin（名字撞 JS / Python 标准库的越多越乱补）
  - failure 早 + 错误信息可机读
  - 不追求语法糖（Mermaid/PlantUML 成功不是因为语法漂亮，而是词汇表小、模型见得多）
  - https://deanm.ai/blog/2025/5/24/toward-data-driven-multi-model-enterprise-ai-7e545-sw6c2
- **Mermaids Unbroken** (Microsoft GenAIScript blog)：parse 失败时把错误信息塞回去让模型自修，**1 轮自修能补回 80%+ parse error**。
  - https://microsoft.github.io/genaiscript/blog/mermaids/
- **MermaidSeqBench** (arxiv 2511.14967)：简短模板化 syntax 的 parse 通过率比开放语法**高 15-30 个点**。
  - https://arxiv.org/html/2511.14967v1

针对 qwen3 触发的两类错误：
- **`.toString()` / `Math.*` 幻觉**：JS prior 太强。两个解法：
  1. grammar 强制（见 §2）
  2. 在 prompt 里**正面给"该这么写"的小例子**，而不是只在 rule 里说"不要"。负面指令在 long context 末尾会被忽略，正面 demonstration 不会
- **多余 args**：Mermaid 解法是**让组件 arity 完全固定**。`Card(children, variant?, size?)` 末尾可选位置参数对模型是 noise——要么补全部要么补错。要么改必填，要么挪到 options 对象。

→ 借鉴：
1. 短期审查"末尾可选位置参数 ≥ 2 个"的组件，重构为 options 对象（独立 change）
2. **加 self-repair 循环**——ROI 极高，工程量小
3. **不再加规则，加正例** — 每条"don't do X"配一个"do Y instead"的可执行 snippet

### 4. 长 prompt 注意力衰减 / Examples 数量与位置

- **Many-Shot ICL** (NeurIPS 2024)：frontier 模型（Claude 3, Gemini 1.5）在 50-500 shot 还能涨分，**但 30B 量级开源模型 8-shot 之后边际收益锐减，15+ 反向掉分（distractor 效应）**。
  - https://proceedings.neurips.cc/paper_files/paper/2024/file/8cb564df771e9eacbfe9d72bd46a24a9-Paper-Conference.pdf
- **Role of Diversity** (arxiv 2505.19426)：code generation OOD-prone 任务，**diverse 8 shots > similar 16 shots**。多样性 > 数量。
  - https://arxiv.org/html/2505.19426
- **Qwen3-32b 长 prompt 实测**：540 行 / ~20KB 触发 looping gibberish 和 function 幻觉。**openui-lang 当前 prompt ~800-1000 行已到危险区**。
  - https://github.com/eugr/spark-vllm-docker/issues/115

具体 layout：
- 顶部：preamble + 最关键 5-8 条反模式
- 顶部 + 重复在底部：critical rules（末尾位置 attention 仍强）
- 中段：语言定义、组件签名（reference 性质，模型反复回看）
- 底部 examples：紧贴用户 query 之前；每条前加一句"this example demonstrates X"

→ 借鉴：动态选 5-8 条；关键反模式条目同时放头尾两次；先量当前 prompt 总 token，> 12K 先暴力砍 30% 看效果。

### 5. 生产级 Prompt 模板系统

- **BAML** (BoundaryML/baml)：2025 年事实赢家。prompt 写成 TS function signature 风格，带 schema、retry policy、模型路由、版本管理、日志。生产案例：ClickHouse、Cognee、Notion、Vercel 内部。
  - https://github.com/BoundaryML/baml
  - https://docs.boundaryml.com/home
  - https://clickhouse.com/blog/bringing-structure-to-llm-workflows-with-boundary-and-clickhouse
  - https://www.cognee.ai/blog/integrations/structured-outputs-with-baml-and-cognee
- **Microsoft Guidance**：2024-2025 活跃度断崖下降。token-level 控制不上 vLLM 主流，模板可读性也输 BAML。新项目不推荐。
- **LMQL**：学术血统，生产采用率小。

判断：openui-lang **不需要换框架**。BAML 等主要解决"字符串拼接 → 结构化编排"，但 prompt.ts 已是 sectioned + functional 组合，该有结构已有。引入 BAML 等于重写 prompt 子系统，投入大回报有限。**真正缺的是给现有架构加 4 样东西**：profile / dynamic example / ablate / self-repair。这 4 样在 TS 代码加 200-400 行就能做完。

唯一例外：以后要支持**多 LLM 提供商切换**（OpenAI / Anthropic / DeepSeek / 阿里云 / 自建 vLLM），BAML 的 model routing 和 cost tracking 会救命——但那是另一个问题，与 qwen3 适配无关。

→ 借鉴：不引入第三方框架。

---

## 综合：两份调研在 B 方案上的合并落点

两份调研在以下点上**强一致**（双重信号）：

1. **Lost-in-the-middle 是最大免费午餐** — 重排版面零成本
2. **不上 grammar 约束**（短期）—— Fork 1：vLLM 在 Instruct-2507 上有 bug；Fork 2：语义类失败 grammar 救不了；先修 prompt 层
3. **不引第三方 prompt 框架** — sectioned prompt.ts 已有同等抽象
4. **examples 多样性 > 数量** — 30B 模型 8-shot 之后边际收益锐减
5. **GitHub Copilot / Cursor 都是动态选 example**，从不静态全推

Fork 2 带进的两个**Fork 1 没说**的高价值点：

- **Self-repair 循环**：parse 失败回喂错误让模型修 1 次，Mermaid 80%+ 恢复率，工程量极小
- **"never X" → "do Y" 正例化**：负面指令在长 context 末尾会被忽略，正例不会

Fork 1 带进的**Fork 2 没说**的关键点：

- **Qwen3 官方 sampling**：T=0.7, TopP=0.8, TopK=20, MinP=0, **enable_thinking=false**
- **vLLM 在 Instruct-2507 上 guided_grammar 当前不可靠**
- **Aider YAML profile 多层叠加**：user/repo/cwd 后到先得
- **Decagon 数据**：500 样本不如 20-100；1500 字符强约束 4× 压缩质量几乎不掉
- **GEPA**：比 MIPROv2 强 13%，10 样本 + 20-100 评估即可。当前不上但接口预留

**统一进入 design.md 的最终 B 方案分阶段**：

阶段 0（零成本）：sampling + section 重排
阶段 1（低成本）：self-repair retry
阶段 2（中等）：profile 抽象 + L2/L3 拆分 + corePolicy
阶段 3（中等）：examples 重构 + classifyDataShape + tag 选择 + "never→do" 改写
阶段 4（一次性投入）：ablate harness + 跑 ablate:all + 回收 pending-ablation
阶段 5（持续）：bloat lint + 文档
