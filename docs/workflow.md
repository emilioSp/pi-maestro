# Workflow

Maestro manages one spec-driven development workflow in the current session.

The approved `spec.md` is the contract between the owner, Maestro, the builder, and the verifier. 

It defines the intended behavior, constraints, technical decisions, and acceptance criteria. 

The owner works directly with Maestro. 

Maestro, using the current Git branch, prepares the spec, updates workflow state, starts the builder and verifier, and records owner decisions.

Builder and verifier runs are foreground operations, and communicate with Maestro through repository handoffs. 

Pi waits for each run before the owner continues. Maestro's Pi status shows the current phase, and pi-subagents FleetView shows the live activity and transcript.

## Roles

### Owner

The owner is the human in the loop: every decision that needs human judgment returns to the owner.

The owner has final authority over:

- Requirements
- Scope
- Technical decisions recorded in the spec
- Escalation answers
- Finding decisions
- Spec approval
- Git flow after the candidate is ready
- Final Pull Request and merge

### Maestro

- Discusses the change with the owner
- Writes and reviews the spec with the owner
- Creates workflow artifacts on the current branch
- Starts the builder and verifier
- Reads their handoffs
- Presents escalations and findings to the owner
- Records explicit owner decisions
- Summarizes the results and facts for a Pull Request when the candidate is ready

### Builder

The builder works on the current branch with a fresh context. 

It reads the active spec, implements the approved change, and runs every acceptance criterion.

The builder checks every criterion. For the criteria the owner selects in the spec, it also introduces a temporary fault to prove that the check detects it.

The builder ends a run with one of these outcomes:

- `done`
- `failed`
- An `escalation`

### Verifier

The verifier works on the current branch with a fresh context. 

It reads the active spec and available artifacts. Historical artifacts provide context, not proof.

Before the verifier starts, Maestro commits a `verifier-running` checkpoint. That checkpoint is the candidate commit.

The verifier does not repair product code. It independently checks every criterion and repeats the fault checks the owner selected in the spec. It restores all temporary changes before reporting its results.

## Main flow

Happy path is highlighted in green.

```mermaid
flowchart TD
    spec[Owner and Maestro write one spec]
    ready[Maestro marks the spec ready]
    approval[Owner commits spec and workflow state on the current branch]
    build[Builder works on the current branch]
    buildOutcome{How does the builder run end?}

    spec --> ready
    ready --> approval
    approval --> build
    build --> buildOutcome

    buildOutcome -->|Escalation| escalation[Builder records an escalation and stops]
    escalation --> ownerAnswer[Owner decides]
    ownerAnswer --> escalationOutcome{Does the spec change?}
    escalationOutcome -->|No| recordContinue[Maestro records the resolution]
    recordContinue --> build
    escalationOutcome -->|Yes| reviseSpec[Owner revises and approves spec.md]
    reviseSpec --> approval

    buildOutcome -->|Failed| builderFailed[Maestro reports the error and stops]
    builderFailed --> abandoned[Owner handles the failed workflow manually]

    buildOutcome -->|Done| verify[Verifier regenerates every proof]
    verify --> findings{Findings?}

    findings -->|None| candidate[Candidate ready]
    findings -->|One or more| ownerFindings[Owner reviews every finding]

    ownerFindings -->|Reject all with reasons| candidate
    ownerFindings -->|Code must change| returnBuilder[Maestro records the decision]
    returnBuilder --> build
    ownerFindings -->|Spec must change| reviseSpec

    candidate --> summary[Maestro summarizes results and Pull Request facts]
    summary --> ownerReview[Owner reviews the candidate]
    ownerReview -->|Changes needed| adjust[Owner changes code, spec, or acceptance criteria]
    adjust --> ownerReview
    ownerReview -->|Satisfied| pullRequest[Owner opens a Pull Request]
    pullRequest --> merge[Owner merges the Pull Request]

    linkStyle 0,1,2,3,13,14,15,21,22,23,24,25,26 stroke:#2e7d32,stroke-width:3px
```

## Workflow phases

Each spec has a `workflow.json` file that records its progress. Maestro creates and updates this file. It stores the current phase, which tells you where the work stands. For example, `ready-for-verifier` means that the builder completed the work and the verifier can start.

Maestro stores this file at `.specs/<spec-id>/workflow.json`.

| Phase | Meaning |
|---|---|
| `drafting-spec` | Owner and Maestro are preparing the initial spec |
| `ready-for-builder` | The owner approved the spec and it awaits a builder run |
| `builder-running` | A builder run is active |
| `escalation-decision` | The owner must decide how to resolve the active escalation |
| `builder-failed` | The builder ended the run with a failure |
| `ready-for-verifier` | Builder work is ready for independent verification |
| `verifier-running` | A verifier run is active |
| `findings-decision` | The owner must decide how to handle verifier findings |
| `candidate-ready` | The candidate commit passed verification or all findings were rejected with reasons. This is the last persisted Maestro phase |

Disabling Maestro, restarting Pi, or using `/resume` clears live session state. Maestro does not resume an incomplete workflow, the owner must clean it up manually.

## Spec approval

For the initial spec:

1. Maestro creates `spec.md` and `workflow.json` in `drafting-spec`.
2. The owner reviews and approves the spec.
3. `maestro_mark_spec_ready` changes the phase to `ready-for-builder`.
4. The owner commits `spec.md`, its prototypes, and `workflow.json` on the current branch.

During `drafting-spec`, Maestro can use any available tool to edit the active `spec.md` with the owner. Maestro can also create and update visual prototypes in that spec's `prototypes/` directory with any available tool. During `escalation-decision` or `findings-decision`, the same permission applies to owner-directed contract revisions of the spec and its prototypes. This permission does not apply to other workflow artifacts or product files. Maestro cannot edit the spec or its prototypes in other phases.

The committed `spec.md` represents the approved contract for the builder and verifier. Agents must not change the spec or its prototypes during a builder or verifier pass.

During spec preparation, Maestro can run tests and checks to understand the repository. This also applies when you request a spec revision in `escalation-decision` or `findings-decision`, but not in other phases.

Checks that leave product files and workflow artifacts unchanged do not need your approval as experiments. Maestro removes any temporary files they create and preserves your existing files.

If answering a specification question requires temporary product changes, Maestro first agrees on the question and scope with you. Commands with automatic fixes also require this agreement, even if they ultimately change no files. These experiments help clarify the spec. They do not implement the feature or replace the builder and verifier.

Maestro must preserve all pre-existing changes, including uncommitted and untracked files. Before requesting spec approval or resuming the workflow, Maestro must restore only its experiment changes and remove temporary files. If cleanup fails, Maestro reports the remaining changes and stops. Experiments cannot create commits or change `workflow.json`, handoffs, or other protected workflow artifacts. Installing packages or adding or updating dependencies requires explicit owner approval. After cleanup, Maestro records only conclusions and limits that affect the contract in `spec.md`.

## Acceptance criterion simplicity principle

Each acceptance criterion describes one observable result.

```text
Probe
  How the behavior is verified.

Expected result
  What the probe must observe.

Breakage
  How to prove that the probe detects a broken behavior.
```

Breakage checks are not required by default.
The owner selects a breakage check during spec preparation when a proof, that the test detects a specific error, is needed.

## Escalations

An escalation is the way Maestro brings a significant implementation discovery to the owner's attention and asks for a decision. It is not necessarily a technical failure, an error, or a blocker.

An escalation is relevant when the work presents meaningful alternatives with different consequences. 

Examples:
- conflict between the approved spec and the repository.
- behavior that the spec does not define.
- a material architectural alternative.
- a possible scope change.
- a decision that affects verification or reversibility.

Each escalation presents a question, context and evidence, available options, consequences, next steps, and an optional recommendation. 

While an escalation is unresolved, the workflow is paused in `escalation-decision` and the owner must decide how to proceed.

The owner can choose one of two paths:

- Continue with the current spec. Maestro records the decision and returns the workflow to `ready-for-builder` for another builder run.
- Change the approved spec. The owner revises and approves the spec, then the workflow returns to `ready-for-builder`.

Each escalation remains in the workflow history as references.

## Findings

A finding records a technical issue found by the verifier. Every finding blocks progress until the owner makes a decision.

| Decision | Result |
|---|---|
| `reject` | Requires and records the owner’s reason. When every finding is rejected, the candidate becomes ready. |
| `fix-code` | Keeps the current spec and returns the workflow to `ready-for-builder`. |
| Spec must change | The owner revises the spec from `findings-decision`; previous findings become historical. |

When decisions are mixed between `reject` and `fix-code`, any `fix-code` decision returns the workflow to `ready-for-builder`.

If a finding requires a spec change, thw owner must approve a revised spec and run the builder again.

## Spec revision

A spec revision is allowed only from these blocked phases:

- `escalation-decision`
- `findings-decision`

The owner edits and approves the spec, then Maestro calls `maestro_mark_spec_ready` to change the phase to `ready-for-builder`. The owner must commit the revised `spec.md`, its prototypes, and `workflow.json` before Maestro starts the builder again. The checkout must be clean.

The previous escalation or finding becomes inactive. Its artifact remains in the branch as historical context. Builder and verifier decide whether historical artifacts apply to the current spec.

## Workflow completion

The workflow ends at `candidate-ready` after a verifier run with no findings, or after the owner rejects every finding with a reason.

Maestro reads the artifacts and Git information to summarize the changes, verification results, rejected findings and reasons, and applicable builder notes.

## Stored artifacts

When the owner creates a spec, Maestro creates the spec directory with `spec.md` and `workflow.json`. It also creates the empty `handoffs/escalations/` and `prototypes/` directories. Later workflow actions create the artifact files.

The default spec directory contains:

```text
.specs/<spec-id>/
├── spec.md
├── workflow.json
├── handoffs/
│   ├── builder.json
│   ├── verifier.json
│   └── escalations/
│       ├── E1.json
│       └── ...
└── prototypes/
```

- `builder.json` and `verifier.json` represent the current handoffs and can be overwritten by later runs. 
- Builder handoff `notes` contain evidence for selected fault checks and significant discoveries that did not require an owner decision. Maestro summarizes the relevant results at the end.
- Earlier versions of all artifacts remain in Git commits.
