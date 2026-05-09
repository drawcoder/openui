## ADDED Requirements

### Requirement: Hardened Prompt Variant
The system SHALL provide a hardened prompt variant for React UI DSL generation that improves model portability without adding model-specific product or syntax rules.

#### Scenario: Hardened variant is selected
- **WHEN** a caller requests the hardened prompt variant for a React UI DSL prompt
- **THEN** the generated prompt MUST include the shared language contract, component contract, generation contract, rendering policy, and selected examples
- **AND** the generated prompt MUST NOT require qwen3-specific product rules to explain React UI DSL component semantics

#### Scenario: Legacy variant remains available
- **WHEN** a caller requests the legacy prompt variant
- **THEN** the system MUST preserve the pre-hardening prompt behavior needed for baseline comparison

### Requirement: Universal Generation Contract Placement
The hardened prompt SHALL place a compact set of universal generation constraints in high-attention positions near the beginning and end of the prompt.

#### Scenario: Critical constraints are placed near prompt boundaries
- **WHEN** the hardened prompt is rendered
- **THEN** universal constraints for parseable output, data fidelity, variable reachability, scope correctness, and component arity MUST appear near the beginning of the prompt
- **AND** a concise final verification checklist covering those constraints MUST appear near the end of the prompt

#### Scenario: Model-specific rule bundle is not required
- **WHEN** the qwen3 model adapter is used with the hardened prompt
- **THEN** the prompt MUST still obtain syntax and product behavior from the shared contracts and component-library rendering policy
- **AND** qwen3-specific configuration MUST be limited to invocation options and prompt budget preferences

### Requirement: Positive Example Guidance
The hardened prompt SHALL prefer positive, executable examples over standalone negative prohibitions for high-risk generation failures.

#### Scenario: JavaScript API hallucination is corrected by example
- **WHEN** the prompt includes guidance against JavaScript conversion APIs
- **THEN** the prompt MUST also include a positive openui-lang alternative such as string concatenation or a supported formatting builtin

#### Scenario: Scoped render guidance is corrected by example
- **WHEN** the prompt includes guidance about table renderers that need row fields
- **THEN** the prompt MUST demonstrate the correct `@Render("v", "row", ...)` binder form

### Requirement: Data-Shape Example Selection
The hardened prompt SHALL select a compact set of examples based on the supplied data model shape.

#### Scenario: Data model selects relevant examples
- **WHEN** a prompt is generated with host data
- **THEN** the system MUST classify the data shape into deterministic tags
- **AND** the prompt MUST include a compact set of tagged examples relevant to those tags

#### Scenario: Selection preserves diversity
- **WHEN** multiple examples match the same dominant data-shape tag
- **THEN** the selector MUST prefer a diverse set over examples that all demonstrate the same pattern

#### Scenario: No data model falls back safely
- **WHEN** a prompt is generated without host data
- **THEN** the system MUST use a compact general example set instead of including every available example

### Requirement: Thin Model Invocation Adapter
The system SHALL support model-specific invocation options for qwen3 without moving product rendering rules into the model adapter.

#### Scenario: qwen3 options are applied in eval generation
- **WHEN** eval or snapshot regeneration uses `qwen3-30b-a3b-instruct-2507`
- **THEN** the model call MUST apply the configured qwen3 sampling and provider options required for the migration run
- **AND** the report metadata MUST record that those options were selected

#### Scenario: Product rules remain component-library owned
- **WHEN** the qwen3 adapter is configured
- **THEN** it MUST NOT define rules for component choices such as Table, Descriptions, MiniChart, GaugeChart, or null-dominant rendering

### Requirement: One-Shot Parse Repair
The generation flow SHALL optionally repair model output once when parser validation fails.

#### Scenario: Parse failure triggers one repair attempt
- **WHEN** generated DSL fails parser validation and repair is enabled
- **THEN** the system MUST call the model at most one additional time with the previous output and structured parser error information
- **AND** the repair prompt MUST ask for the full corrected OpenUI Lang program without explanations

#### Scenario: Parse success does not trigger repair
- **WHEN** generated DSL passes parser validation
- **THEN** the system MUST accept the output without a repair call

#### Scenario: Repair failure remains visible
- **WHEN** the repair attempt also fails parser validation
- **THEN** the fixture or generation result MUST remain failed
- **AND** the report metadata MUST include both validation failures
