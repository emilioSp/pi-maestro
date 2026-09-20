STATUS: TODO

# Task 19: Implement state discovery and reconciliation

## Dependency

This task depends on Task 18: Implement workflow transitions.

## Objective

Find the authoritative workflow state and compare it with Git, worktrees, and artifacts.

## Plan references

- Sections [2.11](../plan.md#plan-section-2-11) and [5](../plan.md#plan-section-5), `src/workflow/state/discover.ts` and `src/workflow/state/reconcile.ts`
- Sections [6.14](../plan.md#plan-section-6-14), [6.17](../plan.md#plan-section-6-17), [6.18](../plan.md#plan-section-6-18), [6.20](../plan.md#plan-section-6-20), and [6.22](../plan.md#plan-section-6-22)

## Work

1. Discover all valid `workflow.json` files under the configured spec directory and workflow branches.
2. Treat every `final-review` workflow as concluded and exclude it from active workflows; report any associated managed branch or worktree as an inconsistency.
3. Select the highest revision.
4. Block equal maximum revisions that disagree.
5. Reconcile phase, branch, worktree, commit ancestry, handoff, escalation, observations, and active subagent facts.
6. Detect interrupted passes, dirty worktrees, collisions, foreign resources, and unreadable state.
7. Return structured findings without repairing anything.

## Implementation

Treat repository files and Git as authoritative. Session data is only a hint. A `builder-running` or `verifier-running` phase with no active process and no terminal handoff is interrupted. Do not relaunch, reset, clean, or delete.

## Tests

Add Vitest integration tests for no workflow, one active workflow, archived workflows, highest revision selection, conflicting maxima, missing artifacts, wrong branch association, broken ancestry, active process, interrupted clean pass, interrupted dirty pass, and foreign worktrees.

## Completion criteria

- Recovery gets one clear authoritative result or a blocking conflict.
- Reconciliation is read-only.
- No inconsistent workflow is silently accepted.
