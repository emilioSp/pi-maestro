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
  const missingIds = [...markdown.matchAll(/^### AC(\d+):/gm)]
    .map((match) => `AC${match[1]}`)
    .filter((id) => !criterionIds.has(id));

  if (missingIds.length > 0) {
    throw new Error(
      `Handoff is missing acceptance criterion IDs from spec.md: ${missingIds.join(', ')}.`,
    );
  }
}
