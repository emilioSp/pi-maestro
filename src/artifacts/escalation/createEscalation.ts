/**
 * Objective: Create an unresolved escalation.
 * Used: When Maestro handles escalation artifacts.
 */

import { join } from 'node:path';
import { assertEscalation } from '#artifacts/escalation/assertEscalation.ts';
import { getNextEscalationId } from '#artifacts/escalation/getNextEscalationId.ts';
import {
  ESCALATION_VERSION,
  type Escalation,
  type NewEscalation,
} from '#artifacts/escalation/schema.ts';
import { writeJson } from '#utils/write-json.ts';

type CreateEscalationInput = {
  directory: string;
  specId: string;
  escalation: NewEscalation;
};

export const createEscalation = async ({
  directory,
  specId,
  escalation,
}: CreateEscalationInput): Promise<{
  path: string;
  escalation: Escalation;
}> => {
  const id = await getNextEscalationId({
    directory,
    specId,
  });

  const newEscalation = {
    question: escalation.question,
    context: escalation.context,
    options: escalation.options,
    recommendation: escalation.recommendation,
    notes: escalation.notes,
    version: ESCALATION_VERSION,
    specId,
    id,
    resolution: null,
  };

  assertEscalation(newEscalation);
  const path = join(directory, `${id}.json`);
  await writeJson({ path, data: newEscalation });

  return { path, escalation: newEscalation };
};
