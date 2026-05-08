## ADDED Requirements

### Requirement: Table SHALL use an openui-lang-style component schema
The React UI DSL table capability SHALL expose a table schema that is authored as openui lang component declarations rather than as a full anonymous JSON-style column configuration structure.

#### Scenario: Table is authored through component calls
- **WHEN** prompt guidance or examples describe how to define a table
- **THEN** the preferred authoring pattern uses component-style table declarations
- **AND** the preferred pattern does not require authors to construct a full `properties.columns[*]` object array manually

#### Scenario: Columns are declared explicitly
- **WHEN** a table defines one or more columns
- **THEN** each column is represented through an explicit column declaration in the DSL
- **AND** the column declaration is schema-validated as part of the table capability

### Requirement: Table SHALL preserve the Ant Design rendering backend
The React UI DSL table capability SHALL continue rendering through the existing Ant Design table implementation while accepting the new schema as input.

#### Scenario: New schema maps to antd table config
- **WHEN** a table authored with the new schema is rendered
- **THEN** the runtime translates that schema into the antd table configuration required for rendering
- **AND** the rendered output continues using the existing antd-based table component

### Requirement: Table SHALL expose existing table features through schema-level column capabilities
The React UI DSL table capability SHALL preserve current table features such as sorting, filtering, formatting, tooltip display, and custom cell rendering, but expose them through schema-level column capabilities instead of raw anonymous config objects.

#### Scenario: Sort and filter remain available
- **WHEN** a column enables sorting or filtering in the new schema
- **THEN** the renderer preserves those behaviors in the final antd table
- **AND** prompt authors do not need to hand-author the underlying antd config object shape

#### Scenario: Format, tooltip, and custom cell remain available
- **WHEN** a column enables formatting, tooltip display, or custom cell rendering
- **THEN** the runtime preserves those behaviors when converting the schema to the antd table configuration
- **AND** those behaviors are expressed through the new schema instead of the legacy anonymous object structure

### Requirement: Table migration SHALL be explicit for legacy JSON-style table definitions
The React UI DSL table capability SHALL define how legacy table definitions that still use the old `properties.columns[*]` object structure are handled.

#### Scenario: Legacy schema is handled predictably
- **WHEN** an existing table definition still uses the legacy JSON-style `properties.columns[*]` structure
- **THEN** the system either supports it through a documented compatibility path or returns a clear migration-oriented error
- **AND** the behavior is consistent with the migration strategy chosen for the implementation

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
