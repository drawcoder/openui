## ADDED Requirements

### Requirement: Table SHALL support an expandRow argument for nested array rendering
The Table component SHALL accept an optional third positional argument `expandRow` that accepts a `@Render` template. When provided, each row in the table SHALL be expandable to reveal the rendered template content, with the current row record bound to the `@Render` binder variable.

#### Scenario: expandRow renders nested content for each row
- **WHEN** a Table is defined with a third `@Render` argument
- **THEN** each row displays an expand chevron
- **AND** clicking the chevron renders the `@Render` body with the row record bound to the declared binder variable
- **AND** nested array fields on the row (e.g. `device.interfaces`) are accessible inside the template

#### Scenario: Rows auto-expand when parent count is small
- **WHEN** a Table with `expandRow` has 3 or fewer rows
- **THEN** all rows are expanded by default without requiring user interaction

#### Scenario: Rows are collapsed by default when parent count exceeds threshold
- **WHEN** a Table with `expandRow` has more than 3 rows
- **THEN** all rows are collapsed by default
- **AND** each row can be individually expanded by clicking its chevron

#### Scenario: Table without expandRow is unaffected
- **WHEN** a Table is defined with only columns and rows (no third argument)
- **THEN** no expand chevron is shown
- **AND** the table renders identically to current behavior

### Requirement: Table component description SHALL document the expandRow pattern
The Table component's prompt-facing description SHALL include a concise reference to the `expandRow` argument so that LLMs generating DSL for parent-child nested data discover the pattern from the component signature.

#### Scenario: LLM sees expandRow in component signature context
- **WHEN** the system prompt includes the Table component signature and description
- **THEN** the description mentions `expandRow?` and its `@Render` usage
- **AND** the description retains the existing Col authoring guidance
