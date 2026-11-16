# Architecture decision records

These records explain architectural choices, their context, and consequences. Each decision has its own file; existing IDs remain stable. Records preserve the context at
decision time, so later decisions may replace part or all of an earlier choice.

| ID      | Decision                                                                                                                     | Status     |
| ------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------- |
| ADR-001 | [Keep the workflow independent of Git](0001-keep-the-workflow-independent-of-git.md)                                         | Superseded |
| ADR-002 | [Store escalation decisions in builder handoffs](0002-store-escalation-decisions-in-builder-handoffs.md)                     | Active     |
| ADR-003 | [Route builder failures through owner escalations](0003-route-builder-failures-through-owner-escalations.md)                 | Active     |
| ADR-004 | [Require Git only for the simplifier](0004-require-git-only-for-the-simplifier.md)                                           | Active     |
| ADR-005 | [Approve a specification document set as one contract](0005-approve-a-specification-document-set-as-one-contract.md)         | Active     |
| ADR-006 | [Maintain the roadmap in Linear](0006-maintain-the-roadmap-in-linear.md)                                                     | Superseded |
| ADR-007 | [Maintain the roadmap in the repository](0007-maintain-the-roadmap-in-the-repository.md)                                     | Active     |
| ADR-008 | [Use Pi's registry for model availability](0008-use-pis-registry-for-model-availability.md)                                  | Active     |
| ADR-009 | [Select optional phases in the transition table](0009-select-optional-phases-in-the-transition-table.md)                     | Active     |
| ADR-010 | [Use the Pi SDK for sequential agent delegation](0010-use-the-pi-sdk-for-sequential-agent-delegation.md)                     | Active     |
| ADR-011 | [Separate initial setup UI from configuration rules](0011-separate-initial-setup-ui-from-configuration-rules.md)             | Active     |
| ADR-012 | [Filter main Maestro registrations after native discovery](0012-filter-main-maestro-registrations-after-native-discovery.md) | Active     |

When a decision is replaced, add a new record and link both records. Requirements and planned work belong in the [roadmap](../roadmap/README.md).
