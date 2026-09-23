STATUS: TODO

# Task 24: Implement the findings workflow

## Dependency

This task depends on Task 23: Implement the verifier workflow.

## Objective

Apply one explicit owner decision to every current finding.

## Plan references

- Section [3.6](../plan.md#plan-section-3-6)
- Section [5](../plan.md#plan-section-5), `src/workflow/findings/resolveFindings.ts`
- Sections [6.10](../plan.md#plan-section-6-10), [6.14](../plan.md#plan-section-6-14), and [6.25](../plan.md#plan-section-6-25)

## Work

1. Accept exactly one decision for every current finding.
2. Support `reject` and `fix-code` only.
3. Require a non-empty owner reason for every rejection.
4. Apply rejections once in the current verifier handoff.
5. If any decision is `fix-code`, fast-forward findings to the builder branch and commit `ready-for-builder`.
6. If every decision is `reject`, commit `candidate-ready`.
7. Never infer a decision from finding text.
8. Do not resolve findings through this workflow when the approved contract must change.

## Implementation

In mixed decisions, rejected findings receive their rejection while valid findings remain unrejected for the next builder. A later verifier starts from fresh evidence. A contract change requires manual abandonment and a new spec.

Put `resolveFindings` in its own module under `src/workflow/findings/`, with tests beside it. Give any other new public operation its own module. Keep private helpers with their owner, and import modules directly without a barrel. Remove the unused `src/workflow/findings.ts` placeholder. Do not add a second implementation.

## Tests

Add table-driven Vitest integration tests for all-reject, one mixed fix-code outcome, missing or duplicate finding decisions, unknown finding IDs, empty rejection reasons, fast-forward failure, and no partial mutation.

## Completion criteria

- Every current finding is handled exactly once per resolution call.
- Any `fix-code` decision takes precedence over all-reject.
- Code corrections never rewrite the spec.
