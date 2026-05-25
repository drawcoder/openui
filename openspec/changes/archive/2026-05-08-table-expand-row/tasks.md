## 1. Schema & Component Props

- [x] 1.1 Add `expandRow: z.any().optional()` to `TableSchema` in `Table/schema.ts`
- [x] 1.2 Update `Table/index.tsx` component definition to pass `expandRow` prop to `TableView`
- [x] 1.3 Update Table component `description` in `Table/index.tsx`: `"Data table: Table(columns, rows, expandRow?). Col(title, field, options?) defines each column. For nested array fields, pass @Render(\"item\", Table([childCols], item.nestedField)) as 3rd arg — rows auto-expand when ≤3 parents."`

## 2. TableView Expandable Rendering

- [x] 2.1 Add `expandRow?: (...args: unknown[]) => ReactNode` to `TableViewProps` in `Table/view/index.tsx`
- [x] 2.2 Add `expandable` prop to `AntTable` in `TableView`: `expandedRowRender: (record) => expandRow(record)`, present only when `expandRow` is defined
- [x] 2.3 Set `defaultExpandAllRows: rows.length <= 3` inside the `expandable` config

## 3. Tests

- [x] 3.1 Add unit test in `Table/index.test.tsx`: Table with `expandRow` renders expand chevron and expanded content per row
- [x] 3.2 Add unit test: Table with ≤3 rows and `expandRow` has `defaultExpandAllRows` true
- [x] 3.3 Add unit test: Table without `expandRow` renders no expand chevron (no regression)

## 4. Eval Verification

- [x] 4.1 Run `pnpm build` in `packages/react-ui-dsl` and confirm no type errors
- [x] 4.2 Run `pnpm test` in `packages/react-ui-dsl` and confirm all tests pass
- [x] 4.3 Regenerate `array-with-nested-arrays` benchmark snapshot via `REGEN_SNAPSHOTS=1 pnpm test:e2e:regen` — do NOT manually edit the `.dsl` file
- [x] 4.4 Run `pnpm eval start --suite benchmark` and confirm `array-with-nested-arrays` score improves from 4 → ≥7