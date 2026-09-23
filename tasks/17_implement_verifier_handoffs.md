STATUS: DONE

# Task 17: Implement verifier handoffs

## Dependency

This task depends on Task 16: Implement escalation artifacts.

## Objective

Validate verifier evidence and current findings without allowing a verdict.

## Plan references

- Sections [3.4](../plan.md#plan-section-3-4) and [3.6](../plan.md#plan-section-3-6)
- Section [5](../plan.md#plan-section-5), `src/artifacts/verifier-handoff/`
- Section [6.15](../plan.md#plan-section-6-15), verifier handoff schema

## Work

1. Implement the closed verifier handoff schema with semantic schema version `1.0.0`.
2. Validate summary, submitted acceptance criteria, findings, evidence, severity, confidence, rejection, and notes.
3. Require unique acceptance criterion IDs and sequential unique finding IDs.
4. Require every failed probe or unconfirmed breakage to have a linked finding.
5. Require all probes passed and breakages confirmed when findings are empty.
6. Require newly written verifier findings to use `rejection: null`.
7. Support one-time owner rejection updates without changing other finding data.
8. Implement validated reads and atomic replacement.

## Implementation

Allow `acceptanceCriterion: null` only for a finding about another spec rule. A non-null finding link must refer to a criterion submitted in the same handoff. Do not parse or compare against `spec.md`; the verifier is responsible for covering every criterion. Never add pass/fail verdict fields. Rejection reasons must be non-empty and owner-provided.

## Tests

Add Vitest tests for empty findings, multiple findings, criterion linkage, null criterion, bad sequences, duplicate IDs, confidence bounds, empty evidence, uncovered failed checks, verifier-supplied rejection, owner rejection, second rejection, and representative unknown-field cases.

## Completion criteria

- Every incomplete regenerated check is explained by a finding.
- The verifier cannot decide whether a finding is accepted.
- Valid empty findings prove all approved criteria were regenerated.
