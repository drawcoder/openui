## 1. Baseline and Invocation

- [ ] 1.1 Capture a ds-flash/deepseek baseline and qwen3 legacy baseline on the same benchmark suite.
- [ ] 1.2 Add qwen3 eval/regen invocation options, including required sampling fields and `enable_thinking=false` provider extras.
- [ ] 1.3 Record selected model adapter and normalized invocation options in report metadata without exposing secrets.

## 2. Prompt Hardening Structure

- [ ] 2.1 Add a prompt variant option with `legacy` and `hardened` modes while preserving current default behavior.
- [ ] 2.2 Split React UI DSL prompt content into language contract, component contract, generation contract, rendering policy, and examples.
- [ ] 2.3 Promote universal parseability, data fidelity, scope, reachability, and component arity constraints into high-attention prompt positions.
- [ ] 2.4 Add a concise final verification checklist for the hardened prompt.

## 3. Positive Examples and Selection

- [ ] 3.1 Convert hard-coded examples into tagged example records with stable IDs.
- [ ] 3.2 Add positive examples for JavaScript API alternatives, `@Render` row binders, inline `@Each` templates, and missing-data fallbacks.
- [ ] 3.3 Implement deterministic data-shape classification for arrays, single records, object maps, paginated envelopes, byte fields, numeric arrays, null-dominant records, and chart-ready time series.
- [ ] 3.4 Implement compact example selection with diversity preference and a small required fallback set.
- [ ] 3.5 Record selected example IDs and prompt size in report metadata.

## 4. Parse Validation and Repair

- [ ] 4.1 Add reusable generation validation that parses generated DSL with the same parser configuration used by the target e2e suite.
- [ ] 4.2 Add optional one-shot repair for parse failures, including previous output excerpt and structured parser errors.
- [ ] 4.3 Record original validation failures, repair attempts, and final validation results in report metadata.
- [ ] 4.4 Ensure semantic judge failures do not trigger repair.

## 5. Evaluation and Defaulting

- [ ] 5.1 Run qwen3 legacy versus qwen3 hardened benchmark comparison and record parse/judge deltas.
- [ ] 5.2 Run ds-flash/deepseek legacy versus hardened comparison to detect regressions.
- [ ] 5.3 Decide whether hardened prompt becomes the eval/regen default for all models or only qwen3 during the migration.
- [ ] 5.4 Document rollback instructions for switching back to `legacy` and disabling repair.

## 6. Verification

- [ ] 6.1 Add unit tests for prompt variant selection and high-attention placement.
- [ ] 6.2 Add unit tests for data-shape classification and example selection diversity.
- [ ] 6.3 Add unit tests for repair trigger behavior, including parse success, parse failure repaired, and parse failure unrepaired cases.
- [ ] 6.4 Run `pnpm test:e2e` and the benchmark report flow relevant to this change.
