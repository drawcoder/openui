---
name: genui-capability-issue-execution
description: Use when implementing, validating, or closing out an existing GenUI Linear capability issue.
---

# GenUI Capability Issue Execution

Use this skill when implementing an existing GenUI capability issue. The goal is not to make the listed fixtures pass by any means; the goal is to strengthen a reusable data-shape, prompt, helper, or component capability and report evidence that the change is not fixture-specific.

This skill is the single owner for the execution lifecycle of an existing GenUI capability issue.

It must cover:

- issue reading
- implementation
- validation
- workpad updates
- validation evidence closeout
- screenshot upload through `linear-evidence-upload` when local screenshot evidence exists

Do not rely on a separate Linear workflow skill to finish the issue. This skill owns the closeout.

## Workflow

1. Read the Linear issue and identify the capability goal, problem class, primary evidence fixtures, required fix shape, and Generalization Gate.
2. Resolve the issue state, project context, and the single active `## Codex Workpad` comment.
3. Before editing, write a Generalization Plan in the workpad:
   - shared data/field/component shape
   - non-goals and boundaries
   - chosen fix layer: prompt rule, prompt example, runtime helper, component fallback, schema guidance, or mixed
   - primary evidence fixtures to inspect
4. Inspect the issue-provided `dataModel`, generated DSL, screenshots, and local source.
5. Implement the smallest reusable fix that addresses the capability class.
6. Run the normal validation for the touched area.
7. **Mandatory eval verification** for any prompt-layer, component, runtime, or schema change that could plausibly affect a fixture's rendered DSL. Run via the `react-ui-dsl-genui-eval-loop` skill — do NOT hand-roll a Playwright/render harness; `pnpm eval start` already regen + render + screenshots in one pipeline.
   - Pick the suite that owns the fixture (e2e / fuzz / benchmark). The fixture lives under `*-snapshots/<id>.dsl`; the suite name matches the directory prefix. Wrong `--suite` makes vitest skip everything.
   - Canonical command: `pnpm eval start --suite <suite> --regen --fixture <id>`.
   - Wait for the run to exit cleanly (process exit 0; ignore the noisy antd `use client` bundler warnings — they are not failures). Confirm BOTH `runs/<run-id>/report-data.json` AND `runs/<run-id>/task-bundle/screenshots/<id>.png` exist before treating the run as complete. Do not peek at the screenshots dir mid-run; it is created early but populated last.
   - Skipping this step is only acceptable if the change is provably unable to influence DSL output (e.g., a docs-only edit) — and that reason must be written into the workpad.
8. **Mandatory screenshot upload**: every primary evidence fixture mentioned in the issue must have the screenshot at `runs/<run-id>/task-bundle/screenshots/<fixture>.png` uploaded via the `linear-evidence-upload` skill and embedded as a Markdown image in the workpad's Validation / Eval Evidence section. If multiple fixtures are listed, upload one screenshot per fixture. The before/after pair (issue's hosted screenshot vs. the newly uploaded one) must both be visible in the workpad.
9. Update Linear with Generalization Evidence using [references/completion-template.md](references/completion-template.md).

## Workpad Shape

Use exactly one active comment starting with:

```markdown
## Codex Workpad
```

Keep these sections current:

- `Plan`
- `Acceptance Criteria`
- `Validation`
- `Notes`

## State Rules

- `Backlog`: do not modify unless explicitly instructed
- `Todo`: move to `In Progress` before active implementation
- `In Progress`: keep the workpad current
- `Human Review`: do not make implementation changes until review context is read
- terminal states: do nothing unless explicitly instructed

Default Symphony Linear project slug: `genui-3513f1483173`.

Required environment:

- `LINEAR_API_KEY`
- `SYMPHONY_WORKSPACE_ROOT`

For screenshot upload, `LINEAR_API_KEY` must be present in the current shell environment. In normal setups this key is usually exported as a global zsh environment variable and inherited by the shell that launches Codex. If the key is missing, stop and record that screenshot upload could not proceed because the key was unavailable.

## Completion Contract

You may finish only in one of these states:

- `Completed`
- `Blocked`
- `Needs Human Decision`

`Completed` requires:

- validation commands recorded
- current `## Codex Workpad`
- **eval regen executed for the primary evidence fixture(s)** — run id, fixture id(s), and outcome recorded in the workpad
- **fresh validation screenshot(s) uploaded via `linear-evidence-upload` and embedded as Markdown images** in the workpad — one per primary evidence fixture, paired with the issue's original (broken) screenshot for visible before/after comparison; or, if regen is provably non-applicable, that reasoning is recorded
- upload failure explicitly recorded (local path, retry result, failure summary) when an upload could not complete
- PR linked when applicable
- state advanced only after the completion bar is satisfied

A "validation passed via unit tests only" closeout is NOT acceptable for prompt/component/runtime/schema changes. Unit tests verify the source did not break; only the regenerated DSL + screenshot demonstrates the issue's visible defect is fixed.

If upload fails, record:

- local path
- retry result
- failure summary

Do not leave the workpad looking screenshot-complete when upload failed.

## Hard Rules

- Do not edit eval snapshots to make the issue look fixed.
- Do not hardcode fixture ids in source.
- Do not hardcode sample values from the issue evidence.
- Do not add branches that only match listed fixtures or their business-specific names.
- Do not claim generalization from score improvement alone.
- Do not move the issue to review until Generalization Evidence is complete.
- Do not close out a prompt/component/runtime/schema fix without rerunning the eval and uploading the regenerated screenshot. "Tests pass" is not validation that the visible defect is gone.

## Fix Layer Selection

| Symptom | Prefer |
|---|---|
| LLM chooses wrong component family for a data shape | prompt rule or prompt example |
| LLM knows the component but uses the API incorrectly | prompt example or schema guidance |
| Correct DSL renders poorly for many inputs | component fallback or runtime helper |
| Parser/runtime cannot express the needed shape | runtime or language capability |
| Issue evidence shows fabricated labels/values | prompt anti-fabrication rule and examples |

If the issue says "prompt fix" but evidence shows a component/runtime defect, follow the evidence and explain the layer change in the workpad.

## Anti-Overfit Review

Before closeout, check the source diff for these red flags:

- fixture ids
- evidence fixture business names used as condition keys
- literal sample values from `dataModel`
- snapshot edits
- only one affected fixture changed while the stated rule is broader
- completion summary that says "fixed fixture X" but does not name a reusable rule

If any red flag is present, either remove it or explicitly justify why it is not overfitting.

## Output

The final Linear update must include:

- reusable rule changed
- changed layer
- why the change generalizes beyond the listed fixtures
- anti-overfit checklist
- validation commands and outcomes
- residual risks or follow-up issue suggestions

Use [references/completion-template.md](references/completion-template.md) for the exact shape.
