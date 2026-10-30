# Roadmap

This file is the source of truth for planned outcomes and recorded completion. Roadmap entries are not permission to implement them. The `owner` selects work and approves
its `specification` before implementation starts. Detailed requirements, technical decisions, and `acceptance criteria` belong in that `specification`.

Backlog items have no agreed order or date. The `owner` approves priority and scope changes.

Completed entries preserve recorded outcomes and evidence, which may describe behavior later changed. Completion requires `owner` acceptance, not only passing checks or
reaching `candidate-ready`. Linear onboarding and test issues are not project roadmap items and are omitted.

## Overview

| ID         | Item                                                                                                                               | Status                                |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| MAESTRO-6  | [Display specs in a browser](#maestro-6-display-specs-in-a-browser)                                                                | Backlog                               |
| MAESTRO-7  | [Route builder failures through owner escalations](#maestro-7-route-builder-failures-through-owner-escalations)                    | Completed                             |
| MAESTRO-8  | [Store escalations and owner decisions in builder handoffs](#maestro-8-store-escalations-and-owner-decisions-in-builder-handoffs)  | Completed                             |
| MAESTRO-9  | [Format glossary terms consistently](#maestro-9-format-glossary-terms-consistently)                                                | Completed                             |
| MAESTRO-10 | [Improve status presentation and activation feedback](#maestro-10-improve-status-presentation-and-activation-feedback)             | Completed                             |
| MAESTRO-11 | [Introduce Maestro at activation](#maestro-11-introduce-maestro-at-activation)                                                     | Completed                             |
| MAESTRO-12 | [Verify code quality against AGENTS.md instructions](#maestro-12-verify-code-quality-against-agentsmd-instructions)                | Completed                             |
| MAESTRO-13 | [Check subagent extensions at activation](#maestro-13-check-subagent-extensions-at-activation)                                     | Completed                             |
| MAESTRO-14 | [Rename the test support directory](#maestro-14-rename-the-test-support-directory)                                                 | Completed                             |
| MAESTRO-15 | [Match handoff criteria to the approved spec](#maestro-15-match-handoff-criteria-to-the-approved-spec)                             | Completed                             |
| MAESTRO-16 | [Route finding-driven spec revisions through drafting-spec](#maestro-16-route-finding-driven-spec-revisions-through-drafting-spec) | Completed                             |
| MAESTRO-17 | [Keep acceptance criterion numbering continuous](#maestro-17-keep-acceptance-criterion-numbering-continuous)                       | Completed                             |
| MAESTRO-18 | [Record escalation resolutions when the spec changes](#maestro-18-record-escalation-resolutions-when-the-spec-changes)             | Completed                             |
| MAESTRO-19 | [Guide initial configuration](#maestro-19-guide-initial-configuration)                                                             | Backlog                               |
| MAESTRO-20 | [Rename the npm package](#maestro-20-rename-the-npm-package)                                                                       | Backlog                               |
| MAESTRO-21 | [Label acceptance criterion coverage](#maestro-21-label-acceptance-criterion-coverage)                                             | Completed                             |
| MAESTRO-22 | [Avoid acceptance criteria already covered by tests](#maestro-22-avoid-acceptance-criteria-already-covered-by-tests)               | Completed                             |
| MAESTRO-23 | [Change agent models before a builder run](#maestro-23-change-agent-models-before-a-builder-run)                                   | Backlog                               |
| MAESTRO-24 | [Add a simplifier with one clear purpose per agent](#maestro-24-add-a-simplifier-with-one-clear-purpose-per-agent)                 | Completed                             |
| MAESTRO-25 | [Define workflow reconciliation](#maestro-25-define-workflow-reconciliation)                                                       | Backlog                               |
| MAESTRO-26 | [Exit Maestro mode automatically at workflow completion](#maestro-26-exit-maestro-mode-automatically-at-workflow-completion)       | Implemented, acceptance not confirmed |
| MAESTRO-27 | [Make verifier and simplifier phases optional](#maestro-27-make-verifier-and-simplifier-phases-optional)                           | Backlog                               |

## Backlog

### MAESTRO-6: Display specs in a browser

#### Objective

Display the `spec` documents in a browser to improve readability and help the `owner` understand the proposed change, requirements, and `acceptance criteria`.

#### Completed when

The `owner` can read the `spec` documents in a browser with formatting designed for human comprehension.

### MAESTRO-19: Guide initial configuration

#### Objective

Help the `owner` create `Maestro` configuration through an interview. `Maestro` asks questions and writes the agreed configuration.

#### Completed when

The `owner` can create a valid project configuration without writing the file manually.

### MAESTRO-20: Rename the npm package

#### Objective

Rename `@emiliosp/pi-maestro` to `pi-maestro-sdd`. The `owner` installs the package under the new name. This item changes the package identity, not the development
workflow.

Compatibility with installations under the old name must be decided in the `specification`. No `specification` is approved yet.

#### Completed when

Package metadata and installation documentation use the new name. The package is available under that name.

### MAESTRO-23: Change agent models before a builder run

#### Objective

Let the `owner` change the `builder` and `verifier` models during `spec` preparation and the `ready-for-builder` phase. The selected models apply to subsequent `runs`.

#### Completed when

The `owner` can select available models in those phases. `Maestro` uses the selections.

### MAESTRO-25: Define workflow reconciliation

#### Objective

Explore how `Maestro` can reconcile saved `artifacts` and workflow state. The recovery scope is not yet defined.

#### Completed when

Not yet defined. The `owner` must define the intended outcome, recovery boundaries, and completion condition before this item can move forward.

### MAESTRO-27: Make verifier and simplifier phases optional

#### Objective

Make the `builder` the only required agent phase. Let the `owner` independently enable or disable the `verifier` and `simplifier` phases.

This request concerns agent execution phases, not removal of `spec` preparation or approval.

#### Completed when

1. The `builder` remains mandatory.
2. The `owner` can select any of these combinations: `builder` only; `builder` and `verifier`; `builder` and `simplifier`; or all three.
3. Disabled phases are not delegated and do not block workflow completion.
4. The workflow reaches `candidate-ready` after the selected phases complete and any required `owner` decisions are resolved.
5. The final summary clearly identifies skipped phases and does not describe skipped verification as passed.

#### Decisions to define in the spec

1. Where and when phase selection is configured.
2. Default selections.
3. Whether selections can change after a workflow starts.

#### Context

[MAESTRO-24](#maestro-24-add-a-simplifier-with-one-clear-purpose-per-agent) introduced the `simplifier`. Its existing Git-unavailable skip is not an explicit `owner`
choice. This issue adds independent optionality for both post-`builder` agent phases.

## Implemented, acceptance not confirmed

### MAESTRO-26: Exit Maestro mode automatically at workflow completion

Implemented in `0.13.0`. `Maestro` automatically turns off after successfully delivering the final summary of a completed workflow, including when Git is unavailable and
simplification is skipped. Live tools, status, instructions, and active `spec` selection are cleared; saved workflow files and other extensions remain unchanged.
Intermediate phases and interrupted workflows do not trigger automatic exit.

Linear marks this item Done, but its description still says final `owner` acceptance is pending. Acceptance is not inferred from that status or the release.

#### Evidence

[Changelog](CHANGELOG.md#0130), [merged PR #43](https://github.com/emilioSp/pi-maestro/pull/43),
[specification](.specs/20261030-145712-automatically-exit-maestro-mode-at-workflow-completion/spec.md), and
[original issue](https://linear.app/emilio-spatola/issue/MAESTRO-26/feat-exit-maestro-mode-automatically-at-workflow-completion).

## Completed

These entries were recorded as Done in Linear. Their historical verification evidence does not independently establish final `owner` acceptance.

### MAESTRO-7: Route builder failures through owner escalations

Route reportable `builder` problems through `owner` `escalations` instead of a terminal failure phase.

Released in `0.9.0`. The `builder` reports only `done` or `escalation`. Reportable technical problems use the existing `owner` `escalation` process. Individual `probe`
results retain `failed`. Execution errors and missing or invalid saved results still stop the workflow without automatic recovery.

All 8 `acceptance criteria` passed with no `verifier` `findings`. The saved workflow reached `candidate-ready`.

#### Evidence

[Specification](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/.specs/20261013-101454-route-builder-failures-through-owner-escalations/spec.md),
[verifier report](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/.specs/20261013-101454-route-builder-failures-through-owner-escalations/handoffs/verifier/V1.json),
and [merged PR #32](https://github.com/emilioSp/pi-maestro/pull/32).

### MAESTRO-8: Store escalations and owner decisions in builder handoffs

Keep `escalation` questions and `owner` answers together in numbered `builder` `handoffs`.

Numbered `builder` `handoffs` contain multiple `escalation` questions and their `owner` resolutions. The `owner` resolves all current questions in one batch. Earlier
`handoffs` remain available as history. All 10 `acceptance criteria` passed with no `verifier` `findings`. The saved workflow reached `candidate-ready`.

#### Evidence

[Specification](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/.specs/20261008-132344-store-escalations-in-builder-handoffs/spec.md),
[verifier report](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/.specs/20261008-132344-store-escalations-in-builder-handoffs/handoffs/verifier/V1.json),
and [merged PR #27](https://github.com/emilioSp/pi-maestro/pull/27).

### MAESTRO-9: Format glossary terms consistently

Apply glossary formatting across documentation and record its exclusions.

Applied glossary formatting across the documentation and recorded its exclusions in `AGENTS.md` and the documentation audit skill. The approved change document uses the
term `spec`. The `owner` confirmed completion.

#### Evidence

[Glossary](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/docs/glossary.md) and
[workflow documentation](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/docs/workflow.md).

### MAESTRO-10: Improve status presentation and activation feedback

Show clearer status and configured agent details without adding model context.

The status bar uses phase icons, theme colors, and shortened `spec` IDs. Successful activation shows the configured `builder` and `verifier` settings without adding the
notice to session history or model context. All 12 `acceptance criteria` passed with no `verifier` `findings`. The saved workflow reached `candidate-ready`.

#### Evidence

[Specification](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/.specs/20261007-170438-update-maestro-status-bar-with-agent-models-theme-colors-and-phase-icons/spec.md),
[verifier report](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/.specs/20261007-170438-update-maestro-status-bar-with-agent-models-theme-colors-and-phase-icons/handoffs/verifier/V1.json),
and [merged PR #26](https://github.com/emilioSp/pi-maestro/pull/26).

### MAESTRO-11: Introduce Maestro at activation

Introduce `Maestro` at activation and load relevant documentation only when needed.

Implemented in `0.9.1`. Successful activation introduces `Maestro` and invites the `owner` to ask how it works. The UI-only notice retains the configured agent details
and does not add session history or start a model request.

Active instructions identify absolute paths to the installed README and documentation directory. `Maestro` reads relevant documentation on demand without automatically
loading its contents.

All 6 `acceptance criteria` passed with no `verifier` `findings`. The saved workflow reached `candidate-ready`.

#### Evidence

[Specification](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/.specs/20261013-171954-introduce-maestro-at-activation/spec.md),
[verifier report](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/.specs/20261013-171954-introduce-maestro-at-activation/handoffs/verifier/V1.json),
and [merged PR #33](https://github.com/emilioSp/pi-maestro/pull/33).

### MAESTRO-12: Verify code quality against AGENTS.md instructions

Historical outcome: the extra review described below was removed by [MAESTRO-24](#maestro-24-add-a-simplifier-with-one-clear-purpose-per-agent) in `0.11.0`.

Require the `verifier` to review affected code against applicable `AGENTS.md` code-quality directives.

Implemented in `0.9.2`. `Verifier` guidance now requires code-quality review only for code affected by the approved change when applicable `AGENTS.md` directives exist.
All existing duties remain unchanged, including independent verification of every `acceptance criterion`.

Instruction-violation `findings` identify the instruction file, quote the rule, and explain the violating code through existing evidence fields. Missing files or
code-quality directives cause only the added review to be skipped. Personal style preferences are not requirements.

All 5 `acceptance criteria` passed through independent inspection of the written guidance, with no `verifier` `findings`. No additional model trials were performed. The
saved workflow reached `candidate-ready`.

#### Evidence

[Specification](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/.specs/20261013-185941-verify-code-quality-against-agents-md-instructions/spec.md),
[verifier report](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/.specs/20261013-185941-verify-code-quality-against-agents-md-instructions/handoffs/verifier/V1.json),
and [merged PR #34](https://github.com/emilioSp/pi-maestro/pull/34).

### MAESTRO-13: Check subagent extensions at activation

Require a successful parent `pi-subagents` availability reply before activation.

Implemented in `0.9.3`. Activation requires a matching successful version 1 `ping` reply from the parent `pi-subagents` extension within 2000 ms. A failed or invalid
reply, emission error, or timeout prevents activation and reports the installation requirement. The check starts no agent and makes no model request. It confirms parent
extension availability, not child execution readiness.

All 7 `acceptance criteria` passed using controlled replies and code inspection, with no `verifier` `findings`. The saved workflow reached `candidate-ready`.

A later integration test requested by the `owner` directly checks the environment check's failed-reply error. This test addition is outside the completed independent
verification.

#### Evidence

[Specification](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/.specs/20261013-194407-check-pi-subagents-availability-with-ping-at-activation/spec.md),
[verifier report](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/.specs/20261013-194407-check-pi-subagents-availability-with-ping-at-activation/handoffs/verifier/V1.json),
and [merged PR #35](https://github.com/emilioSp/pi-maestro/pull/35).

### MAESTRO-14: Rename the test support directory

Rename `test/` to `tests/` and update affected references.

Renamed `test/` to `tests/` at the owner's request. Updated imports, fixture paths, lint configuration, and project instructions. This follows the global instruction to
keep fixtures under `tests/fixtures`. Source tests remain next to their source files. Historical `handoffs` retain their recorded paths.

#### Evidence

[Test support](https://github.com/emilioSp/pi-maestro/tree/839ab9eb9753df22804d750657a616a9959c2c47/tests/support/),
[fixtures](https://github.com/emilioSp/pi-maestro/tree/839ab9eb9753df22804d750657a616a9959c2c47/tests/fixtures/), and
[lint configuration](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/.oxlintrc.json).

### MAESTRO-15: Match handoff criteria to the approved spec

Require every approved `spec` criterion ID in each submitted `builder` and `verifier` `handoff`.

Implemented in `0.9.5` with the narrower scope approved by the `owner`. Both `handoff` submissions require every `acceptance criterion` ID from the approved `spec` before
saving a report or changing phase. Extra report IDs remain allowed. Existing report validation is unchanged, and no new check rejects duplicate `spec` IDs.

Both `acceptance criteria` passed independent verification with no `findings`. The saved workflow reached `candidate-ready`.

Later changes requested by the `owner` extracted the shared check and replaced repeated integration scenarios with unit tests. One missing-ID integration test remains per
role. These changes are outside the completed independent verification. The final `npm run check` passed all 227 tests and coverage thresholds.

#### Evidence

[Specification](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/.specs/20261013-211629-match-handoff-criteria-to-the-approved-spec/spec.md),
[verifier report](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/.specs/20261013-211629-match-handoff-criteria-to-the-approved-spec/handoffs/verifier/V1.json),
and [merged PR #37](https://github.com/emilioSp/pi-maestro/pull/37).

### MAESTRO-16: Route finding-driven spec revisions through drafting-spec

Record `finding` decisions before `spec` revision and require renewed `GREEN FLAG` before another `builder` `run`.

Implemented the approved revision route. `Maestro` records every current `finding` decision before returning to `drafting-spec` when revision is required. The `owner`
reviews the same revised `spec` and gives renewed `GREEN FLAG` before separate approval and another `builder` `run`. Revision takes priority in mixed batches. Direct
approval from `finding-decisions` is rejected.

Later event naming cleanup identifies `builder` and `owner` actions explicitly. Both revision routes use `OWNER_REQUEST_SPEC_REVISION` without changing the phase flow.
Batch resolution uses `RESOLVE_ESCALATIONS`, and the status label refers to `escalations` in the plural. The saved decision phases are named `escalation-decisions` and
`finding-decisions`.

#### Evidence

[Specification](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/.specs/20261015-154812-route-finding-driven-spec-revisions-through-drafting-spec/spec.md)
and
[resolution integration tests](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/src/tools/main/resolve-findings.integration.test.ts).

### MAESTRO-17: Keep acceptance criterion numbering continuous

Reject gaps in `acceptance criterion` numbering before approving a `spec`.

Implemented in `0.9.4`. `Spec` approval rejects numbered `acceptance criterion` headings that do not start at `AC1` and continue without gaps. Rejection leaves saved
files unchanged.

`Maestro` corrects numbering and affected references without changing criterion order or requirements, then retries with the existing `GREEN FLAG`. No additional `owner`
approval is required.

All 3 `acceptance criteria` passed with no `verifier` `findings`. The saved workflow reached `candidate-ready`.

#### Evidence

[Specification](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/.specs/20261013-202811-check-acceptance-criterion-numbering-before-builder-execution/spec.md),
[verifier report](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/.specs/20261013-202811-check-acceptance-criterion-numbering-before-builder-execution/handoffs/verifier/V1.json),
and [merged PR #36](https://github.com/emilioSp/pi-maestro/pull/36).

### MAESTRO-18: Record escalation resolutions when the spec changes

#### Objective

Save every current `escalation` answer in the original `builder` `handoff`, whether the `spec` stays unchanged or requires revision. Each `resolution` records the owner's
chosen solution and reason. A decision requiring revision also identifies the `escalation` and describes the agreed `spec` change.

#### Agreed flow

`Maestro` records the complete decision batch through `maestro_resolve_escalations` before changing phase.

| Decision                                     | Next phase and action                                                                                                      |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| No `spec` change                             | `escalation-decisions` → `ready-for-builder`. The `builder` continues under the approved `spec`, without renewed approval. |
| `Spec` change required                       | `escalation-decisions` → `drafting-spec`. The `owner` and `Maestro` revise and review the same `spec`.                     |
| Revised `spec` receives renewed `GREEN FLAG` | `drafting-spec` → `ready-for-builder` through separate `maestro_mark_spec_ready` approval.                                 |

Direct `spec` approval from `escalation-decisions` is rejected. Recording answers does not move to `ready-for-verifier`; that phase requires a completed `builder` `pass`.

#### Implementation boundaries

Reuse the existing resolution operation and `handoff` fields. Do not add a parallel decision store, tool, or workflow phase. Define both resolution transitions explicitly
in `src/workflow/transitions.ts` and apply them through `transitionWorkflow`. Direct phase assignment elsewhere is banned. Preserve initial `spec` approval, `verifier`
`finding` decisions, existing batch validation, and historical `handoffs`.

#### Completed when

Saved `resolutions`, workflow phases, tool results, agent instructions, and human documentation follow the agreed flow. Verification checks both observable behavior and
use of the central transition definitions for each resolution branch. Passing behavior tests alone is not enough. The new `spec` includes coverage labels and omits
`acceptance criteria` already covered by tests of the same scenario.

### MAESTRO-21: Label acceptance criterion coverage

Historical outcome: the `Coverage` field described below was removed in `0.12.0`. See [changelog](CHANGELOG.md#0120).

Label each `acceptance criterion` as success, failure, or unchanged behavior.

Implemented with [MAESTRO-22](#maestro-22-avoid-acceptance-criteria-already-covered-by-tests) as one task, as selected by the `owner`. The `spec` template and `Maestro`
guidance require one `Coverage` label per `acceptance criterion`:

| Label       | Purpose                                      |
| ----------- | -------------------------------------------- |
| `success`   | A valid action produces the required result. |
| `failure`   | An invalid action is correctly rejected.     |
| `unchanged` | The change preserves existing behavior.      |

Use `unchanged` when the criterion explicitly checks behavior that the change must preserve. Labels describe scenarios, not test outcomes. A `failure` scenario passes
when the invalid action is correctly rejected. A `spec` does not need all three categories. `Maestro` includes labels when presenting criteria to the `owner` and checks
them against scenarios and `expected results` during review. Approval validation and `handoff` formats remain unchanged.

The existing creation integration test now checks that the generated `spec` includes the coverage field. The final `npm run check` passed all 238 tests and coverage
thresholds. No model trials were performed.

#### Evidence

[Spec template](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/templates/spec.md),
[Maestro guidance](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/src/maestro/instructions/getMaestroInstructions.ts),
[creation integration test](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/src/specs/create.integration.test.ts), and
[workflow documentation](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/docs/workflow.md#acceptance-criteria).

### MAESTRO-22: Avoid acceptance criteria already covered by tests

Omit `acceptance criteria` whose exact scenarios already have test coverage.

Implemented with [MAESTRO-21](#maestro-21-label-acceptance-criterion-coverage). `Maestro` inspects existing tests before writing `acceptance criteria`. It omits a
criterion only when a test covers the same starting conditions, action, and `expected result`. Partial or uncertain coverage does not justify omission. Similar tests do
not count.

During `spec` review, `Maestro` removes criteria whose exact scenarios already have test coverage. It keeps numbering continuous from `AC1` and updates affected
references. Required behavior remains documented in the requirements and constraints. The same rules apply during `spec` revisions. No automatic approval check was added.

Verification consisted of inspecting the written guidance and running `npm run check`. No model trials were performed.

#### Evidence

[Maestro guidance](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/src/maestro/instructions/getMaestroInstructions.ts),
[spec template](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/templates/spec.md), and
[workflow documentation](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/docs/workflow.md#acceptance-criteria).

### MAESTRO-24: Add a simplifier with one clear purpose per agent

Run the `simplifier` after accepted verification, with a Git-only file scope and separate report.

Completed under the
[specification](https://github.com/emilioSp/pi-maestro/blob/839ab9eb9753df22804d750657a616a9959c2c47/.specs/20261016-090319-add-a-dedicated-simplifier-after-verification/spec.md).
The `owner` confirmed completion. The `builder` implements the approved `spec`. The `verifier` checks its `acceptance criteria`. The `simplifier` refactors accepted code
for clarity. The extra code-quality review introduced in [MAESTRO-12](#maestro-12-verify-code-quality-against-agentsmd-instructions) is removed from the verifier's
instructions.

Successful verification and rejection of all current `findings` save `simplifier-running`. `Maestro` calls `maestro_run_simplifier` without another approval or
verification cycle. Only that tool checks Git readiness. If Git is unavailable, it warns and saves `candidate-ready` without delegation or a `simplifier` `handoff`.

The `simplifier` selects all uncommitted code changes, including pre-existing staged, unstaged, and untracked files. It preserves observable behavior and the accepted
check baseline. Rejected `findings` remain rejected, not passed. Required caller updates can include initially unchanged files. Unrelated refactoring, index changes, and
automatic commits are excluded.

A completed `pass` saves the fixed, unnumbered `handoffs/simplifier/S.json`, then saves `candidate-ready`. The report contains refactored files, a summary, and notes. No
refactoring is required when selected code is already clear. Maestro's final summary separates this report from independent `verifier` evidence.
