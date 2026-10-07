/**
 * Objective: Read an escalation for its workflow.
 * Used: When Maestro handles escalation artifacts.
 */

import { assertEscalation } from '#artifacts/escalation/assertEscalation.ts';
import type { Escalation } from '#artifacts/escalation/schema.ts';
import { readJsonFile } from '#utils/read-json.ts';

type AssertWorkflowEscalationInput = {
  escalation: Escalation;
  specId: string;
};

function assertWorkflowEscalation({
  escalation,
  specId,
}: AssertWorkflowEscalationInput): void {
  if (escalation.specId !== specId) {
    throw new Error(
      `Escalation spec ID mismatch: expected "${specId}", found "${escalation.specId}".`,
    );
  }
}

type ReadEscalationInput = {
  path: string;
  specId: string;
};

export const readEscalation = async ({
  path,
  specId,
}: ReadEscalationInput): Promise<Escalation> => {
  const escalation = await readJsonFile({ path, description: 'Escalation' });
  assertEscalation(escalation);
  assertWorkflowEscalation({ escalation, specId });

  return escalation;
};
