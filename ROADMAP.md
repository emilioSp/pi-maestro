# Roadmap

This file is the source of truth for planned outcomes and recorded completion. Roadmap entries are not permission to implement them. The `owner` selects work and approves
its `specification` before implementation starts. Detailed requirements, technical decisions, and `acceptance criteria` belong in that `specification`.

Backlog items have no agreed order or date. The `owner` approves priority and scope changes.

Completed entries preserve recorded outcomes and evidence, which may describe behavior later changed. Completion requires `owner` acceptance, not only passing checks or
reaching `candidate-ready`. Linear onboarding and test issues are not project roadmap items and are omitted.

## Overview

| ID                 | Item                                                                                                                               | Status      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| MAESTRO-6          | [Display specs in a browser](#maestro-6-display-specs-in-a-browser)                                                                | Backlog     |
| MAESTRO-7          | [Route builder failures through owner escalations](#maestro-7-route-builder-failures-through-owner-escalations)                    | Completed   |
| MAESTRO-8          | [Store escalations and owner decisions in builder handoffs](#maestro-8-store-escalations-and-owner-decisions-in-builder-handoffs)  | Completed   |
| MAESTRO-9          | [Format glossary terms consistently](#maestro-9-format-glossary-terms-consistently)                                                | Completed   |
| MAESTRO-10         | [Improve status presentation and activation feedback](#maestro-10-improve-status-presentation-and-activation-feedback)             | Completed   |
| MAESTRO-11         | [Introduce Maestro at activation](#maestro-11-introduce-maestro-at-activation)                                                     | Completed   |
| MAESTRO-12         | [Verify code quality against AGENTS.md instructions](#maestro-12-verify-code-quality-against-agentsmd-instructions)                | Completed   |
| MAESTRO-13         | [Check subagent extensions at activation](#maestro-13-check-subagent-extensions-at-activation)                                     | Completed   |
| MAESTRO-14         | [Rename the test support directory](#maestro-14-rename-the-test-support-directory)                                                 | Completed   |
| MAESTRO-15         | [Match handoff criteria to the approved spec](#maestro-15-match-handoff-criteria-to-the-approved-spec)                             | Completed   |
| MAESTRO-16         | [Route finding-driven spec revisions through drafting-spec](#maestro-16-route-finding-driven-spec-revisions-through-drafting-spec) | Completed   |
| MAESTRO-17         | [Keep acceptance criterion numbering continuous](#maestro-17-keep-acceptance-criterion-numbering-continuous)                       | Completed   |
| MAESTRO-18         | [Record escalation resolutions when the spec changes](#maestro-18-record-escalation-resolutions-when-the-spec-changes)             | Completed   |
| MAESTRO-19         | [Guide initial configuration](#maestro-19-guide-initial-configuration)                                                             | Backlog     |
| MAESTRO-20         | [Rename the npm package](#maestro-20-rename-the-npm-package)                                                                       | Backlog     |
| MAESTRO-21         | [Label acceptance criterion coverage](#maestro-21-label-acceptance-criterion-coverage)                                             | Completed   |
| MAESTRO-22         | [Avoid acceptance criteria already covered by tests](#maestro-22-avoid-acceptance-criteria-already-covered-by-tests)               | Completed   |
| MAESTRO-23         | [Change agent models before a builder run](#maestro-23-change-agent-models-before-a-builder-run)                                   | Backlog     |
| MAESTRO-24         | [Add a simplifier with one clear purpose per agent](#maestro-24-add-a-simplifier-with-one-clear-purpose-per-agent)                 | Completed   |
| MAESTRO-25         | [Define workflow reconciliation](#maestro-25-define-workflow-reconciliation)                                                       | Backlog     |
| MAESTRO-26         | [Exit Maestro mode automatically at workflow completion](#maestro-26-exit-maestro-mode-automatically-at-workflow-completion)       | Completed   |
| MAESTRO-27         | [Make all implementation phases optional](#maestro-27-make-all-implementation-phases-optional)                                     | Completed   |
| MAESTRO-28         | [Add Maestro role instructions alongside the other agents](#maestro-28-add-maestro-role-instructions-alongside-the-other-agents)   | Backlog     |
| MAESTRO-FREE-1     | [Require Pi 1.5.0](#maestro-free-1-require-pi-150)                                                                                 | Completed   |
| MAESTRO-FREE-2     | [Remove Maestro run timeouts](#maestro-free-2-remove-maestro-run-timeouts)                                                         | Completed   |
| MAESTRO-FREE-PRE-3 | [Implement internal SDK delegation](#maestro-free-pre-3-implement-internal-sdk-delegation)                                         | Completed   |
| MAESTRO-FREE-3     | [Run the builder through the Pi SDK](#maestro-free-3-run-the-builder-through-the-pi-sdk)                                           | In progress |
| MAESTRO-FREE-4     | [Run the verifier through the Pi SDK](#maestro-free-4-run-the-verifier-through-the-pi-sdk)                                         | In progress |
| MAESTRO-FREE-5     | [Run the simplifier through the Pi SDK](#maestro-free-5-run-the-simplifier-through-the-pi-sdk)                                     | In progress |
| MAESTRO-FREE-6     | [Show SDK agent activity through Pi](#maestro-free-6-show-sdk-agent-activity-through-pi)                                           | Backlog     |
| MAESTRO-FREE-7     | [Remove the pi-subagents dependency](#maestro-free-7-remove-the-pi-subagents-dependency)                                           | In progress |

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

### MAESTRO-28: Add Maestro role instructions alongside the other agents

#### Objective

Add `agents/maestro.md` for `Maestro` role instructions alongside `agents/builder.md`, `agents/verifier.md`, and `agents/simplifier.md`.

#### Completed when

`Maestro` role instructions are maintained in `agents/maestro.md` alongside the other agent role files.

### MAESTRO-FREE-3: Run the builder through the Pi SDK

Implementation follows the [approved migration specification](.specs/20261106-092601-feat-migrate-builder-verifier-and-simplifier-to-the-pi-sdk/spec.md). SDK integration
is implemented; `owner` acceptance is pending.

#### Objective

Connect `builder` delegation to the internal SDK executor delivered by [MAESTRO-FREE-PRE-3](#maestro-free-pre-3-implement-internal-sdk-delegation), following
[ADR-010](ADR.md#adr-010-use-the-pi-sdk-for-sequential-agent-delegation). Preserve the existing role instructions, `handoffs`, and workflow behavior.

#### Scope and dependencies

Requires [MAESTRO-FREE-PRE-3](#maestro-free-pre-3-implement-internal-sdk-delegation). Implement FREE-3, [FREE-4](#maestro-free-4-run-the-verifier-through-the-pi-sdk), and
[FREE-5](#maestro-free-5-run-the-simplifier-through-the-pi-sdk) as one migration of all three roles. Their identifiers retain the role-specific verification scope, not
separate execution mechanisms or releases. Do not introduce temporary mixed-engine routing or an engine selector. Verify each role and the supported optional-phase
combinations before completing the migration. Human documentation must describe the resulting SDK execution. Live progress remains in
[MAESTRO-FREE-6](#maestro-free-6-show-sdk-agent-activity-through-pi); existing workflow-phase status remains available in the meantime.

#### Completed when

1. An approved `spec` can be implemented by an SDK `builder` with fresh conversation history, the configured model and thinking level, role guidance, global and project
   instructions, skills, working tools, and existing `handoff` tools.
2. It reuses the established executor's context and tool loading without another execution mechanism. Role instructions continue to forbid further delegation.
3. `done` and `escalation` outcomes preserve existing saved `handoffs`, validation, phase transitions, and subsequent workflow routes. A later `builder` `pass` starts
   fresh and reads saved decisions rather than restoring the previous conversation.
4. Errors stop the workflow without rollback or repair. Manual cancellation reaches `session.abort()`, and child sessions and subscriptions are cleaned up on every exit.
5. Native Pi session files are saved beneath the project's Pi session directory in `subagents/`. The `owner` receives the saved path on completion or failure when a file
   exists; it can be inspected or exported with Pi, without automatic resumption.
6. Existing trust, configuration, and model checks remain applicable. Activation and execution no longer require `pi-subagents` ping or launch-contract checks for any
   role. A `builder`-only workflow uses the SDK without requiring a `pi-subagents` availability reply.
7. Each `run` waits for its child to finish or be interrupted before another starts. Existing optional-phase behavior remains intact.

### MAESTRO-FREE-4: Run the verifier through the Pi SDK

Implementation follows the [approved migration specification](.specs/20261106-092601-feat-migrate-builder-verifier-and-simplifier-to-the-pi-sdk/spec.md). SDK integration
is implemented; `owner` acceptance is pending.

#### Objective

Connect the `verifier` to the SDK executor delivered by [MAESTRO-FREE-PRE-3](#maestro-free-pre-3-implement-internal-sdk-delegation), following
[ADR-010](ADR.md#adr-010-use-the-pi-sdk-for-sequential-agent-delegation). Implement this role's switch together with FREE-3 and FREE-5 under the
[shared migration scope](#maestro-free-3-run-the-builder-through-the-pi-sdk). Do not redesign verification or its reports.

#### Completed when

1. The SDK `verifier` independently checks the approved `spec` and saves existing numbered `handoffs`, preserving criterion validation, `finding` decisions, and phase
   transitions.
2. It reuses the established fresh-session context, tools, persistence, cancellation, cleanup, and error policy without a second execution mechanism.
3. Activation and execution no longer use `pi-subagents` for the `verifier`.
4. Workflows with verification enabled or disabled retain their existing routes, with all enabled roles using the common SDK executor.

### MAESTRO-FREE-5: Run the simplifier through the Pi SDK

Implementation follows the [approved migration specification](.specs/20261106-092601-feat-migrate-builder-verifier-and-simplifier-to-the-pi-sdk/spec.md). SDK integration
is implemented; `owner` acceptance is pending.

#### Objective

Connect the `simplifier` to the SDK executor delivered by [MAESTRO-FREE-PRE-3](#maestro-free-pre-3-implement-internal-sdk-delegation), following
[ADR-010](ADR.md#adr-010-use-the-pi-sdk-for-sequential-agent-delegation). Implement this role's switch together with FREE-3 and FREE-4 under the
[shared migration scope](#maestro-free-3-run-the-builder-through-the-pi-sdk). Keep its existing purpose and Git-only scope.

#### Completed when

1. The SDK `simplifier` preserves the current Git readiness decision, skip behavior, and entry routes. No Git readiness check moves into activation or an earlier phase.
2. Successful execution saves the existing unnumbered `S.json` `handoff` and reaches `candidate-ready`; optional-phase behavior remains unchanged.
3. It reuses the established context, tools, persistence, cancellation, cleanup, and error policy.
4. Activation and execution no longer use `pi-subagents` for the `simplifier`. All roles migrate together, so no workflow path requires its ping, launch preflight, or
   fixed delegation deadline.

### MAESTRO-FREE-6: Show SDK agent activity through Pi

#### Objective

Show activity for SDK-based agent `runs` through Pi's standard `onUpdate` presentation, as decided in
[ADR-010](ADR.md#adr-010-use-the-pi-sdk-for-sequential-agent-delegation). Requires the shared migration covered by
[MAESTRO-FREE-3](#maestro-free-3-run-the-builder-through-the-pi-sdk), FREE-4, and FREE-5, and applies to all three roles through the common executor.

#### Completed when

1. Progress reports the role, elapsed time, current tool, and recent normal assistant text, including activity while the agent produces no text.
2. Pi controls layout, truncation, and expansion. There is no custom renderer, fixed line count, transcript inspector, or artificial progress prompting.
3. Intermediate text stays out of the main model's context. Final workflow results, saved session contents, and cancellation behavior remain unchanged.
4. Progress subscriptions are released when the child finishes, fails, or is interrupted.

### MAESTRO-FREE-7: Remove the pi-subagents dependency

Implementation follows the [approved migration specification](.specs/20261106-092601-feat-migrate-builder-verifier-and-simplifier-to-the-pi-sdk/spec.md). Code cleanup is
included in this migration. Package declarations, lockfile entries, bundling, and `pi.subagents` metadata remain for the `owner` to remove manually.

#### Objective

Finish [ADR-010](ADR.md#adr-010-use-the-pi-sdk-for-sequential-agent-delegation) by removing the package dependency, bundling, and remaining integration metadata after
[MAESTRO-FREE-3](#maestro-free-3-run-the-builder-through-the-pi-sdk), [MAESTRO-FREE-4](#maestro-free-4-run-the-verifier-through-the-pi-sdk), and
[MAESTRO-FREE-5](#maestro-free-5-run-the-simplifier-through-the-pi-sdk). This is dependency removal, not another execution-engine switch.

#### Completed when

1. `Maestro` neither imports nor bundles `pi-subagents`, and package metadata, role frontmatter, tests, installation instructions, and current human documentation no
   longer require it. Historical records remain historical evidence.
2. A clean installation can activate and complete workflows without `pi-subagents` installed or enabled, including the supported optional-phase combinations.
3. Existing workflow and `handoff` formats remain unchanged. No compatibility framework, engine-selection flags, or migration of interrupted workflows is added.

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

Completed entries include historical records imported from Linear and work explicitly accepted by the `owner`. Historical verification evidence alone does not establish
final `owner` acceptance.

### MAESTRO-FREE-1: Require Pi 1.5.0

#### Objective

Adopt Pi 1.5.0 as the minimum supported host and verification baseline for [ADR-010](ADR.md#adr-010-use-the-pi-sdk-for-sequential-agent-delegation), without changing the
delegation engine or adding compatibility fallbacks.

#### Completed when

1. Declared requirements and the development verification environment use the selected Pi baseline consistently.
2. The existing extension and `pi-subagents` workflow continue to work on Pi 1.5.0.

#### Implementation and evidence

The `owner` confirmed completion. `README.md` declares Pi 1.5.0 as the minimum host. Development dependencies for the four Pi packages are pinned to 1.5.0, so type checks
and tests run against that baseline. Schema enums use TypeBox `Type.Enum` with an explicit string type. `npm run check` passes on 1.5.0, including the extension and
`pi-subagents` integration tests.

### MAESTRO-FREE-2: Remove Maestro run timeouts

#### Recorded outcome

The `owner` confirmed completion of the timeout configuration removal implemented in `0.16.0`. The three `timeoutMinutes` settings, their defaults, and their
configuration documentation were removed. Existing TypeBox validation rejects configuration retaining those fields, without migration or compatibility handling.

The current `pi-subagents` integration still receives a fixed deadline of 9,999 minutes. This is not unlimited execution. Removal of that remaining deadline belongs to
the SDK delegation replacement under [ADR-010](ADR.md#adr-010-use-the-pi-sdk-for-sequential-agent-delegation), not a separate prerequisite for it.

#### Evidence

[Changelog](CHANGELOG.md#0160), [PR #46](https://github.com/emilioSp/pi-maestro/pull/46), [configuration schema](src/config/schema.ts), and
[current delegation deadline](src/tools/utils/pi-subagent-delegation.ts).

### MAESTRO-FREE-PRE-3: Implement internal SDK delegation

#### Implementation and evidence

The standalone executor is implemented under `src/delegation/` against the [approved specification](.specs/20261105-212231-implement-internal-pi-sdk-delegation/spec.md).
Execution orchestration, session lifecycle, and pure reply interpretation are separated into `executeTask`, `SubSession`, and `readTaskResult`. Manual verification on Pi
1.5.0 exercised fresh context, native and additional tools, MCP through tool search and codemode, sequential waiting, failure, cancellation, cleanup, and native session
persistence. See [manual evidence](docs/subagent-integration.md#manual-verification). The three workflow roles still use `pi-subagents`. The `owner` confirmed completion.
The caller's message is named `prompt`, execution is inlined in `executeTask`, and cancellation comments explain Node.js `AbortError`. At the owner's request,
cancellation is forwarded only by the signal listener, without checks before or after the prompt or a retry at `agent_start`. An already cancelled signal does not prevent
submission, and an aborted signal alone does not turn a normal Pi result into an interruption.

#### Objective

Implement and verify one internal execution operation using `createAgentSession()`, following [ADR-010](ADR.md#adr-010-use-the-pi-sdk-for-sequential-agent-delegation).
The operation is independent of the `builder`, `verifier`, and `simplifier` roles. Callers supply the task, role instructions, model settings, working directory, and
additional tools needed for that execution.

#### Scope and dependencies

Requires [MAESTRO-FREE-1](#maestro-free-1-require-pi-150) and [MAESTRO-FREE-2](#maestro-free-2-remove-maestro-run-timeouts). This item implements the execution mechanism
without switching existing workflow tools away from `pi-subagents`. FREE-3, FREE-4, and FREE-5 connect the three roles to it together after it is verified.

The executor manages child sessions, not the workflow. It does not select phases, interpret role outcomes, or validate `handoffs`. Those responsibilities remain with the
callers and existing workflow operations. Communication remains task-and-`handoff`, without shared in-memory workflow state or a live supervisor dialogue. This is not a
new public tool or a general-purpose orchestration framework. Live progress presentation remains in [MAESTRO-FREE-6](#maestro-free-6-show-sdk-agent-activity-through-pi).

#### Completed when

1. The operation executes a supplied task in a fresh SDK conversation with the supplied model and thinking level, role guidance, global and project instructions, skills,
   working tools, and caller-supplied additional tools. It does not depend on any of the three workflow roles.
2. Enabled global and project extensions and native Pi tool support load as defined in ADR-010, excluding the main `Maestro` extension. The main session retains its
   `Maestro` mode while the child executes. No compatibility adapters, integration health gates, or delegation-prevention tool filters are added.
3. Execution waits for the child to finish, fail, or be interrupted before another child starts. The executor imposes no automatic deadline and does not start a new
   session to retry or repair failed work.
4. Manual cancellation reaches `session.abort()` and waits for interruption. Sessions, subscriptions, and owned resources are released on every exit, without rollback,
   workflow changes, or synthetic `handoffs`. Execution errors propagate to the caller.
5. Native Pi sessions are persisted in `subagents/` beneath Pi's project session directory, resolved through Pi's API. The saved path is available to the caller on
   completion or failure when a file exists. Every execution starts fresh; no automatic resumption is introduced.
6. Successful execution, execution failure, cancellation, context and tool loading, and session persistence are verified independently of the workflow migration. The
   existing three role tools still use `pi-subagents` at the end of this item.

### MAESTRO-27: Make all implementation phases optional

#### Objective

Make the entire implementation stage optional, including the `builder`, `verifier`, and `simplifier` phases. Let the `owner` use `Maestro` only to prepare and approve a
`spec`, leaving implementation to another workflow.

When implementation runs in `Maestro`, the `owner` can still independently enable or disable the `verifier` and `simplifier` phases. `Spec` preparation and approval
remain required.

#### Completed when

1. The `owner` can complete a workflow with only an approved `spec`, without running the `builder`, `verifier`, or `simplifier`.
2. Implementation can be performed through another workflow using the approved `spec`, without requiring further execution in `Maestro`.
3. The existing requested combinations remain available: `builder` only; `builder` and `verifier`; `builder` and `simplifier`; or all three.
4. Disabled phases are not delegated and do not block workflow completion.
5. The workflow reaches `candidate-ready` after `spec` approval when no agent phases are selected, or after the selected phases complete and any required `owner`
   decisions are resolved.
6. The final summary clearly identifies skipped phases and does not claim that skipped implementation or verification has been completed.

#### Implementation and evidence

Implemented under the [specification](.specs/20261103-161424-maestro-27-make-implementation-phases-optional/spec.md). The `owner` confirmed completion. Each agent's
`required` boolean in `.pi/maestro.json` defaults to `true`. Flags are set before activation and remain unchanged during the workflow. Disabling `builder` skips all three
agents; otherwise `verifier` and `simplifier` are independently optional. `Spec` preparation and approval remain required. The activation notice lists only enabled agents
and no agents when `builder` is disabled.

The [README](README.md#the-idea) presents the two uses of `Maestro`: writing and approving a `spec` only, or also implementing it through optional agent phases.

#### Context

[MAESTRO-24](#maestro-24-add-a-simplifier-with-one-clear-purpose-per-agent) introduced the `simplifier`. Its existing Git-unavailable skip is not an explicit `owner`
choice. This item originally made only the post-`builder` phases optional. The `owner` expanded the scope to include the `builder`, so `Maestro` can also be used solely
for writing and approving a `spec`.

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
