# 20261013-211629-match-handoff-criteria-to-the-approved-spec: Match handoff criteria to the approved spec

> After owner approval, this spec is the contract for the builder and verifier.

## 1. Context, goals, and scope

Require every acceptance criterion ID in spec.md to appear in the builder or verifier handoff's `acceptanceCriteria` array.
This is narrower than the roadmap's exact-match objective. Only missing IDs require a new check.

## 2. Requirements and constraints

### REQ1: Require every spec criterion before saving a handoff

Before saving a builder or verifier handoff or changing phase, reject a submission that omits any criterion ID from spec.md.
Apply this check to both builder outcomes and verifier submissions with or without findings.
Rejection leaves saved reports and workflow state unchanged.

Verified by: [AC1](#ac1-missing-spec-criterion-ids-prevent-handoff-submission)

### REQ2: Preserve validation without rejecting additional report IDs

Preserve existing validation. Do not add checks for extra report IDs or duplicate spec IDs.

Verified by: [AC2](#ac2-reports-containing-every-spec-criterion-id-pass-the-new-check)

Coverage gap: AC2 covers extra report IDs, not duplicate spec IDs or every existing validation rule.

### REQ3: Extract exact IDs from raw matching headings

Extract IDs from raw spec.md lines using the existing multiline rule `^### AC(\d+):`.
Preserve the digits as written, including leading zeros. Matching lines inside code blocks count.

Verified by: [AC1](#ac1-missing-spec-criterion-ids-prevent-handoff-submission); [AC2](#ac2-reports-containing-every-spec-criterion-id-pass-the-new-check)

Coverage gap: Leading zeros and matching headings inside code blocks are not explicitly exercised by the existing AC examples.

### REQ4: Leave approval unchanged and permit specs without matching headings

Keep existing approval behavior. If no headings match, the new presence check imposes no restriction.

Verified by: [AC2](#ac2-reports-containing-every-spec-criterion-id-pass-the-new-check)

## 3. Technical decisions

This reuses the heading rule in `src/workflow/spec/markSpecReady.ts`.

## 4. Acceptance criteria

### AC1: Missing spec criterion IDs prevent handoff submission

1. Probe: A spec has AC1 and AC2. Submit otherwise valid reports containing only AC1. Cover builder done, builder escalation, verifier without findings, and verifier with findings.
2. Expected result: Each submission fails without saving a handoff or changing workflow state.
3. Example: From verifier-running, submit only passed AC1 with no findings for a spec containing AC1 and AC2. No V1.json is created and the phase remains verifier-running.

### AC2: Reports containing every spec criterion ID pass the new check

1. Probe: Submit otherwise valid builder and verifier reports containing all extracted spec IDs. Include reversed array order and extra report IDs. Also check a spec with no matching headings.
2. Expected result: The new presence check permits each submission, subject to existing validation.
3. Example: A spec has AC1 and AC2. From builder-running, submit a valid done report with passed results ordered AC2, AC1, AC3. B1.json is saved and the phase becomes ready-for-verifier.
