/**
 * Objective: Require every spec criterion ID in a handoff.
 * Used: Before builder and verifier submissions save their reports.
 */

type AssertSpecAcceptanceCriteriaInput = {
  markdown: string;
  criterionIds: Set<string>;
};

export function assertSpecAcceptanceCriteria({
  markdown,
  criterionIds,
}: AssertSpecAcceptanceCriteriaInput): void {
  // Match standalone ACs (###), including regression checks, and ACs nested under requirements (####).
  const missingIds = [...markdown.matchAll(/^#{3,4} AC(\d+):/gm)]
    .map((match) => `AC${match[1]}`)
    .filter((id) => !criterionIds.has(id));

  if (missingIds.length > 0) {
    throw new Error(
      `Handoff is missing acceptance criterion IDs from spec.md: ${missingIds.join(', ')}.`,
    );
  }
}
