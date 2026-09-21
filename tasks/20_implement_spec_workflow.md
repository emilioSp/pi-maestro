STATUS: TODO

# Task 20: Implement the spec workflow

## Dependency

This task depends on Task 19: Implement state discovery and reconciliation.

## Objective

Coordinate spec creation, readiness, and the exceptional spec-reset path.

## Plan references

- Sections [3.2](../plan.md#plan-section-3-2) and [5](../plan.md#plan-section-5), `src/workflow/spec.ts`
- Sections [6.10](../plan.md#plan-section-6-10), [6.14](../plan.md#plan-section-6-14), [6.18](../plan.md#plan-section-6-18), [6.21](../plan.md#plan-section-6-21), [6.22](../plan.md#plan-section-6-22), and [6.23](../plan.md#plan-section-6-23)

## Work

1. Coordinate new spec creation after active-workflow checks.
2. Mark a structurally valid drafting spec as `ready-for-builder` on the base branch without committing it.
3. Require the owner commit and a clean base before the first builder launch can proceed.
4. Implement reset to the same spec ID after an explicit owner decision.
5. Preserve observations and all escalations, including the triggering resolution.
6. Exclude old product code, builder handoff, verifier handoff, and findings from the reset.
7. Keep revision monotonic and return to `drafting-spec` on the base branch.
8. Delete old verified workflow resources only after the owner commits the new ready spec.

## Implementation

The in-place spec reset remains part of the MVP. Do not replace it with manual abandonment or a new spec ID. Run all safety checks before mutation. The reset must stop on dirty, ambiguous, or foreign resources. Do not create an archive copy of the old spec; Git history is the archive.

## Tests

Add Vitest integration tests for create, ready validation, uncommitted ready state, clean approval commit, reset from escalation, reset from findings, preserved history, excluded current handoffs, blocked dirty reset, blocked foreign resource, and cleanup only after the new approval commit.

## Completion criteria

- Normal readiness and exceptional reset follow different explicit paths.
- No reset loses durable history.
- Maestro never creates the owner approval commit.
