## ADDED Requirements

### Requirement: Semantic regression runs SHALL record prompt strictness
The React UI DSL semantic regression workflow SHALL record the prompt strictness used for a run so benchmark comparisons can distinguish standard and strict prompt results.

#### Scenario: Eval start accepts strictness
- **WHEN** a user starts an eval run with `--strictness standard` or `--strictness strict`
- **THEN** the eval workflow MUST use that strictness value for React UI DSL prompt generation during the run

#### Scenario: Missing strictness defaults to standard
- **WHEN** a user starts an eval run without a strictness argument
- **THEN** the eval workflow MUST use `standard` strictness

#### Scenario: Invalid strictness is rejected
- **WHEN** a user starts an eval run with an unsupported strictness value
- **THEN** the eval workflow MUST fail fast before running fixtures

#### Scenario: Report records run strictness
- **WHEN** a semantic regression report is produced for a React UI DSL eval run
- **THEN** the report MUST record the selected strictness as run-level metadata
- **AND** downstream comparisons MUST be able to attribute score differences to the strictness used for each run
