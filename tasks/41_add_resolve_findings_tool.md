STATUS: TODO

# Task 41: Add the resolve-findings tool

## Dependency

This task depends on Task 40: Add the launch-verifier tool.

## Objective

Let the owner decide what to do with every current verifier finding on the current branch.

## Plan references

- Section [3.6](../plan.md#plan-section-3-6)
- Section [5](../plan.md#plan-section-5), `src/tools/main/resolve-findings.ts`
- Sections [6.10](../plan.md#plan-section-6-10), [6.14](../plan.md#plan-section-6-14), and [6.25](../plan.md#plan-section-6-25)

## Work

1. Define input with `specId` and one decision for each current finding.
2. Use `StringEnum` for `reject` and `fix-code`.
3. Require a reason only when the owner rejects a finding.
4. Check that the input covers every current finding exactly before changing anything.
5. Call the findings workflow on the current checkout. Do not accept a verifier pass number or worktree path.
6. If any decision is `fix-code`, return the workflow to `ready-for-builder` and commit the decision on the current branch.
7. If every finding is rejected, commit `candidate-ready` on the current branch.
8. Report which rejections were recorded and which findings still need action.
9. If the owner wants to change the approved contract, do not resolve the findings. The owner edits the spec and calls `maestro_mark_spec_ready` directly from `findings-decision`; the old findings remain historical.
10. Do not guess the owner's decisions or launch another agent automatically.

## Implementation

Keep the Pi adapter thin. If any decision is `fix-code`, it takes priority over `reject` decisions. Keep the current `verifier.json`; Git preserves earlier versions. Builder and verifier decide whether historical artifacts still apply to the active spec.

## Tests

Add Vitest adapter and integration tests for:

- the input schema;
- decision mapping;
- exact coverage of current findings;
- mixed `reject` and `fix-code` decisions;
- current-branch checkpoint commits;
- the candidate-ready path;
- the spec-revision path without finding decisions;
- one domain error returned to the tool caller.

## Completion criteria

- One valid call handles every current finding exactly once.
- Mixed `reject` and `fix-code` decisions follow the approved priority.
- The tool changes only the allowed rejection fields in findings.
- No branch merge, fast-forward, verifier pass, or worktree operation remains.
