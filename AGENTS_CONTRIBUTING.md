# Agent workflow

This file controls agents that use the workflow in `.specs/`. Follow it exactly.
[CONTRIBUTING.md](CONTRIBUTING.md) explains the same workflow to human readers. It defines nothing.

## Non negotiable rules

1. A builder does not verify its own work. An independent verifier regenerates every claim.
2. Builders and verifiers run as the subagents defined in `.pi/agents/`. Their model is set there, not in the prompt.
3. A probe must touch the claimed result and must fail when its `breakage` is applied.
4. When a requirement is ambiguous, stop and hand the decision to the owner. Do not guess.
5. The repository is the only persistent state. Write important outcomes to `.specs/<id>/handoffs/` before ending a pass.

## Authority and communication

```text
Owner <-> Maestro <-> Builder or verifier
```

- The owner gives work and decisions only to the maestro.
- The maestro launches, monitors, and directs builders and verifiers.
- Builders and verifiers do not ask the owner for direction. They record the blocker and stop.
- The owner receives status only from the maestro. A missing builder report is not a builder status.
- The owner commits the initial spec folder before a builder starts.
- Builders and verifiers commit their changes and terminal handoffs in their assigned worktrees.
- The maestro commits every resolved escalation and every rejected finding.
- The owner makes the final commit.

## Files

| Path                          | Holds                                                |
| ----------------------------- | ---------------------------------------------------- |
| `.specs/<id>/`                | Everything for one spec, and nothing else            |
| `.specs/<id>/spec.md`         | The work order for one reversible change             |
| `.specs/<id>/observations.md` | The observations the builder records during a pass   |
| `.specs/<id>/handoffs/`       | Builder and verifier handoffs, and escalations       |
| `.specs/<id>/prototypes/`     | The standalone HTML prototypes, when a spec has them |

## Scope

- Work in the assigned worktree only.
- Change only the paths listed in the spec. Do not widen the list.
- Every spec must list `.specs/<id>/**` in its allowed paths, with its own id. This authorises its spec, its handoffs, and its prototypes.
- Never delete branches, worktrees, or files that you did not create.

## Read before you work

- Read the assigned spec at the start of every pass.
- IMPORTANT: before working in a workspace, read the applicable `AGENTS.md` for that workspace.

## Specs

The owner and maestro create specs from their discussion. A spec must contain:

- Problem
- Constraints
- Allowed paths
- A Prototype section with `.specs/<id>/prototypes/`, when the spec introduces a visual surface that has no existing reference
- Acceptance criteria
- Out of scope work

A spec may also carry a Technical details section with the agreed approach.

Each acceptance criterion must use this form:

```text
AC<n>: <claim>
probe: <exact command>
postcondition: <observable state>
breakage: <specific change that makes the probe fail>
```

Do not edit a spec's acceptance criteria, constraints, allowed paths, or out of scope section.
Maestro: do not launch a subagent if any of them is wrong, incomplete, or impossible.
Builder: open an escalation if any of them is wrong, incomplete, or impossible.
Verifier: record a finding.

Probes must observe the real effect.

The postcondition names what the probe must look at. The probe must look at the real
thing. The probe may fake anything the postcondition does not name.

Do not accept a probe that looks at a mock, a spy, a write response, an exit code, a
log line, or a filename in place of the real thing.

### Visual claims

A spec that claims something about what the user sees must make that claim verifiable. There are two routes. The spec uses one of them.

- A prototype. Required when the spec introduces a visual surface that has no existing reference, a new component or a new screen. Recommended in every other case. It goes in the Prototype section, at `.specs/<id>/prototypes/`.
- An acceptance criterion with a programmatic probe. Use it when the spec changes a visual surface that already exists. The current app is the reference. State the visual property that must hold, for example that the page does not scroll horizontally at the smallest target resolution.

Never leave a visual claim without one of the two.

When the spec has one or more prototypes:

- A spec may have more than one prototype file. Name each file for the surface it shows.
- It is the owner's responsibility to create them during spec preparation, either with the maestro or with another agent.
- They must be present before the maestro starts the builder.
- A prototype is accurate only in the part related to the spec. It can be inaccurate in every other part, a different logo or a different footer for example. That does not matter.
- The prototypes are the visual reference. Use the target resolutions in the applicable workspace `AGENTS.md`. The spec specifies a viewport only when it requires a non-standard size.
- For a screenshot probe, render each prototype and the actual app at every target resolution, in the state shown or required by the spec. Inspect both screenshots and compare the visual result.
- Do not assess the source code of a prototype.

When the spec has no prototype, do no screenshot comparison. A visual claim is then stated as an acceptance criterion, and you verify it like every other one.

## Handoffs

A handoff is a file in `.specs/<id>/handoffs/`. It is the subagent report. The closing message of a subagent is not.

| File                  | Written by | Meaning                                                 | Format                                              |
| --------------------- | ---------- | ------------------------------------------------------- | --------------------------------------------------- |
| `builder.json`        | Builder    | One implementation pass, `done` or `failed`             | [builder.json](templates/builder.json)       |
| `escalation.<n>.json` | Builder    | A decision delegated to the owner, and later its answer | [escalation.json](templates/escalation.json) |
| `verifier.json`       | Verifier   | The findings of one verifier pass                       | [verifier.json](templates/verifier.json)     |

These rules apply to every handoff:

- A pass ends with exactly one terminal handoff.
  - A builder writes `builder.json` or an escalation.
  - A verifier writes `verifier.json`.
- A builder pass overwrites `builder.json`, a verifier pass overwrites `verifier.json`. Earlier versions stay in Git history.
- Escalations are never overwritten.
- A verifier writes `[]` when it has no findings. It never leaves a previous handoff in place and never issues a verdict.
- The agent commits its terminal handoff in its assigned worktree before it ends the pass.

### Builder handoffs

A builder handoff records one implementation pass. The builder writes it at the end of the pass, with its status and the result of every probe.

`done` means the builder completed an implementation pass that is ready for independent verification.

A builder uses `done` only when all these conditions are true:

- It changed only allowed paths.
- It recorded observations for every acceptance criterion.
- Every stated breakage made its probe fail.
- After each restore, the probe succeeded again.
- No owner decision is required.

`failed` means the builder cannot produce a verifiable candidate with the current spec, constraints, and environment. It is a technical execution result, not a request for a product, scope, or requirement decision.

A failed builder handoff must record each incomplete acceptance criterion, the commands and observed output, the precise technical reason, and any partial changes. The `acs` entries must state the observed `red_ok` and `green_ok` values.

On a failed builder handoff, report the status to the maestro and stop. The owner and the maestro triage the failure and decide what to do.

Examples of `failed`:

- A required external service is unavailable.
- A required tool does not work in the assigned environment.
- A probe remains unsuccessful after corrections that stay within the spec constraints.

In short: `done` is ready for verification, `failed` is not technically completable.

Builder handoff format is [builder.json](templates/builder.json).

### Escalations

An escalation is a question about the spec, delegated to the owner. Only a builder opens one, when it cannot finish the pass without an answer. Write the escalation, commit it, and end the pass. Do not wait in process. A dirty launch base is not an escalation.

Examples of an escalation:

- The spec does not define the required behaviour.
- A correction requires a path outside the allowed paths.
- More than one valid solution exists and the owner must choose one.
- The spec cannot be verified as written.

Escalations are numbered and permanent: `.specs/<id>/handoffs/escalation.<n>.json`, where `<n>` is the next free number for the spec. Never overwrite an escalation, never rename it, never delete it. Read in order, the escalations of a spec explain why it went the way it went.

An active escalation has `"resolution": null`. A resolved escalation has `"resolution"` filled.
Only the maestro writes a resolution, and only after the owner has decided. Fill `resolution` with the decision and the reason, in the escalation file itself, and commit it in the worktree that holds the escalation.

Escalation format is [escalation.json](templates/escalation.json).

### Verifier handoffs

A verifier handoff records one verifier pass. The verifier writes it as a list of findings, and writes `[]` when it found nothing.

A finding is a technical observation about one acceptance criterion or one spec constraint. It is never a question. It stops the workflow on its own.

- `verifier.json` is `[]`: the workflow continues.
- `verifier.json` has one or more findings: the workflow stops and the owner gets the ball.

Every finding carries `rejection`. The verifier always writes it as `null`. Only the maestro fills it, with `{ "reason": "..." }`, after the owner rejects that finding.
A rejection belongs to the verifier handoff that carried it. A later verifier pass regenerates everything from scratch and can raise the same finding again.

Verifier handoff format is [verifier.json](templates/verifier.json).

## Maestro

- Do not edit product code, except for a non-functional chore explicitly requested by the owner during the final human review.
- Do not invent work. Create a spec only from the current owner discussion.
- Create one spec for one reversible change. A change to the data model and a change to behaviour belong to two specs, so each one can be rolled back on its own.
- Define direct, falsifiable probes before creating a spec.
- When a spec changes what the user sees and has no prototype, cover the visual claim with an acceptance criterion that has a programmatic probe. Do not create the spec without it.
- When a decision belongs to the owner, report it and wait. Never decide in place of the owner.
- Launch and supervise every builder and verifier. Report only observed process state and recorded handoffs to the owner.
- On dirty or uncommitted launch base, tell the owner to commit the intended spec folder, which holds the spec and any prototype, or to remove the unwanted changes. Wait for a clean base before you launch an agent.

### Launch an agent

Before creating a worktree or launching a builder or verifier, confirm that the native hook is active:

```sh
test "$(git config --get core.hooksPath)" = .githooks && test -x .githooks/pre-commit
```

If this fails, report `git config core.hooksPath .githooks` to the owner and stop. Do not create the worktree or launch the agent.

Every agent runs in its own branch and worktree, and starts from committed state. Uncommitted files are not copied.

Call the `subagent` tool with `cwd` set to the absolute worktree path and `isolation: "none"`.

Do not set the `output` or `outputMode` parameters for a builder or verifier. They make an external artifact authoritative and can prevent the required repository handoff from being written. A committed file in `.specs/<id>/handoffs/` is the only terminal handoff.

The call blocks until the child ends, so its completion is a first class result instead of a string parsed from terminal output.

Every spawn instruction states the spec id, the absolute path of the assigned worktree, which is the agent's root, and that the agent must read `AGENTS.md`, `AGENTS_CONTRIBUTING.md`, and `.specs/<id>/spec.md` at the start of every pass.

Everything else is already in `.pi/agents/`. Do not restate the role in the prompt and do not weaken it.

### Launch a builder

Check that the base is clean, then create the worktree from `HEAD`:

```sh
git worktree add -b builder/<id> .worktree/<id> HEAD
```

Install the dependencies in it.

```sh
npm --prefix <worktree path> ci --prefer-offline --no-audit
```

If the install fails, report it to the owner and do not spawn.

Only the first pass of a spec creates the worktree. A repair pass and a resumed pass run in `.worktree/<id>` as it is: create nothing, install nothing.

Spawn `agent: "builder"`.

The instruction adds one read to the standard list when the pass is not the first:

- A repair pass reads `.specs/<id>/handoffs/verifier.json` after the spec.
- A pass resumed after an escalation reads the resolved escalation named in the instruction, after the spec.

### Launch a verifier

Create one branch and one dedicated clean worktree for each verifier pass, at the current `builder/<id>` commit:

```sh
git worktree add -b verifier/<id>/<n> .worktree/<id>-verifier-<n> builder/<id>
```

`<n>` is a new verifier sequence number.

Install the dependencies in it.

```sh
npm --prefix <worktree path> ci --prefer-offline --no-audit
```

If the install fails, report it to the owner and do not spawn.

Spawn `agent: "verifier"`.

### Supervise an agent

- Wait on the subagent. The runtime reports its completion. There is no exit file, no process check, and no polling loop.
- The agent is `running` until the runtime returns it. A quiet subagent, a long pause, or no intermediate message all mean `running with no new observation`. None of them means `dead`. Never report a running agent as terminated.
- Do not spawn a second agent to ask about the first one.
- When the subagent returns, inspect its worktree for the terminal handoff of the current pass.
- Confirm that the worktree is clean and that the handoff is committed.
- If the subagent returns without a terminal handoff for the current pass, report the exception to the owner and stop. Do not change the repository or relaunch automatically.
- The terminal handoff decides the next step. See [After a builder pass](#after-a-builder-pass) and [After a verifier pass](#after-a-verifier-pass).

### After a builder pass

- `done`: launch a verifier on that commit.
- `failed`: report the failure to the owner and stop. Do not relaunch the builder.
- An escalation: report it to the owner. After the decision, resolve the escalation on `builder/<id>`, then launch a resumed builder pass in the same worktree. Do not launch a verifier until that pass ends with a committed `done`.

### After a verifier pass

- `verifier.json` is `[]`: that verifier commit is the candidate commit and the technical spec is complete.
- `verifier.json` has findings: the workflow stops. Report every finding to the owner. Merge nothing, repair nothing.

Findings are observations, not a question. The owner reads them and makes one of three decisions. Follow it.

- **The finding is not valid.** Write `rejection` with the reason into that finding, in the `verifier.json` that carries it, and commit it on the verifier branch. That commit is the candidate commit and the technical spec is complete.
- **The code is wrong and the spec is right.** Bring the findings to the builder branch.
  ```sh
  git -C .worktree/<id> merge --ff-only verifier/<id>/<n>
  ```

  Then run the pipeline again.
- **The spec is wrong.** Stop. The owner rewrites the spec and commits it. The work starts again from a new builder branch on the new base commit.

### The candidate commit

The candidate commit is the technical approval stamp. It is the last verifier commit whose `verifier.json` is `[]`, or whose every finding carries a `rejection` reason.

### Final owner review

Declare the technical spec completed when a candidate commit exists. On the base branch, run `git merge --squash <candidate-commit>`. Do not commit the merge result. The candidate product changes must remain staged for the owner. Keep every worktree until the owner makes the final commit.

The owner reviews code quality on the base branch. If satisfied, the owner commits and pushes the candidate change. The owner then confirms that commit to the maestro.

Only after that confirmation, the maestro removes every builder and verifier worktree created for the spec, then deletes their branches.

If the owner requests a non-functional chore, the maestro applies it directly on the base branch. It must not change acceptance criteria, probes, breakages, tests, or functional behaviour. It runs the complete existing test suite for each affected workspace as a regression check, stages the chore changes, then returns the staged change to the owner for another final review. These tests are not a replacement for independent acceptance verification.

## Builder

The builder role is defined in [builder.md](.pi/agents/builder.md). A builder follows the shared rules in this file and the role instructions in that definition.

## Verifier

The verifier role is defined in [verifier.md](.pi/agents/verifier.md). A verifier follows the shared rules in this file and the role instructions in that definition. Verifiers are independent in how they generate their observations and in code ownership, but informed by the builder handoff and the earlier verifier handoffs for the current spec.

## Helpers

Use these scripts to write standard files.

```sh
.specs/scripts/new-spec.js <slug>        # makes the id and the spec folder
.specs/scripts/open-escalation.js <id>   # numbers the escalation for you
.specs/scripts/record-builder.js <id>
.specs/scripts/record-verifier.js <id>
```
