# Changelog

This file summarizes meaningful changes to the codebase, including behavior, contracts, architecture, and development tools. Git tags identify version boundaries; GitHub Releases are not required. Version-only changes and routine maintenance are omitted.

## 0.7.1

1. Documented the project mission, current tech stack, owner responsibilities, roadmap, and codebase change history. See [PR #30](https://github.com/emilioSp/pi-maestro/pull/30).
2. Replaced `TODO.md` with the roadmap and included the four project constitution documents in the npm package.
3. Updated documentation audits to compare all current documentation and the project constitution with the working tree without requesting a comparison baseline.

## 0.7.0

1. Stored multiple escalation questions and owner resolutions inside numbered builder handoffs. Earlier handoffs remain available as history. See [PR #27](https://github.com/emilioSp/pi-maestro/pull/27).
2. Breaking: replaced `maestro_open_escalation` and `maestro_resolve_escalation` with `maestro_record_builder_handoff` and `maestro_resolve_escalations`. Done handoffs require `escalations: []`. Standalone escalation storage was removed without migration or compatibility readers. Artifact versions remain `1.0.0`.
3. Added LCOV coverage reports and Codecov uploads from CI. See [PR #28](https://github.com/emilioSp/pi-maestro/pull/28).

Reload Maestro extensions before starting new workflows so sessions use the new tool contracts.

## 0.6.2

Added phase icons, theme colors, and display-only shortening of long spec IDs. Successful activation shows the configured agent settings in a UI-only notice, outside session history and model context. See [PR #26](https://github.com/emilioSp/pi-maestro/pull/26).

## 0.6.0

1. Removed Git requirements, checkpoints, and automatic commits from the workflow. Maestro uses Pi's project directory and saved workflow phase. See [PR #25](https://github.com/emilioSp/pi-maestro/pull/25).
2. Retained numbered builder and verifier handoffs and explicit owner finding decisions. Removed workflow revision counters and writer locks.
3. Breaking: changed artifact contracts, handoff paths, and tool results without migration or compatibility readers. Removed revision and commit fields. Artifact versions remain `1.0.0`. Interrupted and older workflows require manual owner handling.

## 0.5.2

Reverted the spec question-dependency instructions introduced in `0.5.1`. See [commit 13cad11](https://github.com/emilioSp/pi-maestro/commit/13cad11).

## 0.5.1

Added instructions to resolve prerequisite decisions before asking dependent spec questions and to review unresolved decisions before approval. These instructions were reverted in `0.5.2`.

## 0.5.0

Removed breakage checks from specs, handoffs, validation, and agent instructions. Breakage checks temporarily introduced faults to test error detection. Acceptance criteria retain probes, expected results, and concrete examples. See [PR #24](https://github.com/emilioSp/pi-maestro/pull/24).

Breaking: handoffs no longer accept `breakageStatus`. Older handoffs containing that field must be regenerated. Artifact versions remain `1.0.0`.

## 0.4.5

Required a concrete example in every acceptance criterion, both in the spec and when presenting it to the owner. Examples identify starting conditions, an action, and the expected observable result.

## 0.4.4

Expanded Maestro's explanations of findings and escalations with code evidence, concrete examples, available choices, and their consequences. The owner retains control of each decision.

## 0.4.3

Removed explicit builder and verifier tool allowlists and enabled inherited skills. Workflow boundaries remain defined by agent instructions.

## 0.4.2

Made breakage checks optional when the approved spec did not require them. Required acceptance probes remained mandatory. Breakage checks were later removed in `0.5.0`. See [PR #23](https://github.com/emilioSp/pi-maestro/pull/23).

## 0.4.1

Enabled inheritance of global instructions for builder and verifier agents, alongside project context.

## 0.4.0

1. Fixed delegated handoffs that depended on unavailable parent session memory. See [PR #22](https://github.com/emilioSp/pi-maestro/pull/22).
2. Removed hash-based spec guards and checkpoint-based verifier comparisons. Spec preservation and restoration rely on agent instructions.
3. Refreshed the running status before delegation and required repository investigation before presenting technical decisions during spec preparation.

## 0.3.0

Clarified Maestro, builder, and verifier responsibilities, spec and prototype revisions, permitted experiments, evidence requirements, and cleanup. See [PR #21](https://github.com/emilioSp/pi-maestro/pull/21).

## 0.2.0

Moved TypeBox to peer dependencies and loosened Pi peer dependency version constraints. Kept `pi-subagents` bundled with the package.

## 0.1.2

Pinned verifier comparisons to a fixed candidate checkpoint rather than the current HEAD's parent. This checkpoint mechanism was later removed in `0.4.0`. See [PR #20](https://github.com/emilioSp/pi-maestro/pull/20).

Breaking: renamed `maestro_launch_builder` and `maestro_launch_verifier` to `maestro_run_builder` and `maestro_run_verifier`. Renamed the corresponding workflow events from `launch-*` to `run-*`.

## 0.1.1

First tagged baseline with `/maestro`, spec creation and approval, and foreground builder and verifier runs. The owner decides escalation questions and verifier findings. The workflow ends at `candidate-ready`, leaving final review to the owner. See [PR #14](https://github.com/emilioSp/pi-maestro/pull/14) and [PR #13](https://github.com/emilioSp/pi-maestro/pull/13).
