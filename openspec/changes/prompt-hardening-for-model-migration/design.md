## Context

`react-ui-dsl` currently builds one large system prompt for all models: language syntax, component signatures, data model, builtins, examples, and 46 additional rules are concatenated in a fixed order. This prompt was tuned through repeated ds-flash/deepseek-style runs, but the migration to `qwen3-30b-a3b-instruct-2507` exposed failures that deepseek tolerated: JavaScript API hallucinations, unbalanced syntax, pseudo-component templates, `@Render` scope mistakes, invented data, and component arity drift.

The project context matters: OpenUI is an embeddable SDK, not a hosted LLMOps service. Prompt construction and UI generation are SDK responsibilities for Node.js and Java backends. This change should therefore improve the SDK's own generation contract instead of depending on external prompt-management services or building a broad platform before the migration is stable.

## Goals / Non-Goals

**Goals:**

- Restore qwen3 benchmark parse rate and semantic quality toward the ds-flash/deepseek baseline.
- Treat qwen3 regressions as a stress test for shared prompt structure, not as permission to add a large qwen3-only rule bundle.
- Make prompt output shorter, more focused, and easier for weaker instruction-following models to obey.
- Add one-shot parse repair as a guarded generation behavior for eval/regen, with a contract that can later move into Node/Java backend SDK generation.
- Preserve a legacy/default prompt path for regression comparison while introducing a hardened prompt variant.
- Record prompt/model/repair metadata in reports so migration results are diagnosable.

**Non-Goals:**

- No third-party prompt-management, prompt-optimization, or LLM orchestration dependency is introduced.
- No multi-layer YAML profile inheritance system is introduced.
- No qwen3-specific product rendering rules are introduced.
- No grammar-constrained decoding is introduced.
- No DSL grammar or component API redesign is included; positional-argument hardening remains a separate change if benchmark evidence justifies it.
- No Java SDK implementation is included in this change, though the validation/repair contract must not make Java integration harder.

## Decisions

### D1: Use prompt hardening, not a qwen3 rule pack

The qwen3 failures are mostly violations of universal OpenUI generation constraints: do not use JavaScript APIs, do not invent data, keep references reachable, keep loop/render binders in scope, and follow component signatures. These constraints should be promoted into a shared "Generation Contract" section instead of duplicated as qwen3 anti-patterns.

Alternative considered: create `qwen3.yaml` with many anti-patterns. Rejected because it makes the prompt harder to reason about and would repeat for every future model migration.

### D2: Keep the model adapter thin

The qwen3 adapter should carry invocation facts and coarse prompt budget preferences only:

- recommended sampling/provider options such as `temperature`, `topP`, `topK`, `minP`, and `enable_thinking=false`;
- compact prompt preference such as lower example count.

It must not own component-library rules like MiniChart, GaugeChart, or Descriptions guidance. Those remain part of the component library prompt pack.

Alternative considered: a general model profile abstraction with section ordering, verbosity, anti-pattern slots, and inheritance. Rejected for the first migration because it solves a broader management problem before we have proven which knobs matter.

### D3: Split prompt content by responsibility

The hardened prompt should be assembled from a small number of stable responsibilities:

- **Language Contract**: openui-lang syntax, builtins, statement rules, and parser-facing constraints.
- **Component Contract**: generated component signatures and component-specific argument facts.
- **Generation Contract**: universal model-output safety constraints, including data fidelity, parseable output, scoping, reachability, and arity.
- **Rendering Policy**: `react-ui-dsl` product/component-library guidance, such as Table vs Descriptions, byte formatting, null-dominant data handling, and MiniChart usage.
- **Examples**: compact, tagged positive examples selected from the data shape.

This keeps `lang-core` free of React component semantics while letting `react-ui-dsl` own its component-library behavior.

### D4: Convert high-risk "never" rules into positive examples

The prompt should not rely only on negative instructions. For high-risk failures, the hardened prompt should include short positive examples that demonstrate the correct replacement:

- `data.total.toString()` becomes `"" + data.total` or `@FormatNumber(data.total, 0)`;
- row-dependent table rendering uses `@Render("v", "row", ...)`;
- `@Each` loop variables stay inside inline templates;
- missing host data is displayed honestly with nullish fallbacks instead of invented rows.

This borrows the research conclusion that demonstrations are more robust than long lists of prohibitions, especially in long prompts.

### D5: Select fewer examples by data shape

The current static examples act as distractors for models with weaker long-context instruction adherence. The hardened variant should select a compact set of examples, usually 5-8, using a deterministic data-shape classifier and stable example tags. The selection should prefer diversity so all selected examples do not collapse into the same table/list pattern.

A small required example set may remain visible for baseline syntax coverage. If no data model is provided, selection falls back to a compact general set.

### D6: Add one-shot parse repair as a generation guardrail

The generation flow should validate the generated DSL before accepting it. On parse failure, it may ask the same model to repair the full program once using structured parser errors and a bounded excerpt of the previous output.

The repair loop is intentionally narrow:

- only parse/validation failures trigger repair;
- semantic judge score failures do not trigger repair;
- maximum retry count is one;
- both attempts are recorded in report metadata;
- callers can disable repair.

This is the fastest path to recover syntax regressions without hiding semantic failures or creating unbounded latency.

### D7: Keep eval integration local and observable

The existing eval/report harness remains the primary feedback loop. The change should extend it to record model, prompt variant, prompt size, selected examples, and repair attempts. A full ablation platform is deferred. First we need a stable hardened variant and a clean before/after comparison against the migration benchmark.

## Risks / Trade-offs

- Hardened prompt hurts deepseek-compatible behavior -> Keep legacy/default prompt mode and compare both variants in eval before making hardened mode the default.
- Dynamic example selection misses a foundational syntax pattern -> Keep a small required example set and record selected example IDs in the report.
- One-shot repair doubles cost for parse failures -> Only run repair on parse failure and record repair frequency; disable in production paths until backend SDK policy is decided.
- qwen3 sampling options are provider-specific -> Keep provider extras in eval/regen model invocation code, not in the language prompt itself.
- Prompt hardening does not fix component API weaknesses -> Track remaining arity/positional failures and open a separate component API hardening change if they persist.

## Migration Plan

1. Add hardened prompt construction behind an explicit prompt variant while preserving current prompt output as `legacy`.
2. Add qwen3 invocation options to eval/regen model calls.
3. Add parse validation and one-shot repair to snapshot regeneration.
4. Extend report metadata so benchmark runs expose prompt variant, model, prompt size, selected examples, and repair attempts.
5. Run ds-flash/deepseek legacy, qwen3 legacy, and qwen3 hardened comparisons on the same benchmark set.
6. If qwen3 hardened closes the regression without deepseek regression, make hardened the default for eval/regen while keeping legacy selectable.

Rollback is straightforward: switch prompt variant back to `legacy` and disable repair.

## Open Questions

- What exact qwen3 provider extra field name should carry `enable_thinking=false` in the current OpenAI-compatible endpoint?
- Should hardened prompt become the default for all models immediately after validation, or only for qwen3 during one migration cycle?
- Should Java SDK later use a Java parser, a shared grammar-generated parser, or a service/WASM boundary for the same validation contract?
