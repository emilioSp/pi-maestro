/**
 * Objective: Read an escalation for its workflow.
 * Used: When Maestro handles escalation artifacts.
 * Entrypoint: readEscalation().
 */

import { assertEscalation } from '#artifacts/escalation/assertEscalation.ts';
import type { Escalation } from '#artifacts/escalation/schema.ts';
import { readJsonFile } from '#utils/read-json.ts';

const assertWorkflowEscalation = ({
  escalation,
  specId,
  currentRevision,
}: {
  escalation: Escalation;
  specId: string;
  currentRevision: number;
}): void => {
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
};

export const readEscalation = async ({
  path,
  specId,
  currentRevision,
}: {
  path: string;
  specId: string;
  currentRevision: number;
}): Promise<Escalation> => {
  const escalation = await readJsonFile({ path, description: 'Escalation' });
  assertEscalation(escalation);
  assertWorkflowEscalation({ escalation, specId, currentRevision });
  return escalation;
};
