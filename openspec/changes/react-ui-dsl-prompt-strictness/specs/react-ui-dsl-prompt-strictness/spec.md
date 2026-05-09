## ADDED Requirements

### Requirement: React UI DSL prompt SHALL support strictness selection
React UI DSL prompt generation SHALL expose a `strictness` option with `standard` and `strict` values. When omitted, the system MUST use `standard`.

#### Scenario: Default strictness is standard
- **WHEN** a caller invokes `dslLibrary.prompt()` without a strictness option
- **THEN** the generated prompt MUST use the standard React UI DSL rules and examples

#### Scenario: Strict strictness is selected
- **WHEN** a caller invokes `dslLibrary.prompt({ strictness: "strict" })`
- **THEN** the generated prompt MUST include the standard React UI DSL rules and examples
- **AND** it MUST also include strict extra rules
- **AND** it MAY include strict extra examples when those examples are present

### Requirement: Standard prompt SHALL replace historical rule and example accumulation
The standard React UI DSL prompt SHALL be maintained as a curated default rules/examples set rather than an unstructured accumulation of historical benchmark patches.

#### Scenario: Standard prompt uses curated React UI DSL guidance
- **WHEN** the standard React UI DSL prompt is generated
- **THEN** it MUST include React UI DSL generation guidance covering reusable component-library patterns such as data fidelity, scoped renderers, formatting builtins, component choice, null fallback handling, object maps, charts, and MiniChart usage
- **AND** the guidance MUST be authored as reusable rules or examples rather than single-fixture patches

#### Scenario: Standard prompt preserves bench quality
- **WHEN** the standard prompt is evaluated against the deepseek/ds-flash benchmark baseline
- **THEN** the benchmark quality MUST NOT regress relative to the pre-restructure prompt baseline

### Requirement: Strict prompt SHALL extend standard without model-specific product rules
Strict React UI DSL prompt guidance SHALL express stronger instruction constraints without binding behavior to a model name or moving product semantics into model-specific rules.

#### Scenario: Strict prompt avoids model-named rules
- **WHEN** strict prompt guidance is generated
- **THEN** the prompt MUST NOT contain model-named product rules such as qwen3-specific Table, Descriptions, MiniChart, GaugeChart, or formatting behavior
- **AND** any strict extra rules MUST express reusable generation constraints that apply beyond a single model

#### Scenario: Strict examples are bench-driven
- **WHEN** strict extra examples are added
- **THEN** each example MUST correspond to a reusable failure pattern observed in benchmark results
- **AND** it MUST NOT exist only to patch one fixture id

### Requirement: Caller-provided prompt additions SHALL remain supported
React UI DSL prompt generation SHALL continue to append caller-provided `additionalRules` and `examples` after the selected standard or strict base content.

#### Scenario: Caller additional rules are appended
- **WHEN** a caller provides `additionalRules` with either standard or strict prompt generation
- **THEN** those rules MUST be included after the React UI DSL base rules selected by strictness

#### Scenario: Caller examples are appended
- **WHEN** a caller provides `examples` with either standard or strict prompt generation
- **THEN** those examples MUST be included after the React UI DSL base examples selected by strictness
