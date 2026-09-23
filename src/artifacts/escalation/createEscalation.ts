/**
 * Objective: Create an unresolved escalation.
 * Used: When Maestro handles escalation artifacts.
 * Entrypoint: createEscalation().
 */

import { join } from 'node:path';
import { assertEscalation } from '#artifacts/escalation/assertEscalation.ts';
import { getNextEscalationId } from '#artifacts/escalation/getNextEscalationId.ts';
import {
  ESCALATION_VERSION,
  type Escalation,
  type NewEscalation,
} from '#artifacts/escalation/schema.ts';
import { writeJsonAtomically } from '#utils/write-json-atomically.ts';

export const createEscalation = async ({
  directory,
  specId,
  revision,
  escalation,
}: {
  directory: string;
  specId: string;
  revision: number;
  escalation: NewEscalation;
}): Promise<{ path: string; escalation: Escalation }> => {
  const id = await getNextEscalationId({
    directory,
    specId,
    currentRevision: revision,
  });
  const newEscalation = {
    ...escalation,
    version: ESCALATION_VERSION,
    specId,
    revision,
    id,
    resolution: null,
  };
  assertEscalation(newEscalation);
  const path = join(directory, `${id}.json`);
  await writeJsonAtomically({ path, data: newEscalation });

  return { path, escalation: newEscalation };
};
