# Roadmap

This roadmap records planned outcomes, not permission to implement them. The `owner` selects work and approves its `specification` before implementation starts. Detailed requirements, technical decisions, and `acceptance criteria` belong in that `specification`.

"Now" is the current priority. "Next" follows it. “Later” contains uncommitted ideas with no promised order or date.

Item identifiers remain stable when priorities change. The `owner` approves changes to priorities and scope.

## Completed

### R-01: Improve status presentation and activation feedback

The status bar uses phase icons, theme colors, and shortened `spec` IDs. Successful activation shows the configured `builder` and `verifier` settings without adding the notice to session history or model context. All 12 `acceptance criteria` passed with no `verifier` `findings`. The saved workflow reached `candidate-ready`.

#### Evidence

[Specification](.specs/20261007-170438-update-maestro-status-bar-with-agent-models-theme-colors-and-phase-icons/spec.md), [verifier report](.specs/20261007-170438-update-maestro-status-bar-with-agent-models-theme-colors-and-phase-icons/handoffs/verifier/V1.json), and [merged PR #26](https://github.com/emilioSp/pi-maestro/pull/26).

### R-02: Store escalations and owner decisions in builder handoffs

Numbered `builder` `handoffs` contain multiple `escalation` questions and their `owner` resolutions. The `owner` resolves all current questions in one batch. Earlier `handoffs` remain available as history. All 10 `acceptance criteria` passed with no `verifier` `findings`. The saved workflow reached `candidate-ready`.

#### Evidence

[Specification](.specs/20261008-132344-store-escalations-in-builder-handoffs/spec.md), [verifier report](.specs/20261008-132344-store-escalations-in-builder-handoffs/handoffs/verifier/V1.json), and [merged PR #27](https://github.com/emilioSp/pi-maestro/pull/27).

### R-12: Format glossary terms consistently

Applied glossary formatting across the documentation and recorded its exclusions in `AGENTS.md` and the documentation audit skill. The approved change document uses the term `spec`. The `owner` confirmed completion.

#### Evidence

[Glossary](docs/glossary.md) and [workflow documentation](docs/workflow.md).

### R-15: Rename the test support directory

Renamed `test/` to `tests/` at the owner's request. Updated imports, fixture paths, lint configuration, and project instructions. This follows the global instruction to keep fixtures under `tests/fixtures`. Source tests remain next to their source files. Historical `handoffs` retain their recorded paths.

#### Evidence

[Test support](tests/support/), [fixtures](tests/fixtures/), [lint configuration](biome.json), and [project instructions](AGENTS.md#tests).

## Now

No current priority is selected.

## Next

### R-03: Route builder failures through owner escalations

#### Objective

A technical `builder` failure currently ends the workflow in `builder-failed`. Replace the builder's `failed` `handoff` status and the `builder-failed` workflow phase with an `escalation`. The `owner` decides how to proceed through the existing `escalation` process.

Automatic recovery of interrupted `runs` is outside this item. No `specification` is approved yet.

#### Completed when

`Builder` failures produce `owner` `escalations` instead of a terminal failure state. Individual checks retain `failed` as a valid result. Agent instructions, tools, workflow transitions, tests, and documentation describe the same behavior.

## Later

These items need scope review before `specification` approval. Existing behavior must be checked before adding new code. Dependencies between these items are not yet agreed.

### R-04: Rename the npm package

#### Objective

Rename `@emiliosp/pi-maestro` to `pi-maestro-sdd`. The `owner` installs the package under the new name. This item changes the package identity, not the development workflow.

Compatibility with installations under the old name must be decided in the `specification`. No `specification` is approved yet.

#### Completed when

Package metadata and installation documentation use the new name. The package is available under that name.

### R-05: Keep acceptance criterion numbering continuous

#### Objective

When criteria are removed during `spec` preparation or revision, renumber the remaining criteria without gaps. Numbering starts at `AC1` and continues through the final criterion.

#### Completed when

The `spec` and its current references use consistent numbering.

### R-06: Check subagent extensions at activation

#### Objective

Make extension availability problems visible before a `builder` or `verifier` `run` starts. Activation already checks agent launch requirements, so first identify any missing extension checks.

#### Completed when

Unavailable required subagent extensions prevent activation. The error identifies the problem.

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

### R-10: Match handoff criteria to the approved spec

#### Objective

Prevent `builder` and `verifier` reports from omitting or adding `acceptance criteria`. Each report must contain exactly the criterion IDs in the approved `spec`, with no duplicates in either place. Existing duplicate checks in reports do not establish this match.

The `specification` must define the criterion heading format used to extract IDs. For example, a heading can use `### AC1: ...`.

#### Completed when

Both `handoff` submissions reject missing, extra, or duplicate criterion IDs before saving a report or changing phase.

### R-11: Reduce temporary verifier changes

#### Objective

Reduce the risk that verification changes the `candidate`. Existing instructions already require exact restoration, cleanup, and reporting of unresolved restoration problems. Refine the remaining guidance rather than duplicate those rules.

Prefer checks that leave existing files unchanged and use separate temporary files when possible. Change an existing file only when a criterion requires it. Retain its exact contents and restore it immediately after each `probe`, including failed `probes`. Prefer check-only commands over commands that apply automatic fixes.

`Maestro` currently has no file-hash restoration check. Adding one requires a separate scope decision.

#### Completed when

`Verifier` instructions cover these limits and require restoration and temporary-file cleanup before `handoff`. If restoration fails, the `verifier` must stop and report affected paths and remaining changes.

### R-13: Show when Maestro is working

#### Objective

Show an activity indicator in Pi's status bar while progress does not require an `owner` decision. A spinner is one option, not an agreed implementation.

#### Completed when

The status clearly distinguishes work in progress from a request for `owner` action.

### R-14: Introduce Maestro at activation

#### Objective

When activated, `Maestro` gives a brief introduction and invites the `owner` to ask how it works, if interested. `Maestro` must have access to its own documentation to answer those questions.

#### Completed when

Activation includes this short introduction. `Maestro` can consult its documentation.

### R-16: Verify code quality against AGENTS.md instructions

#### Objective

Add code-quality review against applicable `AGENTS.md` instructions as another `verifier` responsibility. Keep all existing responsibilities unchanged, including independent verification of every `acceptance criterion` in the approved `spec`. Code-quality review supplements that verification. It does not replace or reduce it.

Existing `verifier` instructions already require reading applicable `AGENTS.md` files and following technical rules. Extend that guidance to require explicit code-quality review and reporting of instruction violations. Do not introduce personal style preferences as requirements.

#### Completed when

The `verifier` performs both its existing verification duties and the additional code-quality review. Every `acceptance criterion` is still independently verified. Each code-quality `finding` about an instruction violation identifies the `AGENTS.md` file, quotes the violated instruction, and explains how the code violates it.
