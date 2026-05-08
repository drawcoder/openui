## 1. MiniChart Schema And Runtime

- [x] 1.1 Add a `MiniChart` DSL component schema with positional arguments for `type`, `data`, and optional shared display props.
- [x] 1.2 Implement shared mini-chart data normalization and width-aware truncation helpers for `number[]` and `{ value, label? }[]` inputs.
- [x] 1.3 Implement separate internal ECharts mini-chart views for `line`, `bar`, and `area` rendering and dispatch them from the `MiniChart` component.
- [x] 1.4 Ensure MiniChart uses `react-ui-dsl`'s standalone ECharts runtime/helpers only and does not import runtime code from `packages/react-ui`.

## 2. DSL Library Integration

- [x] 2.1 Register `MiniChart` in the React UI DSL chart exports and `dslLibrary` component list.
- [x] 2.2 Update prompt guidance and examples so MiniChart is described as a compact single-series trend primitive rather than a replacement for full-size charts.
- [x] 2.3 Ensure the exported JSON Schema and prompt surface expose only the compact shared MiniChart public surface.

## 3. Stories And Verification

- [x] 3.1 Add Storybook coverage for `MiniChart` line, bar, and area modes using compact card-style examples.
- [x] 3.2 Add schema and runtime tests covering accepted data shapes, `type` dispatch, and exclusion of full-chart props from the MiniChart contract.
- [x] 3.3 Add or update regression coverage to verify `dslLibrary.toSpec()` and related chart surfaces include `MiniChart` with the expected semantic signature.
- [x] 3.4 Add an e2e DSL regression fixture for MiniChart and assert meaningful rendered chart semantics from the actual runtime output.
- [x] 3.5 Run the MiniChart story/e2e flow and manually inspect the rendered result in the runtime/report harness to confirm the visual output matches the intended compact chart behavior.