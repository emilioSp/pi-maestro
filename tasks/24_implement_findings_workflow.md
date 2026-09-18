STATUS: TODO

# Task 24: Implement the findings workflow

## Dependency

This task depends on Task 23: Implement the verifier workflow.

## Objective

Apply one explicit owner decision to every current finding.

## Plan references

- Section [3.6](../plan.md#plan-section-3-6)
- Section [5](../plan.md#plan-section-5), `src/workflow/findings.ts`
- Sections [6.10](../plan.md#plan-section-6-10), [6.14](../plan.md#plan-section-6-14), and [6.25](../plan.md#plan-section-6-25)

## Work

1. Accept exactly one decision for every current finding.
2. Support `reject`, `fix-code`, and `revise-spec` only.
3. Require a non-empty owner reason for every rejection.
4. Apply rejections once in the current verifier handoff.
5. If any decision is `revise-spec`, use the spec-reset workflow.
6. Otherwise, if any decision is `fix-code`, fast-forward findings to the builder branch and commit `ready-for-builder`.
7. If every decision is `reject`, commit `candidate-ready`.
8. Require `expectedRevision` and never infer a decision from finding text.

## Implementation

In mixed fix-code decisions, rejected findings receive their rejection while valid findings remain unrejected for the next builder. A later verifier starts from fresh evidence.

## Tests

Add table-driven Vitest integration tests for all-reject, all-fix, all-revise, each mixed combination, precedence of revise-spec, missing or duplicate finding decisions, unknown finding IDs, empty rejection reasons, stale revisions, fast-forward failure, and no partial mutation.

## Completion criteria

- Every current finding is handled exactly once per resolution call.
- Decision precedence matches the plan.
- Code corrections never rewrite the spec.
