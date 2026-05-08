## Context

Table currently takes two positional arguments: `columns` (array of Col) and `rows` (array of records). When a dataset has parent records each containing a child array (e.g. `devices[].interfaces[]`), the LLM generates `@Each + Card + nested Table`. This pattern is fragile — a materializer scoping bug (HOR-18) silently drops the loop variable, emptying the inner table.

The `hydrateSlots` mechanism already converts `@Render` AST nodes into typed render functions. Ant Design's `AntTable` natively supports `expandable.expandedRowRender`. These two facts make the `expandRow` feature achievable with minimal new infrastructure.

## Goals / Non-Goals

**Goals:**
- Add optional `expandRow` as 3rd positional arg on Table, accepting a `@Render` template
- Wire `expandRow` to Ant Design's `expandable.expandedRowRender`
- Auto-expand all rows when parent row count ≤ 3; collapse by default when > 3
- Update Table component description so LLMs discover the pattern from the signature

**Non-Goals:**
- Fix the `@Each` + named-statement materializer scoping bug (tracked in HOR-18)
- Add manual pagination controls or expandRow state management
- Support multiple levels of nesting (only one level of expandRow)
- Modify `hydrateSlots`, `evaluator`, or `materialize`

## Decisions

**Decision: 4th positional argument, not options object**

Chosen because it keeps the DSL terse:
```
Table([cols], rows, @Render("device", Table([childCols], device.interfaces)))
```
vs options object:
```
Table([cols], rows, {expandRow: @Render("device", ...)})
```
Trade-off: The 3rd positional slot can't later hold both an options object and `expandRow` simultaneously. Accepted — no current use case requires a 3rd options object on Table.

**Decision: Reuse `@Render` hydration via `hydrateSlots`**

`@Render("binder", Body)` is already converted by `hydrateSlots` to `(binder) => ReactNode` before the component renders. `TableView.expandedRowRender(record)` calls this function directly with the row — no new evaluation path needed.

**Decision: Auto-expand threshold = 3 rows**

When ≤ 3 parent rows exist, all are expanded by default (data is immediately visible). When > 3, rows are collapsed (avoids visual overload). This is a static check on `props.rows.length` at render time, not reactive to user interaction.

## Risks / Trade-offs

- **`expandRow` receives the full row object, not a field value** → The binder resolves to `record` (a plain JS object). Accessing `device.interfaces` works. Accessing non-existent fields returns `undefined`, which renders as empty — same as everywhere else in the DSL.

- **Nested Table inside expandRow reuses `renderNode`** → `hydrateSlots` receives the global `renderNode` closure. The inner Table renders through the same `RenderNode` chain. No isolation issues expected, but untested for deeply nested `@Render` inside `expandRow`.

- **`defaultExpandAllRows` is Ant Design-controlled** → Once the user collapses a row, the component does not re-expand it (standard Ant Design behavior). No special state management needed.

## Migration Plan

No breaking changes. `expandRow` is optional; existing `Table(cols, rows)` calls are unaffected. No migrations required.

## Open Questions

_(none — all decisions resolved during brainstorm)_
