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

## Now

### R-17: Record escalation resolutions when the spec changes

#### Objective

Record the owner's chosen solution in each `escalation`'s `resolution`, including when that decision requires a `spec` revision. The current revision path leaves this field `null` in the original `builder` `handoff`.

When an `escalation` causes a `spec` revision, its `resolution` must state that the `spec` was revised because of that `escalation` and describe the agreed change.

#### Completed when

Before another `builder` `run` starts, every current `escalation` has a non-null `resolution` containing the chosen solution and reason. This applies whether the `spec` stays unchanged or is revised. The original `handoff` preserves the decision and its link to any resulting `spec` revision.


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