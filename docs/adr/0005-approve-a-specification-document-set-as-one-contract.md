---
type: ADR
id: 'ADR-005'
title: 'Approve a specification document set as one contract'
status: active
---

## Context

Combining motivation, behavior, and technical decisions in one `spec.md` made the document difficult to navigate. The `owner` selected separate documents by purpose, with
`acceptance criteria` next to their requirements rather than collected at the end.

## Decision

Each new `spec` has required `proposal.md` for motivation and scope and `spec.md` for behavior and `acceptance criteria`. `Maestro` creates `design.md` only when
significant approved technical decisions need recording. Routine implementation choices remain with the `builder`.

One `GREEN FLAG` approves all present documents together. The entire set and its prototypes remain frozen during agent execution. Revision uses the existing
`drafting-spec` flow and renewed approval of the complete set. No per-document approval or new workflow phase is introduced.

Requirements keep level-three `REQ` headings. Their `acceptance criteria` use level-four AC headings. Relevant standalone regression criteria use level-three AC headings
under an optional `Regression checks` section, without a requirement or `Delta` field. All criteria share continuous numbering across the document. Shared criteria are
defined once and linked from other requirements.

## Consequences

Creation saves the proposal and behavioral `spec`, returns their paths and the optional design path, and leaves design creation to drafting. Approval requires the
proposal. All three agent roles read every present document and must not create or modify a design after approval.

Freezing continues to rely on agent instructions, without a file-hash manifest or file locks. Saved workflow and `handoff` formats are unchanged. Level-three standalone
regression AC headings and nested level-four headings are both recognized. Historical `specs` are not migrated; older drafts need manual `owner` handling before new
approval.
