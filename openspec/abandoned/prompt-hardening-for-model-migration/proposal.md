> Abandoned: 本 change 已放弃，替代方案为 `react-ui-dsl-prompt-strictness`。
>
> 原因：旧方案范围过大，把 prompt hardening、legacy/hardened variant、模型调用参数、data-shape selection、validation 和 self-repair 混在一起。新的 change 收窄为 prompt-only：先重构 React UI DSL standard prompt，再通过 `strictness` 支持 qwen3 等迁移调优场景。

## Why

Switching the `react-ui-dsl` generation benchmark from ds-flash/deepseek-style behavior to `qwen3-30b-a3b-instruct-2507` exposed a large quality regression: parse failures increased and semantic judge scores dropped even though many violated constraints already existed in the prompt.

This change treats qwen3 as a migration stress test for the prompt and generation loop. The goal is to restore model portability by hardening the shared prompt structure and validation flow, not by accumulating qwen3-only rules or building a general prompt-management platform.

## What Changes

- Add a model-migration prompt hardening path for `react-ui-dsl`:
  - Move a small set of universal critical generation constraints into high-attention prompt positions.
  - Convert key negative rules into positive, executable examples.
  - Reduce static few-shot noise by selecting a compact, data-shape-relevant example set.
  - Add a final verification checklist focused on parseability, data fidelity, scope, reachability, and component arity.
- Add a thin model adapter for qwen3:
  - Apply qwen3's required sampling/provider options in eval/regen flows.
  - Keep qwen3-specific behavior limited to invocation options and prompt budget preferences, not product or syntax rules.
- Add one-shot parse self-repair to the generation flow:
  - Validate generated OpenUI Lang before snapshot/report acceptance.
  - If parse validation fails, send a repair prompt with the previous output and parser errors.
  - Retry at most once and report both attempts.
- Add prompt/render observability to eval outputs:
  - Record the selected model, prompt variant, prompt size, selected examples, and repair attempts.
  - Preserve ds-flash/deepseek-compatible behavior through a legacy/default prompt path for comparison.
- Defer broader platform work:
  - No third-party prompt management framework is introduced.
  - No multi-layer profile inheritance system is introduced.
  - No grammar-constrained decoding is introduced in this change.
  - No DSL grammar/API redesign is included; component positional-argument hardening remains a separate future change.

## Capabilities

### New Capabilities

- `model-migration-prompt-hardening`: Prompt and generation behavior required to keep OpenUI Lang generation portable when switching LLMs.

### Modified Capabilities

- `semantic-regression-testing`: Eval/report behavior records prompt variant, model options, selected examples, and repair attempts so model migration regressions can be diagnosed and compared.

## Impact

- `packages/lang-core/src/parser/prompt.ts`: Adds structured high-attention sections and final verification placement hooks without encoding qwen3-specific rules.
- `packages/react-lang/src/library.ts`: Passes through prompt hardening options needed by component libraries.
- `packages/react-ui-dsl/src/genui-lib/dslLibrary.tsx`: Splits rules/examples into universal generation constraints, component rendering policy, and tagged examples.
- `packages/react-ui-dsl/src/genui-lib/examples/`: New tagged example registry and data-shape classifier.
- `packages/react-ui-dsl/src/__tests__/e2e/llm.ts`: Applies qwen3 invocation options, validates generated DSL, and performs at most one repair attempt on parse failure.
- `packages/react-ui-dsl/src/__tests__/e2e/report*` and eval helpers: Include prompt/model/repair metadata in reports.
- Existing callers remain compatible when they do not opt into the hardened prompt variant.
