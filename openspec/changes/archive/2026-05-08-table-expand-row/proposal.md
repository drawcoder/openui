## Why

When data contains parent records with nested arrays (e.g. devices → interfaces), the LLM must currently use `@Each + Card + embedded Table` — a pattern that silently produces empty tables due to a materializer scoping bug (HOR-18). Even after that bug is fixed, the Card-per-parent layout is verbose and does not scale well with large datasets. A standard expandable-row Table pattern better fits this data shape and is already natively supported by Ant Design.

## What Changes

- **Table** gains an optional 3rd positional argument `expandRow` that accepts a `@Render` template
- Clicking a row expands it to render the template with the row record bound to the `@Render` binder variable
- Rows auto-expand by default when there are ≤3 parent rows; collapse when >3
- Table component `description` is updated to document `expandRow` so LLMs discover the pattern from the component signature
- Benchmark snapshot for `array-with-nested-arrays` is regenerated (not manually edited) after the implementation lands

## Capabilities

### New Capabilities

_(none — this extends an existing capability)_

### Modified Capabilities

- `llm-friendly-table-dsl`: Table gains a new `expandRow` argument that expands rows to render nested array data via `@Render`

## Impact

- `packages/react-ui-dsl/src/genui-lib/Table/schema.ts` — add `expandRow: z.any().optional()`
- `packages/react-ui-dsl/src/genui-lib/Table/index.tsx` — update component description; pass `expandRow` to `TableView`
- `packages/react-ui-dsl/src/genui-lib/Table/view/index.tsx` — add Ant Design `expandable` prop with `defaultExpandAllRows: rows.length <= 3`
- No changes to `hydrateSlots`, `evaluator`, or `materialize` — existing `@Render` hydration handles `expandRow` automatically
- `benchmark-snapshots/array-with-nested-arrays.dsl` regenerated via regen script (not hand-edited)
