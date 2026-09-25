STATUS: OBSOLETE

# Task 25: Implement workflow recovery

## Decision

This task is obsolete for the MVP. Maestro does not recover a workflow from persisted state after restart or deactivation.

An incomplete workflow remains in the repository. A new Maestro session starts without an active spec and the owner may start a new workflow.

Runtime validation still belongs to the individual workflow operations. They reject invalid phases, branches, worktrees, revisions, and artifacts when the current session invokes them.
