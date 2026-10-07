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

type ResolveEscalationInput = {
  path: string;
  specId: string;
  resolution: EscalationResolution;
};

export const resolveEscalation = async ({
  path,
  specId,
  resolution,
}: ResolveEscalationInput): Promise<Escalation> => {
  const current = await readEscalation({
    path,
    specId,
  });

  if (current.resolution !== null) {
    throw new Error(`Escalation "${current.id}" is already resolved.`);
  }

  const resolvedEscalation = {
    ...current,
    resolution,
  };

  assertEscalation(resolvedEscalation);
  await writeJsonAtomically({ path, data: resolvedEscalation });

  return resolvedEscalation;
};
