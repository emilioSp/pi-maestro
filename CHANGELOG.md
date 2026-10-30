# Changelog

This file summarizes meaningful changes to the codebase, including behavior, data formats, architecture, and development tools. Git tags identify version boundaries;
GitHub Releases are not required.

## Unreleased

1. Restored `ROADMAP.md` as the planning source of truth from the current Linear issues, retaining their identifiers and recorded evidence. Updated repository guidance,
   documentation links, and package contents so roadmap maintenance no longer requires Linear. Linear data remains unchanged.

## 0.13.0

1. Automatically turn off `Maestro` after successfully delivering the final summary of a completed workflow, including when Git is unavailable and simplification is
   skipped. Clear live tools, status, instructions, and active `spec` selection while preserving saved workflow files and other extensions. See
   [MAESTRO-26](https://linear.app/emilio-spatola/issue/MAESTRO-26).

## 0.12.0

1. Added stable `REQ` identifiers and a `Verified by` field to the `spec` template and `Maestro` guidance. Each requirement links to its `acceptance criteria` or exact
   existing test scenarios. Review checks complete coverage and current links, including during revisions. Approval validation and `handoff` formats remain unchanged.
2. Added per-requirement `Delta` labels: `added`, `modified`, and `removed`. Modified or removed behavior can include a brief, evidence-based `Before` description when
   useful. Requirements state the complete required outcome; unchanged behavior remains implicit. Approval validation and `handoff` formats remain unchanged.
3. Split new `specs` into required `proposal.md` and `spec.md`, with optional `design.md`. One `GREEN FLAG` approves and freezes the present document set; all agent roles
   read it. Creation returns the new document paths; approval requires the proposal. Historical documents are not migrated.
4. Placed requirement-associated `acceptance criteria` under their requirements as level-four headings. Relevant standalone regression criteria use level-three headings
   under optional `Regression checks`, without inventing unchanged requirements. Both forms share global numbering and are required in `handoffs`. Workflow phases and
   saved report formats remain unchanged.
5. Removed the `Coverage` classification field from current `acceptance criteria`. Each criterion retains its `probe`, `expected result`, and example. Standalone
   regression checks remain identified by their section; validation and report formats are unchanged.

## 0.11.0

1. Added the `simplifier` after successful verification or rejection of all current `findings`, without another approval or verification cycle.
2. Added Git-only readiness and file discovery for simplification. If Git is unavailable, the workflow warns and completes without delegation.
3. Added independent `simplifier` configuration, activation checks and presentation, running status, and the fixed `handoffs/simplifier/S.json` result.
4. Removed the extra code-quality review from the verifier's instructions. The `simplifier` preserves accepted behavior without introducing check failures.

## 0.10.1

1. Added `success`, `failure`, and `unchanged` coverage labels to the `spec` template and `Maestro` guidance. Approval validation and `handoff` formats remain unchanged.
2. Required `Maestro` to inspect existing tests before writing `acceptance criteria` and remove criteria whose exact scenarios already have coverage. Requirements remain
   documented in the `spec`.

## 0.10.0

1. Saved complete `owner` decision batches in their original `handoffs` before changing phase, including when the `spec` requires revision. See
   [PR #38](https://github.com/emilioSp/pi-maestro/pull/38).
2. Added `revise-spec` decisions for `verifier` `findings`, with the owner's reason and agreed requirement change. Revision takes priority over code fixes and rejections.
3. Unified both revision paths through `drafting-spec`, with renewed `GREEN FLAG` before separate approval and another `builder` `run`. Approval is allowed only from
   `drafting-spec`.
4. Renamed workflow events to identify `builder` and `owner` actions. Both revision paths share `OWNER_REQUEST_SPEC_REVISION`.
5. Breaking: supply the required boolean `specChangeRequired` when calling `maestro_resolve_escalations`.
6. Breaking: saved decision phases are now `escalation-decisions` and `finding-decisions`. Existing workflows using older names require manual `owner` handling. No
   automatic migration is provided.

## 0.9.5

1. Added a shared check that requires every approved `spec` criterion ID in `builder` and `verifier` `handoffs`. See
   [PR #37](https://github.com/emilioSp/pi-maestro/pull/37).
2. Missing IDs reject submission before saving a report or changing phase. Extra report IDs remain allowed, and existing report validation is unchanged.
3. Reused the raw heading rule `^### AC(\d+):`, including leading zeros and matching lines inside code blocks. No matching headings impose no new restriction.
4. Added unit tests for extraction and one missing-ID integration test per role.

## 0.9.4

1. Added numbering validation to `spec` approval. Matched `acceptance criterion` headings must start at `AC1` and continue without gaps. See
   [PR #36](https://github.com/emilioSp/pi-maestro/pull/36).
2. Invalid numbering rejects approval before saving the workflow and leaves all saved files unchanged. No matching headings still permits approval.
3. Added `Maestro` guidance to correct only numbering and affected references, then retry with the existing `GREEN FLAG`. No additional `owner` approval is required
   before starting the `builder`.

## 0.9.3

1. Added a parent `pi-subagents` availability check during activation. A matching successful version 1 `ping` reply is required within 2000 ms. See
   [PR #35](https://github.com/emilioSp/pi-maestro/pull/35).
2. Failed or invalid replies, emission errors, and timeouts prevent activation. The error includes "Maestro flow requires pi-subagents installed in the Pi environment."
   The check makes no automatic retry.
3. Preserved existing activation checks, UI-only notices, and unchanged session history. The availability check starts no agent, makes no model request, and does not run
   when turning `Maestro` off.

## 0.9.2

1. Added code-quality review to `verifier` guidance for code affected by the approved change when applicable `AGENTS.md` directives exist. See
   [PR #34](https://github.com/emilioSp/pi-maestro/pull/34). All existing verification duties remain unchanged.
2. Required instruction-violation `findings` to identify the instruction file, quote the rule, and explain the violating code through existing evidence fields.
3. Skip only the added review when files or code-quality directives are absent. Missing directives and personal style preferences do not produce `findings`.

## 0.9.1

1. Added a brief introduction and an invitation to ask how `Maestro` works to the successful activation notice. See
   [PR #33](https://github.com/emilioSp/pi-maestro/pull/33).
2. Preserved the configured agent details and UI-only activation. Activation does not add session history or start a model request.
3. Added absolute paths to the installed README and documentation directory in active instructions. `Maestro` reads relevant documentation on demand without automatically
   loading its contents.

## 0.9.0

1. Breaking: `builder` reports now support only `done` and `escalation`. Reportable technical problems use the existing `owner` `escalation` process. See
   [PR #32](https://github.com/emilioSp/pi-maestro/pull/32).
2. Removed the terminal `builder` failure phase and event. Execution errors and missing or invalid saved results still stop the workflow without automatic recovery.
3. No migrations, compatibility readers, or deprecated aliases are provided. `Artifact` versions remain `1.0.0`.

## 0.8.0

1. Updated the bundled `pi-subagents` dependency from `0.76.0` to `0.78.0`.
2. Renamed `test/` to `tests/`. Updated imports, fixture paths, lint configuration, and project instructions. Source tests remain next to their source files.

## 0.7.3

1. Added Oxlint rules for `given ... when ... then ...` test titles, `const` usage, unnecessary `else` branches, type aliases, and ESM imports. See
   [PR #31](https://github.com/emilioSp/pi-maestro/pull/31).
2. Updated `oxlint-anti-slop` from `0.3.3` to `0.3.6`.
3. Updated 106 test titles to match the naming rule without changing test logic.

## 0.7.2

1. Renamed the constitution files to `MISSION.md`, `TECH_STACK.md`, `ROADMAP.md`, and `CHANGELOG.md`. Updated their links, package file list, and audit references.
2. Applied consistent inline code formatting to glossary terms across the documentation. Recorded the formatting rule and its exclusions in `AGENTS.md` and the
   documentation audit skill.
3. Used `spec` consistently for the approved change document and removed the redundant glossary entry.

## 0.7.1

1. Documented the project mission, current tech stack, `owner` responsibilities, roadmap, and codebase change history. See
   [PR #30](https://github.com/emilioSp/pi-maestro/pull/30).
2. Replaced `TODO.md` with the roadmap and included the four project constitution documents in the npm package.
3. Updated documentation audits to compare all current documentation and the project constitution with the working tree without requesting a comparison baseline.

## 0.7.0

1. Stored multiple `escalation` questions and `owner` resolutions inside numbered `builder` `handoffs`. Earlier `handoffs` remain available as history. See
   [PR #27](https://github.com/emilioSp/pi-maestro/pull/27).
2. Breaking: replaced `maestro_open_escalation` and `maestro_resolve_escalation` with `maestro_record_builder_handoff` and `maestro_resolve_escalations`. Done `handoffs`
   require `escalations: []`. Standalone `escalation` storage was removed without migration or compatibility readers. `Artifact` versions remain `1.0.0`.
3. Added LCOV coverage reports and Codecov uploads from CI. See [PR #28](https://github.com/emilioSp/pi-maestro/pull/28).

Reload `Maestro` extensions before starting new workflows so sessions use the updated tools.

## 0.6.2

Added phase icons, theme colors, and display-only shortening of long `spec` IDs. Successful activation shows the configured agent settings in a UI-only notice, outside
session history and model context. See [PR #26](https://github.com/emilioSp/pi-maestro/pull/26).

## 0.6.0

1. Removed Git requirements, checkpoints, and automatic commits from the workflow. `Maestro` uses Pi's project directory and saved workflow phase. See
   [PR #25](https://github.com/emilioSp/pi-maestro/pull/25).
2. Retained numbered `builder` and `verifier` `handoffs` and explicit `owner` `finding` decisions. Removed workflow revision counters and writer locks.
3. Breaking: changed `artifact` formats, `handoff` paths, and tool results without migration or compatibility readers. Removed revision and commit fields. `Artifact`
   versions remain `1.0.0`. Interrupted and older workflows require manual `owner` handling.

## 0.5.2

Reverted the `spec` question-dependency instructions introduced in `0.5.1`. See [commit 13cad11](https://github.com/emilioSp/pi-maestro/commit/13cad11).

## 0.5.1

Added instructions to resolve prerequisite decisions before asking dependent `spec` questions and to review unresolved decisions before approval. These instructions were
reverted in `0.5.2`.

## 0.5.0

Removed breakage checks from `specs`, `handoffs`, validation, and agent instructions. Breakage checks temporarily introduced faults to test error detection.
`Acceptance criteria` retain `probes`, `expected results`, and concrete examples. See [PR #24](https://github.com/emilioSp/pi-maestro/pull/24).

Breaking: `handoffs` no longer accept `breakageStatus`. Older `handoffs` containing that field must be regenerated. `Artifact` versions remain `1.0.0`.

## 0.4.5

Required a concrete example in every `acceptance criterion`, both in the `spec` and when presenting it to the `owner`. Examples identify starting conditions, an action,
and the expected observable result.

## 0.4.4

Expanded Maestro's explanations of `findings` and `escalations` with code evidence, concrete examples, available choices, and their consequences. The `owner` retains
control of each decision.

## 0.4.3

Removed explicit `builder` and `verifier` tool allowlists and enabled inherited skills. Workflow boundaries remain defined by agent instructions.

## 0.4.2

Made breakage checks optional when the approved `spec` did not require them. Required acceptance `probes` remained mandatory. Breakage checks were later removed in
`0.5.0`. See [PR #23](https://github.com/emilioSp/pi-maestro/pull/23).

## 0.4.1

Enabled inheritance of global instructions for `builder` and `verifier` agents, alongside project context.

## 0.4.0

1. Fixed delegated `handoffs` that depended on unavailable parent session memory. See [PR #22](https://github.com/emilioSp/pi-maestro/pull/22).
2. Removed hash-based `spec` guards and checkpoint-based `verifier` comparisons. `Spec` preservation and restoration rely on agent instructions.
3. Refreshed the running status before delegation and required repository investigation before presenting technical decisions during `spec` preparation.

## 0.3.0

Clarified `Maestro`, `builder`, and `verifier` responsibilities, `spec` and prototype revisions, permitted experiments, evidence requirements, and cleanup. See
[PR #21](https://github.com/emilioSp/pi-maestro/pull/21).

## 0.2.0

Moved TypeBox to peer dependencies and loosened Pi peer dependency version constraints. Kept `pi-subagents` bundled with the package.

## 0.1.2

Pinned `verifier` comparisons to a fixed `candidate` checkpoint rather than the current HEAD's parent. This checkpoint mechanism was later removed in `0.4.0`. See
[PR #20](https://github.com/emilioSp/pi-maestro/pull/20).

Breaking: renamed `maestro_launch_builder` and `maestro_launch_verifier` to `maestro_run_builder` and `maestro_run_verifier`. Renamed the corresponding workflow events
from `launch-*` to `run-*`.

## 0.1.1

First tagged baseline with `/maestro`, `spec` creation and approval, and foreground `builder` and `verifier` `runs`. The `owner` decides `escalation` questions and
`verifier` `findings`. The workflow ends at `candidate-ready`, leaving final review to the `owner`. See [PR #14](https://github.com/emilioSp/pi-maestro/pull/14) and
[PR #13](https://github.com/emilioSp/pi-maestro/pull/13).
