# 20261007-101403-file-system-driven-maestro-workflow: File system driven Maestro workflow

> After owner approval, this specification is the contract for the builder and verifier.

## 1. Context, goals, and scope

Maestro currently requires Git to locate the project, record checkpoints, accept agent results, and identify the verified candidate.

The workflow must operate on the file system. Maestro must not depend directly on the presence or state of Git.

The change covers activation, project paths, agent runs, owner decisions, result validation, and agent instructions.

### Scope limits

- No dependency changes. 
- Automatic recovery of interrupted workflows remains out of scope.
- No changes to the documentation.

## 2. Requirements and constraints

1. Maestro tools and agent actions must not interact directly with Git. Do not invoke it, inspect its metadata, or use its state to control workflow operations.
2. `workflow.json` is the source of truth for the finite state machine. Its validated phase controls workflow transitions.
3. Handoffs and escalation artifacts supply the evidence and owner decisions associated with that state. Agent messages do not replace these artifacts.
4. Keep validation of state, artifact identity, schema, and result consistency.
5. Do not add or rewrite code for an acceptance criterion that the existing implementation already satisfies under this spec. Reuse existing tests when they cover its probe. The probe remains mandatory.
6. No additional dedicated acceptance criteria are required for a full workflow without Git, project-root selection, or automatic builder launch. Their specified behavior remains required.
7. Do not update README files or any files under `docs/`. These documentation updates will follow code implementation in a separate task. Agent instruction files remain in scope.

## 3. Technical decisions

### Approved direction

Use file system artifacts to control the workflow. Keep the existing state machine as the starting point.

References: `src/workflow/state/schema.ts` and `src/workflow/transitions.ts`.

### Approved spec approval and builder start

After the spec review, Maestro explicitly asks the owner to inspect the current spec and reply with `GREEN FLAG` to approve it and start the builder.

Only that explicit owner response approves the spec. Mentions in artifacts, quoted text, and agent recommendations are not owner approval.

On approval, Maestro freezes the spec as the contract, records `ready-for-builder`, and starts the builder in the foreground after that transition succeeds. No separate start request is required.

Freezing means the approved spec must not change during builder or verifier execution. Existing owner-directed contract revisions remain limited to the permitted decision phases and require renewed approval.

Example: The workflow is in `drafting-spec`. Maestro asks the owner to review `spec.md` and reply `GREEN FLAG`. The owner sends `GREEN FLAG`. Maestro records `ready-for-builder` and then launches the builder, which starts in `builder-running`.

References: `src/maestro/instructions/getMaestroInstructions.ts`, `src/tools/main/mark-spec-ready.ts`, and `src/tools/main/run-builder.ts`.

### Approved sequential state model

The workflow is strictly sequential. Maestro, builder, and verifier do not update state concurrently. A child execution finishes before Maestro continues or starts another child.

Stop using `revision` in state, handoff, escalation, and tool-result contracts. Remove its counter logic, comparisons, and expected-revision parameters. If an input still contains `revision`, ignore it rather than rejecting it. Do not add tests that assert its absence.

Remove the workflow writer lock.

The state contains `version`, `specId`, and `phase`. Use the numbered artifact layout defined below.

Keep atomic replacement of each JSON file. This prevents incomplete file contents without introducing concurrency controls.

Example: A newly created workflow contains `version: "1.0.0"`, its `specId`, and `phase: "drafting-spec"`. Writing it creates no `workflow.json.lock`.

References: `src/workflow/state/writeWorkflowState.ts`, `src/workflow/state/schema.ts`, and `src/utils/write-atomically.ts`.

### Approved project boundary

The project root is the canonical Pi working directory, resolved with `realpath`. Do not search ancestor directories.

Load `.pi/maestro.json` from this root. Resolve the spec directory and permitted product paths against this root. Launch children in this directory.

This rule matches Pi's working-directory configuration and needs no new discovery mechanism.

Example: Pi starts in `/work/app/src`. The project root is `/work/app/src`, even when `/work/app` contains `.pi/maestro.json`.

References: `src/tools/utils/resolveToolRunContext.ts`, `src/config/loadConfiguration.ts`, and `src/MaestroPaths.ts`.

### Approved verification and cleanup boundary

The verifier checks the live project files. Maestro does not create a complete candidate copy or record file hashes for automatic restoration checks.

The owner accepts reliance on the verifier for cleanup. Its instructions must require restoration of its temporary changes and removal of only its own temporary files. Pre-existing content and files must survive cleanup. If cleanup cannot finish safely, the verifier must stop and report the remaining changes.

Example: `src/total.ts` contains `return 42` before a probe. The verifier temporarily changes it to `return 0`. Cleanup must restore exactly `return 42`.

Maestro tools validate the protocol, not restoration of every product file. This design assumes no external product edits during verification and retains no immutable candidate copy.

References: `src/workflow/verifier/prepareVerifierRun.ts`, `src/tools/main/run-verifier.ts`, and `agents/verifier.md`.

### Approved artifact retention

Keep handoffs from earlier builder and verifier executions on the file system. Later executions must not delete these records.

Use one numbered file per completed builder or verifier handoff, with a separate sequence for each role. Keep the existing numbered escalation files.

The artifact layout is:

```text
handoffs/
  builder/
    B1.json
    B2.json
  verifier/
    V1.json
    V2.json
  escalations/
    E1.json
```

A verifier file contains its complete handoff. Record each owner finding decision explicitly in that file: `reject` with its reason, or `fix-code`. A finding without an owner decision must remain distinguishable from a requested code fix.

Owner finding decisions update that file, as escalation resolutions update their escalation file. A later verifier execution creates the next numbered file instead of replacing it and preserves earlier recorded decisions.

Finding IDs remain local to their verifier handoff. For example, `V1/F1` and `V2/F1` identify different observations. This history records executions and their decisions, not every intermediate file version.

References: `src/artifacts/escalation/createEscalation.ts`, `src/artifacts/escalation/readEscalationHistory.ts`, `src/artifacts/escalation/resolveEscalation.ts`, and `src/workflow/findings/resolveFindings.ts`.

### Approved active handoff selection

For each role, the active handoff is the file with the highest numeric sequence number. Earlier files remain available only as references. Do not add `specRevision` to determine which handoff is active.

Example: With `B9.json`, `B10.json`, `V9.json`, and `V10.json`, the active handoffs are `B10.json` and `V10.json`.

The workflow phase governs allowed operations. Tools still validate the artifact's spec identity, schema, and consistency with the reported outcome. Selecting the newest handoff does not make an invalid result acceptable.

The approved `spec.md` remains the contract against which agents assess observations in the active handoffs.

References: `src/workflow/state/schema.ts`, `src/workflow/builder/prepareBuilderRun.ts`, `src/workflow/verifier/prepareVerifierRun.ts`, and `agents/builder.md`.

### Approved failure and interruption behavior

Keep the existing stop-and-report rule when an operation partially saves protocol files or an execution is interrupted. Preserve the files that remain. The owner handles the interrupted workflow manually. Do not add automatic rollback, repair, or resume.

If an operation fails without saving artifacts or changing state, a corrected request can be retried. A partially saved transition must not be retried automatically.

Atomic replacement protects each JSON file, not an entire multi-file transition. If an error occurs after replacement, preserve the saved state and artifacts, report the error, and stop.

Example: The verifier tool saves `V2.json`, but the phase save fails before replacing `workflow.json`. The tool reports failure, the phase remains `verifier-running`, and `V2.json` remains for owner inspection.

Disabling Maestro, restarting Pi, or using `/resume` still clears live Maestro session state. Persisted files do not automatically reconstruct or resume the workflow.

References: `src/workflow/state/writeWorkflowState.ts`, `src/workflow/builder/completeBuilderPass.ts`, and `src/maestro/session/MaestroSessionState.ts`.

### Approved external configuration boundary

Maestro does not support or manage worktrees. The owner is responsible for compatible `pi-subagents` configuration. Do not add worktree configuration checks, activation gates, warnings, or automatic configuration changes.

Keep the current delegation integration. No upstream API or dependency change is needed for this boundary.

The installed `pi-subagents` version can inherit `worktree: true`, and its delegation API has no per-request override. That unsupported configuration remains the owner's responsibility, not a condition for Maestro activation.

Indirect Git dependencies are accepted. Git calls made internally by `pi-subagents` are outside Maestro's direct Git prohibition.

References: `src/tools/utils/pi-subagent-delegation.ts` and the installed `pi-subagents` delegation adapter, executor, and mutation evidence code.

### Approved breaking change

The artifact contracts and numbered handoff layout defined in this spec are authoritative. Do not implement migration, backward compatibility, or fallback paths. Do not write tests that demonstrate failure with previous formats or paths.

Keep schema `version: "1.0.0"` in `workflow.json`, builder handoffs, verifier handoffs, and escalations. Do not change these version values despite the breaking change.

## 4. Acceptance criteria

### AC1: A terminal handoff inconsistent with the phase is not accepted

1. Probe: Present a terminal workflow state with an active builder handoff whose status contradicts that phase. Let the parent tool read the agent result.
2. Expected result: The parent tool reports a protocol error.
3. Example: The workflow has phase `ready-for-verifier`. Its active builder handoff has status `failed`. The builder result is rejected because this phase requires status `done`.

### AC2: Verifier instructions require cleanup that preserves pre-existing files and content

1. Probe: Read the verifier instructions for a probe that changes an existing file and creates a temporary file beside an unrelated pre-existing file.
2. Expected result: The instructions require the verifier to undo only its own temporary changes before submitting the handoff.
3. Example: `src/total.ts` starts with `return 42`, and `notes.txt` already exists. The verifier changes the source to `return 0` and creates `probe.txt`. The instructions require restoring `return 42`, removing `probe.txt`, and leaving `notes.txt` unchanged.

### AC3: Maestro does not create a product baseline for automatic cleanup checks

1. Probe: Start and complete a verifier run and inspect the artifacts produced by Maestro tools.
2. Expected result: Maestro creates neither a product snapshot nor a file-hash manifest for cleanup validation.
3. Example: Start a verifier run for a project containing `src/total.ts`. On completion, Maestro records the verifier handoff and workflow state, but no copy or hash manifest of the product files.

### AC4: A later builder execution preserves the previous builder handoff

1. Probe: Complete a builder execution, request a code fix through verifier findings, and complete the next builder execution. Read the earlier builder handoff.
2. Expected result: The earlier handoff remains available with its original content.
3. Example: `handoffs/builder/B1.json` has summary `Implemented greeting`. After an owner-requested fix, `handoffs/builder/B2.json` has summary `Fixed greeting`. `B1.json` still has summary `Implemented greeting` and its original probe results.

### AC5: A later verifier execution preserves earlier finding rejections

1. Probe: Record mixed owner decisions on verifier findings, complete the requested builder fixes, and complete the next verifier execution. Read the earlier verifier record.
2. Expected result: The earlier finding retains its recorded rejection reason.
3. Example: `handoffs/verifier/V1.json` reports `F1` and `F2`. The owner rejects `F1` with reason `Outside approved scope` and requests a fix for `F2`. After creation of `handoffs/verifier/V2.json`, `V1.json` still records the rejection of `F1` with reason `Outside approved scope`.

### AC6: The highest numeric handoff number identifies the active handoff for each role

1. Probe: Store valid handoffs for both roles with sequence numbers `9` and `10`. Resolve the active handoff for each role.
2. Expected result: The handoff with sequence number `10` is selected for each role.
3. Example: The builder directory contains `B9.json` and `B10.json`. The verifier directory contains `V9.json` and `V10.json`. The active handoffs are `B10.json` and `V10.json`. The other files remain references.

### AC7: State writes do not use a workflow lock file

1. Probe: Observe the file operations during a workflow state update.
2. Expected result: No workflow lock file is opened or created.
3. Example: Approve the spec `20261007-120000-add-greeting`. The state write does not open or create `.specs/20261007-120000-add-greeting/workflow.json.lock`.

### AC8: A phase save failure before atomic replacement preserves the previous phase

1. Probe: Start with phase `verifier-running`. Save the verifier handoff, then make the state save fail before replacing `workflow.json`. Observe the state after the operation reports failure.
2. Expected result: The phase remains `verifier-running`.
3. Example: The tool saves `handoffs/verifier/V2.json`, then fails before replacing `workflow.json` with phase `candidate-ready`. After the failed operation, `workflow.json.phase` is still `verifier-running`.

### AC9: Partial-save failures preserve the saved artifact for owner inspection

1. Probe: Save a verifier handoff, then make the workflow phase save fail. Read the handoff after the failed operation.
2. Expected result: The saved handoff remains available without automatic rollback.
3. Example: `handoffs/verifier/V2.json` is saved with summary `Checked greeting` before the phase save fails. After the failed operation, `V2.json` still exists with summary `Checked greeting`.

### AC10: Schema versions remain 1.0.0

1. Probe: Create a workflow, record an escalation, and complete builder and verifier handoffs. Inspect the version in each saved artifact.
2. Expected result: Each artifact contains `version: "1.0.0"`.
3. Example: Create `20261007-120000-add-greeting` and produce `E1.json`, `B1.json`, and `V1.json`. Its `workflow.json` and all three agent artifacts contain `version: "1.0.0"`.

### AC11: Maestro requests the explicit approval message after spec review

1. Probe: Finish the spec review and observe Maestro's request for owner approval.
2. Expected result: Maestro asks the owner to inspect the spec and reply `GREEN FLAG` to approve it and start the builder.
3. Example: The active spec is `20261007-120000-add-greeting` in `drafting-spec`. After review, Maestro requests inspection of its `spec.md` and the owner reply `GREEN FLAG`.

### AC12: A general acknowledgment does not approve the spec

1. Probe: Read the approval instructions for a response that acknowledges the spec but does not contain the required approval message.
2. Expected result: The instructions do not authorize approval or builder launch from that response.
3. Example: Maestro requests `GREEN FLAG` for the greeting spec. The owner replies `ok`. The instructions require Maestro to wait for `GREEN FLAG`, not mark the spec ready or launch the builder.

### AC13: The approval instructions prohibit edits to the frozen spec during agent execution

1. Probe: Read the editing permissions after GREEN FLAG approval and builder launch.
2. Expected result: The instructions prohibit changing the approved spec during builder or verifier execution.
3. Example: The owner approves a greeting spec that requires `hello.txt` to contain `hello\n`. While its builder runs, the instructions do not permit changing that requirement to `welcome\n`.

### AC14: A later verifier execution preserves earlier requests for code fixes

1. Probe: Record an owner request to fix a current verifier finding. Complete the requested builder fix and the next verifier execution. Read the earlier verifier record.
2. Expected result: The earlier record still explicitly contains the owner's `fix-code` decision for that finding.
3. Example: `handoffs/verifier/V1.json` reports `F1`. The owner chooses `fix-code` for `F1`. After the builder fix and creation of `handoffs/verifier/V2.json`, `V1.json` still explicitly records `fix-code` for `F1`.
