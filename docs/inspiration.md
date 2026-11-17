# Inspirations

Pi Maestro is inspired by concepts from [OpenSpec](https://github.com/Fission-AI/OpenSpec) and [GitHub Spec Kit](https://github.com/github/spec-kit). It adapts those
concepts to a sequential multiagent workflow in Pi.

The following official sources document the conceptual references. The links point to fixed revisions so the cited content remains inspectable.

1. **The `specification` drives the code.** [Spec Kit's philosophy][spec-kit-philosophy] treats the `specification` as the primary `artifact` and code as its expression.
   In `Maestro`, the approved `spec` defines a working contract for the `builder` and `verifier`.
2. **Describe behavior, not routine implementation choices.** [OpenSpec's schema][openspec-schema] defines a `specification` as a behavior contract, not an implementation
   plan. `Maestro` records required behavior, constraints, and approved architectural decisions in the `spec`, leaving routine implementation choices to the `builder`.
3. **Use concrete, testable scenarios.** [OpenSpec's schema][openspec-schema] pairs requirements with scenarios; [Spec Kit's template][spec-kit-template] uses
   Given/When/Then acceptance scenarios. Each `Maestro` `acceptance criterion` includes a `GIVEN`, a `WHEN`, a `THEN`, and a concrete example.
4. **Clarify requirements progressively.** [Spec Kit's clarify command][spec-kit-clarify] asks one question at a time and integrates accepted answers into the
   `specification`. `Maestro` likewise asks one focused question, waits for the owner's answer, and updates the `spec` before asking the next question.
5. **Review requirements separately from testing code.** [Spec Kit's checklist command][spec-kit-checklist] evaluates requirements for completeness, clarity, consistency,
   and measurability, not implementation correctness. Before approval, `Maestro` reviews the `spec` for consistency, missing decisions, measurable outcomes, and
   reproducible scenarios. The later `verifier` checks the implementation independently.
6. **Separate motivation, behavior, and design.** [OpenSpec's schema][openspec-schema] separates these concerns and calls for `design.md` only when significant technical
   decisions need recording, including reasons, alternatives, and risks.
7. **Make requirement changes explicit.** [OpenSpec's schema][openspec-schema] distinguishes added, modified, removed, and renamed requirements. `Maestro` adapts this
   concept with one `Delta` field per requirement: `added`, `modified`, or `removed`. Each requirement heading states the required outcome with a named actor and `MUST`.
8. **Make requirement coverage traceable.** [Spec Kit's analyze command][spec-kit-analyze] maps requirements to implementation tasks and identifies coverage gaps.
   `Maestro` applies a related principle to verification: each requirement has a `Verified by` field linking to its `acceptance criteria`, existing tests covering exact
   scenarios, or both. The mapping connects requirements to verification.

[openspec-schema]: https://github.com/Fission-AI/OpenSpec/blob/6d04a1b58dedc95729d34e4f223d9d483aae210a/schemas/spec-driven/schema.yaml
[spec-kit-philosophy]: https://github.com/github/spec-kit/blob/222a973f8b8794366680c043fb935a31f71902af/spec-driven.md
[spec-kit-template]: https://github.com/github/spec-kit/blob/222a973f8b8794366680c043fb935a31f71902af/templates/spec-template.md
[spec-kit-clarify]: https://github.com/github/spec-kit/blob/222a973f8b8794366680c043fb935a31f71902af/templates/commands/clarify.md
[spec-kit-checklist]: https://github.com/github/spec-kit/blob/222a973f8b8794366680c043fb935a31f71902af/templates/commands/checklist.md
[spec-kit-analyze]: https://github.com/github/spec-kit/blob/222a973f8b8794366680c043fb935a31f71902af/templates/commands/analyze.md

