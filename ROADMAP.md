# Roadmap

This roadmap records planned outcomes, not permission to implement them. The `owner` selects work and approves its `specification` before implementation starts. Detailed requirements, technical decisions, and `acceptance criteria` belong in that `specification`.

"Now" is the current priority. "Next" follows it. “Later” contains uncommitted ideas with no promised order or date.

Item identifiers remain stable when priorities change. The `owner` approves changes to priorities and scope.

## Overview

| ID | Title | Status | Summary |
|---|---|---|---|
| R-01 | [Improve status presentation and activation feedback](#r-01-improve-status-presentation-and-activation-feedback) | Completed | Show clearer status and configured agent details without adding model context. |
| R-02 | [Store escalations and owner decisions in builder handoffs](#r-02-store-escalations-and-owner-decisions-in-builder-handoffs) | Completed | Keep `escalation` questions and `owner` answers together in numbered `builder` `handoffs`. |
| R-03 | [Route builder failures through owner escalations](#r-03-route-builder-failures-through-owner-escalations) | Completed | Route reportable `builder` problems through `owner` `escalations` instead of a terminal failure phase. |
| R-12 | [Format glossary terms consistently](#r-12-format-glossary-terms-consistently) | Completed | Apply glossary formatting across documentation and record its exclusions. |
| R-14 | [Introduce Maestro at activation](#r-14-introduce-maestro-at-activation) | Completed | Introduce `Maestro` at activation and load relevant documentation only when needed. |
| R-15 | [Rename the test support directory](#r-15-rename-the-test-support-directory) | Completed | Rename `test/` to `tests/` and update affected references. |
| R-16 | [Verify code quality against AGENTS.md instructions](#r-16-verify-code-quality-against-agentsmd-instructions) | Completed | Require the `verifier` to review affected code against applicable `AGENTS.md` code-quality directives. |
| R-06 | [Check subagent extensions at activation](#r-06-check-subagent-extensions-at-activation) | Completed | Require a successful parent `pi-subagents` availability reply before activation. |
| R-05 | [Keep acceptance criterion numbering continuous](#r-05-keep-acceptance-criterion-numbering-continuous) | Completed | Reject gaps in `acceptance criterion` numbering before approving a `spec`. |
| R-10 | [Match handoff criteria to the approved spec](#r-10-match-handoff-criteria-to-the-approved-spec) | Completed | Require every approved `spec` criterion ID in each submitted `builder` and `verifier` `handoff`. |
| R-17 | [Record escalation resolutions when the spec changes](#r-17-record-escalation-resolutions-when-the-spec-changes) | Completed | Save all current `escalation` answers before changing phase, including when the `spec` requires revision. |
| R-20 | [Route finding-driven spec revisions through drafting-spec](#r-20-route-finding-driven-spec-revisions-through-drafting-spec) | Completed | Record `finding` decisions before `spec` revision and require renewed `GREEN FLAG` before another `builder` `run`. |
| R-18 | [Label acceptance criterion coverage](#r-18-label-acceptance-criterion-coverage) | Completed | Label each `acceptance criterion` as success, failure, or unchanged behavior. |
| R-19 | [Avoid acceptance criteria already covered by tests](#r-19-avoid-acceptance-criteria-already-covered-by-tests) | Completed | Omit `acceptance criteria` whose exact scenarios already have test coverage. |
| R-04 | [Rename the npm package](#r-04-rename-the-npm-package) | Later | Rename `@emiliosp/pi-maestro` to `pi-maestro-sdd` with compatibility decisions defined in the `spec`. |
| R-07 | [Guide initial configuration](#r-07-guide-initial-configuration) | Later | Help the `owner` create valid `Maestro` configuration through an interview. |
| R-08 | [Change agent models before a builder run](#r-08-change-agent-models-before-a-builder-run) | Later | Let the `owner` change `builder` and `verifier` models before subsequent `runs`. |
| R-09 | [Define workflow reconciliation](#r-09-define-workflow-reconciliation) | Later | Define how `Maestro` can reconcile saved `artifacts` and workflow state. |
| R-21 | [Add a simplifier with one clear purpose per agent](#r-21-add-a-simplifier-with-one-clear-purpose-per-agent) | Implemented | Run the `simplifier` after accepted verification, with a Git-only file scope and separate report. |

## Completed

### R-01: Improve status presentation and activation feedback

The status bar uses phase icons, theme colors, and shortened `spec` IDs. Successful activation shows the configured `builder` and `verifier` settings without adding the notice to session history or model context. All 12 `acceptance criteria` passed with no `verifier` `findings`. The saved workflow reached `candidate-ready`.

#### Evidence

[Specification](.specs/20261007-170438-update-maestro-status-bar-with-agent-models-theme-colors-and-phase-icons/spec.md), [verifier report](.specs/20261007-170438-update-maestro-status-bar-with-agent-models-theme-colors-and-phase-icons/handoffs/verifier/V1.json), and [merged PR #26](https://github.com/emilioSp/pi-maestro/pull/26).

### R-02: Store escalations and owner decisions in builder handoffs

Numbered `builder` `handoffs` contain multiple `escalation` questions and their `owner` resolutions. The `owner` resolves all current questions in one batch. Earlier `handoffs` remain available as history. All 10 `acceptance criteria` passed with no `verifier` `findings`. The saved workflow reached `candidate-ready`.

#### Evidence

[Specification](.specs/20261008-132344-store-escalations-in-builder-handoffs/spec.md), [verifier report](.specs/20261008-132344-store-escalations-in-builder-handoffs/handoffs/verifier/V1.json), and [merged PR #27](https://github.com/emilioSp/pi-maestro/pull/27).

### R-03: Route builder failures through owner escalations

Released in `0.9.0`. The `builder` reports only `done` or `escalation`. Reportable technical problems use the existing `owner` `escalation` process. Individual `probe` results retain `failed`. Execution errors and missing or invalid saved results still stop the workflow without automatic recovery.

All 8 `acceptance criteria` passed with no `verifier` `findings`. The saved workflow reached `candidate-ready`.

#### Evidence

[Specification](.specs/20261013-101454-route-builder-failures-through-owner-escalations/spec.md), [verifier report](.specs/20261013-101454-route-builder-failures-through-owner-escalations/handoffs/verifier/V1.json), and [merged PR #32](https://github.com/emilioSp/pi-maestro/pull/32).

### R-12: Format glossary terms consistently

Applied glossary formatting across the documentation and recorded its exclusions in `AGENTS.md` and the documentation audit skill. The approved change document uses the term `spec`. The `owner` confirmed completion.

#### Evidence

[Glossary](docs/glossary.md) and [workflow documentation](docs/workflow.md).

### R-14: Introduce Maestro at activation

Implemented in `0.9.1`. Successful activation introduces `Maestro` and invites the `owner` to ask how it works. The UI-only notice retains the configured agent details and does not add session history or start a model request.

Active instructions identify absolute paths to the installed README and documentation directory. `Maestro` reads relevant documentation on demand without automatically loading its contents.

All 6 `acceptance criteria` passed with no `verifier` `findings`. The saved workflow reached `candidate-ready`.

#### Evidence

[Specification](.specs/20261013-171954-introduce-maestro-at-activation/spec.md), [verifier report](.specs/20261013-171954-introduce-maestro-at-activation/handoffs/verifier/V1.json), and [merged PR #33](https://github.com/emilioSp/pi-maestro/pull/33).

### R-15: Rename the test support directory

Renamed `test/` to `tests/` at the owner's request. Updated imports, fixture paths, lint configuration, and project instructions. This follows the global instruction to keep fixtures under `tests/fixtures`. Source tests remain next to their source files. Historical `handoffs` retain their recorded paths.

#### Evidence

[Test support](tests/support/), [fixtures](tests/fixtures/), and [lint configuration](biome.json).

### R-16: Verify code quality against AGENTS.md instructions

Implemented in `0.9.2`. `Verifier` guidance now requires code-quality review only for code affected by the approved change when applicable `AGENTS.md` directives exist. All existing duties remain unchanged, including independent verification of every `acceptance criterion`.

Instruction-violation `findings` identify the instruction file, quote the rule, and explain the violating code through existing evidence fields. Missing files or code-quality directives cause only the added review to be skipped. Personal style preferences are not requirements.

All 5 `acceptance criteria` passed through independent inspection of the written guidance, with no `verifier` `findings`. No additional model trials were performed. The saved workflow reached `candidate-ready`.

#### Evidence

[Specification](.specs/20261013-185941-verify-code-quality-against-agents-md-instructions/spec.md), [verifier report](.specs/20261013-185941-verify-code-quality-against-agents-md-instructions/handoffs/verifier/V1.json), and [merged PR #34](https://github.com/emilioSp/pi-maestro/pull/34).

### R-06: Check subagent extensions at activation

Implemented in `0.9.3`. Activation requires a matching successful version 1 `ping` reply from the parent `pi-subagents` extension within 2000 ms. A failed or invalid reply, emission error, or timeout prevents activation and reports the installation requirement. The check starts no agent and makes no model request. It confirms parent extension availability, not child execution readiness.

All 7 `acceptance criteria` passed using controlled replies and code inspection, with no `verifier` `findings`. The saved workflow reached `candidate-ready`.

A later integration test requested by the `owner` directly checks the environment check's failed-reply error. This test addition is outside the completed independent verification.

#### Evidence

[Specification](.specs/20261013-194407-check-pi-subagents-availability-with-ping-at-activation/spec.md), [verifier report](.specs/20261013-194407-check-pi-subagents-availability-with-ping-at-activation/handoffs/verifier/V1.json), and [merged PR #35](https://github.com/emilioSp/pi-maestro/pull/35).

### R-05: Keep acceptance criterion numbering continuous

Implemented in `0.9.4`. `Spec` approval rejects numbered `acceptance criterion` headings that do not start at `AC1` and continue without gaps. Rejection leaves saved files unchanged.

`Maestro` corrects numbering and affected references without changing criterion order or requirements, then retries with the existing `GREEN FLAG`. No additional `owner` approval is required.

All 3 `acceptance criteria` passed with no `verifier` `findings`. The saved workflow reached `candidate-ready`.

#### Evidence

[Specification](.specs/20261013-202811-check-acceptance-criterion-numbering-before-builder-execution/spec.md), [verifier report](.specs/20261013-202811-check-acceptance-criterion-numbering-before-builder-execution/handoffs/verifier/V1.json), and [merged PR #36](https://github.com/emilioSp/pi-maestro/pull/36).

### R-10: Match handoff criteria to the approved spec

Implemented in `0.9.5` with the narrower scope approved by the `owner`. Both `handoff` submissions require every `acceptance criterion` ID from the approved `spec` before saving a report or changing phase. Extra report IDs remain allowed. Existing report validation is unchanged, and no new check rejects duplicate `spec` IDs.

Both `acceptance criteria` passed independent verification with no `findings`. The saved workflow reached `candidate-ready`.

Later changes requested by the `owner` extracted the shared check and replaced repeated integration scenarios with unit tests. One missing-ID integration test remains per role. These changes are outside the completed independent verification. The final `npm run check` passed all 227 tests and coverage thresholds.

#### Evidence

[Specification](.specs/20261013-211629-match-handoff-criteria-to-the-approved-spec/spec.md), [verifier report](.specs/20261013-211629-match-handoff-criteria-to-the-approved-spec/handoffs/verifier/V1.json), and [merged PR #37](https://github.com/emilioSp/pi-maestro/pull/37).

### R-17: Record escalation resolutions when the spec changes

#### Objective

Save every current `escalation` answer in the original `builder` `handoff`, whether the `spec` stays unchanged or requires revision.
Each `resolution` records the owner's chosen solution and reason. A decision requiring revision also identifies the `escalation` and describes the agreed `spec` change.

#### Agreed flow

`Maestro` records the complete decision batch through `maestro_resolve_escalations` before changing phase.

| Decision | Next phase and action |
|---|---|
| No `spec` change | `escalation-decisions` → `ready-for-builder`. The `builder` continues under the approved `spec`, without renewed approval. |
| `Spec` change required | `escalation-decisions` → `drafting-spec`. The `owner` and `Maestro` revise and review the same `spec`. |
| Revised `spec` receives renewed `GREEN FLAG` | `drafting-spec` → `ready-for-builder` through separate `maestro_mark_spec_ready` approval. |

Direct `spec` approval from `escalation-decisions` is rejected. Recording answers does not move to `ready-for-verifier`; that phase requires a completed `builder` `pass`.

#### Implementation boundaries

Reuse the existing resolution operation and `handoff` fields. Do not add a parallel decision store, tool, or workflow phase.
Define both resolution transitions explicitly in `src/workflow/transitions.ts` and apply them through `transitionWorkflow`. Direct phase assignment elsewhere is banned.
Preserve initial `spec` approval, `verifier` `finding` decisions, existing batch validation, and historical `handoffs`.

#### Completed when

Saved `resolutions`, workflow phases, tool results, agent instructions, and human documentation follow the agreed flow.
Verification checks both observable behavior and use of the central transition definitions for each resolution branch. Passing behavior tests alone is not enough.
The new `spec` includes coverage labels and omits `acceptance criteria` already covered by tests of the same scenario.

### R-20: Route finding-driven spec revisions through drafting-spec

Implemented the approved revision route. `Maestro` records every current `finding` decision before returning to `drafting-spec` when revision is required.
The `owner` reviews the same revised `spec` and gives renewed `GREEN FLAG` before separate approval and another `builder` `run`.
Revision takes priority in mixed batches. Direct approval from `finding-decisions` is rejected.

Later event naming cleanup identifies `builder` and `owner` actions explicitly. Both revision routes use `OWNER_REQUEST_SPEC_REVISION` without changing the phase flow. Batch resolution uses `RESOLVE_ESCALATIONS`, and the status label refers to `escalations` in the plural. The saved decision phases are named `escalation-decisions` and `finding-decisions`.

#### Evidence

[Specification](.specs/20261015-154812-route-finding-driven-spec-revisions-through-drafting-spec/spec.md) and [resolution integration tests](src/tools/main/resolve-findings.integration.test.ts).

### R-18: Label acceptance criterion coverage

Implemented with R-19 as one task, as selected by the `owner`.
The `spec` template and `Maestro` guidance require one `Coverage` label per `acceptance criterion`:

| Label | Purpose |
|---|---|
| `success` | A valid action produces the required result. |
| `failure` | An invalid action is correctly rejected. |
| `unchanged` | The change preserves existing behavior. |

Use `unchanged` when the criterion explicitly checks behavior that the change must preserve.
Labels describe scenarios, not test outcomes. A `failure` scenario passes when the invalid action is correctly rejected.
A `spec` does not need all three categories.
`Maestro` includes labels when presenting criteria to the `owner` and checks them against scenarios and `expected results` during review.
Approval validation and `handoff` formats remain unchanged.

The existing creation integration test now checks that the generated `spec` includes the coverage field.
The final `npm run check` passed all 238 tests and coverage thresholds. No model trials were performed.

#### Evidence

[Spec template](templates/spec.md), [Maestro guidance](src/maestro/instructions/getMaestroInstructions.ts), [creation integration test](src/specs/create.integration.test.ts), and [workflow documentation](docs/workflow.md#acceptance-criteria).

### R-19: Avoid acceptance criteria already covered by tests

Implemented with R-18. `Maestro` inspects existing tests before writing `acceptance criteria`.
It omits a criterion only when a test covers the same starting conditions, action, and `expected result`.
Partial or uncertain coverage does not justify omission. Similar tests do not count.

During `spec` review, `Maestro` removes criteria whose exact scenarios already have test coverage.
It keeps numbering continuous from `AC1` and updates affected references. Required behavior remains documented in the requirements and constraints.
The same rules apply during `spec` revisions. No automatic approval check was added.

Verification consisted of inspecting the written guidance and running `npm run check`. No model trials were performed.

#### Evidence

[Maestro guidance](src/maestro/instructions/getMaestroInstructions.ts), [spec template](templates/spec.md), and [workflow documentation](docs/workflow.md#acceptance-criteria).

## Now

### R-21: Add a simplifier with one clear purpose per agent

Implemented under the [specification](.specs/20261016-090319-add-a-dedicated-simplifier-after-verification/spec.md). Independent review is pending.
The `builder` implements the approved `spec`. The `verifier` checks its `acceptance criteria`. The `simplifier` refactors accepted code for clarity.
The extra code-quality review introduced in R-16 is removed from the verifier's instructions.

Successful verification and rejection of all current `findings` save `simplifier-running`.
`Maestro` calls `maestro_run_simplifier` without another approval or verification cycle.
Only that tool checks Git readiness. If Git is unavailable, it warns and saves `candidate-ready` without delegation or a `simplifier` `handoff`.

The `simplifier` selects all uncommitted code changes, including pre-existing staged, unstaged, and untracked files.
It preserves observable behavior and the accepted check baseline. Rejected `findings` remain rejected, not passed.
Required caller updates can include initially unchanged files. Unrelated refactoring, index changes, and automatic commits are excluded.

A completed `pass` saves the fixed, unnumbered `handoffs/simplifier/S.json`, then saves `candidate-ready`.
The report contains refactored files, a summary, and notes. No refactoring is required when selected code is already clear.
Maestro's final summary separates this report from independent `verifier` evidence.

## Next

## Later

These items need scope review before `specification` approval. Existing behavior must be checked before adding new code. Dependencies between these items are not yet agreed.

### R-04: Rename the npm package

#### Objective

Rename `@emiliosp/pi-maestro` to `pi-maestro-sdd`. The `owner` installs the package under the new name. This item changes the package identity, not the development workflow.

Compatibility with installations under the old name must be decided in the `specification`. No `specification` is approved yet.

#### Completed when

Package metadata and installation documentation use the new name. The package is available under that name.

### R-07: Guide initial configuration

#### Objective

Help the `owner` create `Maestro` configuration through an interview. `Maestro` asks questions and writes the agreed configuration.

#### Completed when

The `owner` can create a valid project configuration without writing the file manually.

### R-08: Change agent models before a builder run

#### Objective

Let the `owner` change the `builder` and `verifier` models during `spec` preparation and the `ready-for-builder` phase. The selected models apply to subsequent `runs`.

#### Completed when

The `owner` can select available models in those phases. `Maestro` uses the selections.

### R-09: Define workflow reconciliation

#### Objective

Explore how `Maestro` can reconcile saved `artifacts` and workflow state. The recovery scope is not yet defined.

#### Completed when

Not yet defined. The `owner` must define the intended outcome, recovery boundaries, and completion condition before this item can move forward.
