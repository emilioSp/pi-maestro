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
  currentRevision: number;
};

function assertWorkflowEscalation({
  escalation,
  specId,
  currentRevision,
}: AssertWorkflowEscalationInput): void {
  if (escalation.specId !== specId) {
    throw new Error(
      `Escalation spec ID mismatch: expected "${specId}", found "${escalation.specId}".`,
    );
  }

  if (escalation.revision > currentRevision) {
    throw new Error(
      `Escalation revision ${escalation.revision} is newer than workflow revision ${currentRevision}.`,
    );
  }
}

type ReadEscalationInput = {
  path: string;
  specId: string;
  currentRevision: number;
};

export const readEscalation = async ({
  path,
  specId,
  currentRevision,
}: ReadEscalationInput): Promise<Escalation> => {
  const escalation = await readJsonFile({ path, description: 'Escalation' });
  assertEscalation(escalation);
  assertWorkflowEscalation({ escalation, specId, currentRevision });

  return escalation;
};
