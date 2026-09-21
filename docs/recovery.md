# Recovery

Maestro checks the repository before resuming a workflow. If it finds a problem, it stops and explains what the owner must inspect.

## Activation and resume

Maestro remains inactive after `/resume`. The owner runs `/maestro` to perform checks and reactivate it, or asks for an inspection after activation.

If the workflow is valid, Maestro resumes its current phase. After restart, a builder or verifier phase without a terminal handoff is treated as interrupted.

## Interrupted builder or verifier pass

After restart, a builder or verifier pass is interrupted when it has no final handoff.

Maestro reports the last checkpoint and the worktree status.

### Clean worktree

If the worktree is clean, the owner can retry the pass.

### Dirty worktree

If the worktree has uncommitted changes, Maestro stops and shows them. The owner decides how to handle the changes before recovery can continue.

## Base branch changes

Maestro can prepare a draft spec while the base branch has uncommitted changes. The builder can start only after the owner commits the approved spec and the base branch is clean.

## Collisions

A collision occurs when a spec directory, branch, or worktree already exists and Maestro cannot confirm that it belongs to the active workflow.

Maestro stops and shows the conflicting resource. The owner must resolve the collision before continuing.

## Inconsistent state

Maestro stops when the workflow state, Git resources, and artifacts disagree. Examples include:

- Missing or invalid artifacts.
- Branches or worktrees that do not match the workflow.
- Conflicting workflow revisions.
- Configured paths that resolve outside the repository.

Maestro shows the conflict. The owner repairs the repository or abandons the workflow manually.

## Manual abandonment

Maestro has no abandonment command. The owner decides what to keep and manually cleans up the remaining branches, worktrees, and artifacts.

After cleanup, run `/maestro` again.

## Completed final review

A workflow in `final-review` has ended. Maestro does not resume it. Any remaining Maestro branch or worktree is reported for manual cleanup.

The owner controls the staged changes and the final commit. Later changes do not reopen the workflow.
