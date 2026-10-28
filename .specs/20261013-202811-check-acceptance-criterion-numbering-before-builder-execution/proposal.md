# 20261013-202811-check-acceptance-criterion-numbering-before-builder-execution: Check acceptance criterion numbering before builder execution

> After owner approval, this specification is the contract for the builder and verifier.

## Context, goals, and scope

R-05 in `ROADMAP.md` requires criterion numbering that starts at AC1 and continues without gaps. Reject incorrect numbering when Maestro records spec approval.

### Out of scope

No new tool, renumbering by the approval tool, check for missing criteria, or matching of criterion IDs against handoffs. No additional checks in builder launch or unchanged-contract decision resolution.

## Documents

Required behavior and acceptance criteria: [spec.md](spec.md).

Technical decisions: [design.md](design.md).
