# Architecture decision records

An Architecture Decision Record (ADR) explains an important architectural choice, its context, and its consequences. This file contains one numbered record per decision.

Requirements and routine project rules belong in the [roadmap](ROADMAP.md) or other relevant documentation.

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

Superseded by [ADR-007](#adr-007-maintain-the-roadmap-in-the-repository).

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

## ADR-007: Maintain the roadmap in the repository

### Status

Accepted. Supersedes [ADR-006](#adr-006-maintain-the-roadmap-in-linear).

### Context

The `owner` reported excessive token use when accessing Linear and requested restoration of the Markdown roadmap. The `owner` also explicitly prohibited changes to the
Linear project.

### Decision

Maintain the roadmap in `ROADMAP.md` as the source of truth. Restore project items from Linear through read-only access, preserving existing `MAESTRO` identifiers, scope,
and evidence. Do not transfer Linear onboarding or test issues.

Keep Linear unchanged as historical reference. Routine roadmap reading and maintenance use local files, not MCP.

### Consequences

Planning no longer requires Linear access. Repository instructions, documentation audit guidance, links, and published package contents refer to the local roadmap. Later
roadmap changes do not need synchronization with Linear.

Conflicting imported status and acceptance evidence remain explicit rather than being treated as proof of final `owner` acceptance.

### Evidence

[Roadmap](ROADMAP.md) and [repository instructions](AGENTS.md).

## ADR-008: Use Pi's registry for model availability

### Status

Accepted. Implemented.

### Context

Maestro's model format regex rejected OpenRouter IDs containing additional slashes. The `owner` selected Pi as the source of truth for models and explicitly retained the
activation availability check because it uses Pi's registry.

### Decision

Treat configured models as strings without a separate format regex. During activation, match each complete `provider/model` identifier against
`context.modelRegistry.getAvailable()`, preserving slashes inside model IDs. Pass the configured identifier unchanged through `pi-subagents`.

Keep Maestro's configuration structure, version, path, thinking-level, and timeout validation.

### Consequences

A model absent from Pi's available registry prevents activation. `Maestro` maintains no separate model catalog or authentication check. Provider or authentication
failures during delegation still use the existing `run` failure path. Workflow recovery and phase transitions remain unchanged.

### Evidence

[Configuration](docs/configuration.md#model-access), [activation checks](src/maestro/checks/assertEnvironment.ts), and
[delegation](src/tools/utils/pi-subagent-delegation.ts).

## ADR-009: Select optional phases in the transition table

### Status

Accepted. Implemented under MAESTRO-27.

### Context

The `owner` selected configuration flags to support workflows with only an approved `spec` and independently optional later agents without a separate phase-selection
interface.

### Decision

Each agent has a `required` boolean that defaults to `true`. Disabling `builder` skips all agents. Otherwise `verifier` and `simplifier` can be disabled independently.
Flags are set before activation and stay unchanged during the workflow. Keep existing configuration reads, without caching or runtime controls.

Keep destination selection in `src/workflow/transitions.ts`. A transition destination is either a fixed phase or a pure function of resolved configuration. Callers pass
configuration to `transitionWorkflow` and save its returned state. No new workflow states, events, or persisted selection fields are needed.

### Consequences

Approval can finish at `candidate-ready` without agent execution. Agent and model availability checks apply only to selected phases; activation with only an approved
`spec` needs no `pi-subagents` ping. Final summaries identify skipped work, without claiming implementation or independent verification occurred.

### Evidence

[Approved design](.specs/20261103-161424-maestro-27-make-implementation-phases-optional/design.md) and [phase selection](docs/configuration.md#phase-selection).

## ADR-010: Use the Pi SDK for sequential agent delegation

### Status

Design decisions confirmed by the `owner`. Not implemented.

### Context

`Maestro` currently depends on `pi-subagents` to execute the `builder`, `verifier`, and `simplifier`. Its delegation needs are limited: only one workflow and one child
agent execute at a time, and `Maestro` waits for each child to finish. `Maestro` already owns workflow transitions, role instructions, saved `handoffs`, and result
validation.

The `owner` wants to remove the `pi-subagents` dependency without building a general-purpose delegation framework. Pi provides `createAgentSession()` for direct SDK
integration and `RpcClient` for subprocess control. Separate conversations do not require separate processes.

### Decision

1. Replace `pi-subagents` delegation with direct use of the Pi SDK through `createAgentSession()`, rather than RPC subprocesses.
2. Preserve sequential execution: one workflow at a time, one child agent at a time, with `Maestro` waiting for completion.
3. Use task-and-handoff communication, not a live supervisor dialogue. `Maestro` assigns the task; the child works, saves its `handoff`, and finishes.
4. When an `owner` decision is needed, the `builder` saves an `escalation` and ends its `run`. `Maestro` discusses it with the `owner` and records the decisions through
   the existing workflow. Any subsequent `builder` `run` starts a fresh conversation and reads the saved decisions.
5. Child sessions must have access to the same working tools available to `Maestro`, plus the tools needed to save their own `handoffs`. Do not load the main
   `Maestro` extension into child sessions. Tools supplied by other extensions may remain available even if they support delegation; role instructions forbid using
   them to delegate. This is a tool-access requirement, not merely an extension-loading policy.
6. Automatically load enabled global and project extensions, excluding the main `Maestro` extension. Provide the corresponding working-tool environment through Pi's
   native APIs and configuration, including separate Pi support such as MCP and `codemode` where needed. Loading the same extensions alone does not reproduce every
   CLI capability. Compatibility of arbitrary extensions, tools, and model providers is outside Maestro's responsibility; do not add custom compatibility checks or
   adapters.
7. All three child roles receive the owner's global instruction file, normally `~/.pi/agent/AGENTS.md`, preserving the current `inheritGlobalContext: true` behavior.
   These instructions are not the parent's conversation history.
8. All three child roles automatically receive project instructions discovered by Pi, such as applicable `AGENTS.md` files, preserving the current
   `inheritProjectContext: true` behavior. These instructions supplement global instructions and role-specific guidance.
9. All three child roles can discover and use available skills, preserving the current `inheritSkills: true` behavior. Expose the skill catalog without loading every
   skill's full contents into the conversation. Skills remain subject to the child's role boundaries and permitted tools; they do not authorize delegation or workflow
   management.
10. During a child `run`, report the role, elapsed time, current tool, and recent normal assistant text through Pi's standard tool-progress updates (`onUpdate`). Use
    Pi's built-in presentation, including its default layout, truncation, and expansion behavior. Do not build a custom renderer or implement a fixed visible-line
    count or terminal-height adaptation. Update progress in place instead of appending intermediate messages to the main conversation. Do not include internal reasoning
    or full command output. Continue reporting activity when the child produces no text; do not prompt it to generate artificial progress messages.
11. Intermediate activity text is UI-only and must not enter the main model's context. `Maestro` continues to receive the existing workflow result. Pi's display limits
    do not truncate the saved child conversation. The five-, ten-, and twenty-line alternatives are superseded by the decision to use Pi's standard presentation.
12. Persist child conversations using Pi's native session format, rather than a custom transcript format. Saved sessions remain available after execution for diagnosis,
    including unsuccessful executions. Each child `run` starts a new conversation; persistence does not introduce automatic session reuse or workflow recovery.
13. At child completion or failure, show the `owner` the path to its saved Pi session file, when one exists. The `owner` can inspect the file directly or use Pi's native
    HTML export with `pi --export <session-file> conversation.html`. Do not build a transcript inspector inside `Maestro`. Reading or exporting a transcript does not
    resume child execution.
14. Do not impose an automatic child `run` timeout in `Maestro`. Remove `builder.timeoutMinutes`, `verifier.timeoutMinutes`, and `simplifier.timeoutMinutes` from
    `.pi/maestro.json` configuration support, including schema validation, defaults, launch inputs, and configuration documentation. A child continues until it finishes,
    fails, or is manually interrupted. This removes the workflow-level deadline, not the elapsed-time progress display or timeouts internal to Pi and its tools.
15. Remove `timeoutMinutes` from the configuration schemas and retain `additionalProperties: false`. Existing TypeBox-based validation rejects configuration files that
    still contain the field. Do not add a migration, ignored legacy fields, or special compatibility handling. The `owner` removes obsolete fields manually.
16. Preserve the existing execution-error policy. Launch failures, failed child executions, and missing or invalid `handoffs` stop the workflow and report the error.
    `Maestro` does not automatically start another child session to retry, repair saved state, or roll back files. Preserve the remaining project files and saved
    workflow state for manual `owner` follow-up, including partial protocol writes. Errors do not introduce recovery transitions or synthetic `escalations`.
17. Propagate manual cancellation of the main tool to its active child through `session.abort()` and await the interruption before releasing the child session. Do not
    send a final model prompt asking the child to finish, and do not generate a synthetic `handoff`. Leave project files and saved workflow state unchanged by cleanup.
    Close child sessions and release progress subscriptions and session resources on completion, failure, or cancellation. Do not start another child while the
    previous child remains active.
18. Store child sessions in a `subagents/` subdirectory of Pi's normal project session directory, normally
    `~/.pi/agent/sessions/--<project-path>--/subagents/`. Resolve the parent directory through Pi's session-directory API rather than reimplementing project-path encoding.
    Use Pi's native `SessionManager` with this directory. Do not create a `subagents/` directory inside the project repository.
19. Require Pi 1.5.0 or later for the SDK-based implementation. Update the declared Pi requirement and align implementation verification with this baseline. Do not add
    compatibility fallbacks for earlier Pi versions. This minimum is a scope choice, not a claim that all earlier versions lack the required APIs.
20. Do not build an additional tool allowlist or exclusion list to prevent child delegation. Children may have delegation tools available, but their role instructions
    forbid using them. This deliberately relies on instruction compliance rather than technical removal of delegation capabilities. The main `Maestro` extension
    remains excluded.
21. Leave compatibility of external integrations to Pi and the `owner`. Do not add a preflight that compares parent and child tool availability, extension health
    checks, special adapters, or a fallback system for incompatible integrations. This scope boundary does not suppress errors actually reported during launch or
    execution; those follow the existing stop-and-report policy.

### Consequences

The replacement does not need supervisor request routing or a mechanism that makes the main model answer a child while waiting for it. Saved `handoffs` remain the
communication boundary for completed work and `escalations`.

SDK sessions share a Node.js process. Separate conversation histories do not isolate module-level mutable state or project files. Child resource loading must account
for this distinction.

Automatic extension loading intentionally differs from the current foreground behavior of `pi-subagents` 0.78.0, which does not automatically load the parent's global
and project extensions. Shared working-tool access is provided through Pi's native environment, not an independent compatibility guarantee for every integration.
The replacement must use Pi's tool activation and support such as MCP and `codemode`, rather than assuming the SDK supplies the CLI's capabilities by default. There
is no custom parity check, health gate, or adapter layer for third-party integrations.
Children do not inherit the parent's conversation, but they share the process and may interact with process-wide mutable state. Loaded extensions can create
additional connections, timers, and process-wide effects. Excluding the main `Maestro` extension does not establish compatibility with every other extension or remove
delegation tools supplied by other extensions. `Maestro` launches its own children sequentially; compliance with the broader no-delegation rule relies on child
instructions. A child that ignores those instructions could launch other agents. This accepted limitation avoids maintaining tool classifications and exclusion
lists and does not claim a sandbox; even ordinary shell access can launch processes.

Pi's standard tool-progress presentation replaces FleetView's live activity display, not its full transcript inspector. `Maestro` owns the progress data, not a new
rendering system or a guaranteed panel size. Displaying text already produced by the child requires no additional model generation and does not add that text to the
main model's context. Full transcript inspection uses saved session files and Pi's existing export capability rather than a replacement inspector. The main tool
must connect cancellation to the child SDK session and perform session cleanup; selecting the SDK alone does not wire these operations together.

Native session files retain child messages, tool calls, and tool results beyond the lifetime of the child session. They may contain project data present in those
messages and results. Persistence is separate from the live progress display and does not add the transcript to the main model's context. The dedicated `subagents/`
subdirectory keeps child session files separate from the main session files without adding transcript files to the project repository or introducing a custom storage
format.

Removing the configured deadline simplifies child execution but permits indefinitely running work until manual interruption. This is a breaking configuration change:
files that still contain `timeoutMinutes` fail existing configuration validation until the `owner` removes the obsolete fields. Document the removal without adding
legacy compatibility code.

Manual cancellation uses Pi's in-process cancellation lifecycle, not termination of a separate operating-system process. It does not undo completed writes or
introduce a final model turn. `Maestro` uses Pi's cancellation and cleanup lifecycle; behavior of third-party integrations remains outside its compatibility contract.

The Pi minimum increases from the currently documented 1.0.0 to 1.5.0. Earlier hosts are outside the new compatibility contract. At decision time, the project has Pi
1.0.3 installed locally and the active harness uses Pi 1.5.0; the implementation must be verified against the selected baseline rather than treating the older local
installation as sufficient verification. This ADR changes no installed dependencies.

### Evidence

During the architecture discussion, the `owner` selected the SDK and task-and-handoff communication, then clarified the tool-access contract: the same working tools
as `Maestro`, plus child handoff tools, with the main `Maestro` extension excluded. The `owner` subsequently accepted that delegation tools from other extensions may
remain available, with their use forbidden by instructions rather than additional tool filters.
The `owner` also confirmed that all three roles continue receiving global and automatically discovered project instructions, as declared by `inheritGlobalContext: true`
and `inheritProjectContext: true` in the existing role definitions. All three roles also retain access to the skill catalog and can load relevant skill instructions,
consistent with their existing `inheritSkills: true` setting and subject to role and tool restrictions. After discussing bounded display sizes, the `owner` selected
Pi's standard tool-progress presentation rather than custom rendering, while retaining recent assistant text without sending intermediate text to the main model.
The `owner` selected persistent transcripts in Pi's native session format, while
keeping each child conversation fresh. The `owner` chose to receive the saved session path and use direct file inspection or Pi's native HTML export, without a
`Maestro` transcript inspector. The `owner` chose the simplest execution option: no automatic child deadline, with the timeout settings removed from configuration.
The `owner` accepted that existing TypeBox-based validation rejects configurations retaining `timeoutMinutes`, without migration or compatibility handling, and
confirmed the existing execution-error policy: stop and report, retain files, and leave follow-up to the `owner`, without automatic retries, repair, or rollback.
The `owner` selected manual interruption through `session.abort()` followed by session cleanup, without a final model turn or synthetic `handoff`, and placed saved
child sessions in `subagents/` beneath Pi's project session directory, not inside the repository. The `owner` chose Pi 1.5.0 as the minimum supported version, without
fallbacks for earlier hosts. The `owner` explicitly excluded compatibility handling for external integrations from scope; no custom checks, adapters, or reduced-capacity
fallback system are required.
Existing boundaries are described in
[subagent integration](docs/subagent-integration.md), [delegation](src/tools/utils/pi-subagent-delegation.ts),
[builder execution](src/tools/main/run-builder.ts), and the [child extension](extensions/maestro-subagent.ts). These links describe the current implementation, not the
planned SDK replacement.
