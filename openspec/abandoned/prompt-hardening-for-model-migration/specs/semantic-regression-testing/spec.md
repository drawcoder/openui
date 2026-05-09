## ADDED Requirements

### Requirement: Model migration reports SHALL include generation metadata
The React UI DSL semantic regression report SHALL include enough generation metadata to compare model migration runs and diagnose prompt-related regressions.

#### Scenario: Report records prompt and model metadata
- **WHEN** an e2e, benchmark, or fuzz report is generated from model output
- **THEN** each generated fixture entry MUST record the configured model name, prompt variant, prompt size, and selected example identifiers when available

#### Scenario: Report records qwen3 invocation metadata
- **WHEN** a fixture is generated with a model adapter that applies provider-specific options
- **THEN** the report MUST record which adapter was selected
- **AND** the report MUST record the normalized invocation options that affect reproducibility, excluding secrets

#### Scenario: Report records repair attempts
- **WHEN** generation performs a parse repair attempt
- **THEN** the report MUST record the original validation failure, whether repair was attempted, and the final validation result

#### Scenario: Legacy and hardened runs can be compared
- **WHEN** reports are generated for legacy and hardened prompt variants over the same fixture set
- **THEN** the report data MUST retain prompt variant metadata so downstream comparison tools can attribute score changes to the prompt variant
