/**
 * Objective: Record an owner escalation resolution.
 * Used: When Maestro handles escalation artifacts.
 */

import { assertEscalation } from '#artifacts/escalation/assertEscalation.ts';
import { readEscalation } from '#artifacts/escalation/readEscalation.ts';
import type {
  Escalation,
  EscalationResolution,
} from '#artifacts/escalation/schema.ts';
import { writeJsonAtomically } from '#utils/write-json-atomically.ts';

export const resolveEscalation = async ({
  path,
  specId,
  revision,
  resolution,
}: {
  path: string;
  specId: string;
  revision: number;
  resolution: EscalationResolution;
}): Promise<Escalation> => {
  const current = await readEscalation({
    path,
    specId,
    currentRevision: revision,
  });

  if (current.resolution !== null) {
    throw new Error(`Escalation "${current.id}" is already resolved.`);
  }

  if (revision <= current.revision) {
    throw new Error(
      `Escalation resolution revision must be greater than ${current.revision}.`,
    );
  }

  const resolvedEscalation = {
    ...current,
    revision,
    resolution,
  };
  assertEscalation(resolvedEscalation);
  await writeJsonAtomically({ path, data: resolvedEscalation });

  return resolvedEscalation;
};
