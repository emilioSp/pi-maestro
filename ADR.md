# Architecture decision records

An Architecture Decision Record (ADR) explains an important architectural choice, its context, and its consequences. This file contains one numbered record per decision.

Requirements and routine project rules belong in the [roadmap](https://linear.app/emilio-spatola/team/MAESTRO/overview) or other relevant documentation.

When a new decision replaces an accepted decision, add a new record, mark the earlier record as superseded, and link both records.

## ADR-001: Keep the workflow independent of Git

### Status

Superseded by [ADR-004](#adr-004-require-git-only-for-the-simplifier). Recorded date: 2026-10-07. Implemented in `0.6.0`.

### Context

The previous workflow required Git and used checkpoints and automatic commits. The recorded reason for removing that approach was to simplify the project. Other evaluated
alternatives were not recorded.

### Decision

`Maestro` uses the Pi project directory and saved workflow phase. It does not require Git or create automatic commits.

The `verifier` checks live project files. The `owner` controls later Git use, pull requests, and merging.

### Consequences

Workflow execution no longer depends on Git. Revision and commit fields were removed without migration or compatibility readers. Interrupted and older workflows require
manual `owner` handling.

### Evidence

[Commit deae41c](https://github.com/emilioSp/pi-maestro/commit/deae41ce66a3f2c76859209c44165e7ddd0f3a72), [Changelog 0.6.0](CHANGELOG.md#060), and
[workflow completion](docs/workflow.md#workflow-completion).

## ADR-002: Store escalation decisions in builder handoffs

### Status

Accepted. Recorded date: 2026-10-08. Implemented in `0.7.0`.

### Context

The previous approach stored `escalations` in standalone files and used singular resolution tools. The recorded reason for replacing it was to use the same storage, local
ID, and batch decision model as `verifier` `findings`. Other evaluated alternatives were not recorded.

### Decision

Numbered `builder` `handoffs` contain `escalation` questions and their `owner` resolutions. One call records all current answers. No parallel storage model is needed.

IDs restart at `E1` in each `handoff`. References include both IDs, such as `B1/E1`. Answers update only the active handoff's resolution fields.

### Consequences

Standalone `escalation` storage and singular resolution tools were removed. Questions and decisions remain together in each numbered `builder` `handoff`.

There are no migration procedures, fallback readers, or deprecated aliases. `Artifact` versions remain `1.0.0` despite the breaking change.

### Evidence

[Repository-only specification](.specs/20261008-132344-store-escalations-in-builder-handoffs/spec.md),
[Commit dda6eb5](https://github.com/emilioSp/pi-maestro/commit/dda6eb5b3ab76ba175112c3c565c70be747d7344), and [escalation workflow](docs/workflow.md#escalations).

## ADR-003: Route builder failures through owner escalations

### Status

Accepted. Implemented.

### Context

The `owner` must decide how work continues after a reportable technical problem. The workflow also needs a simpler model with two `builder` outcomes.

### Decision

The `builder` reports only `done` or `escalation`. Reportable technical failures use the existing `escalation` process. The `owner` decides how to proceed instead of
reaching a terminal failure phase.

### Consequences

Reuse the existing tools, numbered `handoffs`, and batch decisions. Individual `probe` results retain `failed` as a valid value.

Execution and protocol errors without a valid saved result still stop the workflow. This decision adds no automatic recovery.

This breaking MVP change has no migrations, compatibility readers, deprecated aliases, or dedicated legacy-format tests.

### Evidence

[Specification](.specs/20261013-101454-route-builder-failures-through-owner-escalations/spec.md) and
[MAESTRO-7](https://linear.app/emilio-spatola/issue/MAESTRO-7/route-builder-failures-through-owner-escalations).

## ADR-004: Require Git only for the simplifier

### Status

Accepted. Implemented through MAESTRO-24. Supersedes [ADR-001](#adr-001-keep-the-workflow-independent-of-git).

### Context

The `simplifier` needs a list of changed code files. Git can supply that list without adding file tracking to `builder` `handoffs`.

### Decision

Only the `simplifier` requires Git and a Git repository to discover changed files. It has no non-Git fallback.

The Git readiness decision belongs only inside `maestro_run_simplifier`, before delegation. The tool checks readiness with `git rev-parse --is-inside-work-tree` in the
project directory. Only a successful result of `true` enables simplification.

Activation, `spec` preparation, `builder` execution, `verifier` completion, and `finding` resolution do not check Git readiness. Both `simplifier` entry routes save
`simplifier-running` before `Maestro` calls `maestro_run_simplifier`.

`Maestro` does not create automatic commits or Git checkpoints. The `owner` retains control of commits, pull requests, and merging.

### Consequences

If Git readiness cannot be confirmed, `maestro_run_simplifier` reports a warning and skips delegation. The workflow moves from `simplifier-running` to `candidate-ready`
without an error. The skip transition is defined in `src/workflow/transitions.ts` and applied through `transitionWorkflow`.

Activation does not predict whether simplification will be skipped. The same readiness decision applies after successful verification and after the `owner` rejects all
current `findings`. Rejected `findings` retain their reasons and do not become passed verification.

The `simplifier` uses Git to select all staged, unstaged, and untracked code changes, including pre-existing changes. There is no spec-specific starting commit or
`builder` file list. Required caller updates can include initially unchanged files.

### Evidence

[MAESTRO-24](https://linear.app/emilio-spatola/issue/MAESTRO-24/add-a-simplifier-with-one-clear-purpose-per-agent) and the
[specification](.specs/20261016-090319-add-a-dedicated-simplifier-after-verification/spec.md).

## ADR-005: Approve a specification document set as one contract

### Status

Accepted. Implemented.

### Context

Combining motivation, behavior, and technical decisions in one `spec.md` made the document difficult to navigate. The `owner` selected separate documents by purpose, with
`acceptance criteria` next to their requirements rather than collected at the end.

### Decision

Each new `spec` has required `proposal.md` for motivation and scope and `spec.md` for behavior and `acceptance criteria`. `Maestro` creates `design.md` only when
significant approved technical decisions need recording. Routine implementation choices remain with the `builder`.

One `GREEN FLAG` approves all present documents together. The entire set and its prototypes remain frozen during agent execution. Revision uses the existing
`drafting-spec` flow and renewed approval of the complete set. No per-document approval or new workflow phase is introduced.

Requirements keep level-three `REQ` headings. Their `acceptance criteria` use level-four AC headings. Relevant standalone regression criteria use level-three AC headings
under an optional `Regression checks` section, without a requirement or `Delta` field. All criteria share continuous numbering across the document. Shared criteria are
defined once and linked from other requirements.

### Consequences

Creation saves the proposal and behavioral `spec`, returns their paths and the optional design path, and leaves design creation to drafting. Approval requires the
proposal. All three agent roles read every present document and must not create or modify a design after approval.

Freezing continues to rely on agent instructions, without a file-hash manifest or file locks. Saved workflow and `handoff` formats are unchanged. Level-three standalone
regression AC headings and nested level-four headings are both recognized. Historical `specs` are not migrated; older drafts need manual `owner` handling before new
approval.

### Evidence

[Document workflow](docs/workflow.md#specification-documents), [creation](src/specs/create.ts), [approval](src/workflow/spec/markSpecReady.ts), and
[templates](templates/).

## ADR-006: Maintain the roadmap in Linear

### Status

Accepted. Implemented.

### Context

The `owner` moved roadmap items from the repository to Linear, selected the dedicated `MAESTRO` team, and requested removal of the local roadmap file and redundant
identifiers. This moves the source of truth for planning outside Git.

### Decision

Maintain the roadmap only in [Linear](https://linear.app/emilio-spatola/team/MAESTRO/overview), using Linear issue identifiers. Keep the roadmap location and maintenance
instructions in `AGENTS.md`, without a local copy of the issue list.

Approved `specifications`, verification evidence, the changelog, and architectural decisions remain in the repository.

### Consequences

Reading or updating current roadmap state requires Linear access. Git history remains evidence of earlier plans, not the current roadmap. Imported issues retain
commit-pinned links to repository evidence. Removing the local roadmap also removes it from the published package.

### Evidence

[Linear roadmap](https://linear.app/emilio-spatola/team/MAESTRO/overview) and [repository instructions](AGENTS.md).
