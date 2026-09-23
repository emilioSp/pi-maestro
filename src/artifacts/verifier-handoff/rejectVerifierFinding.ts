/**
 * Objective: Record an owner rejection on one verifier finding.
 * Used: When Maestro handles verifier handoff artifacts.
 * Entrypoint: rejectVerifierFinding().
 */

import { assertVerifierHandoff } from '#artifacts/verifier-handoff/assertVerifierHandoff.ts';
import { readVerifierHandoff } from '#artifacts/verifier-handoff/readVerifierHandoff.ts';
import type { VerifierHandoff } from '#artifacts/verifier-handoff/schema.ts';
import { writeJsonAtomically } from '#atomic-write.ts';

export const rejectVerifierFinding = async ({
  path,
  specId,
  revision,
  findingId,
  reason,
}: {
  path: string;
  specId: string;
  revision: number;
  findingId: string;
  reason: string;
}): Promise<VerifierHandoff> => {
  const handoff = await readVerifierHandoff({ path, specId, revision });
  const finding = handoff.findings.find(({ id }) => id === findingId);
  if (finding === undefined) {
    throw new Error(`Verifier finding "${findingId}" does not exist.`);
  }
  if (finding.rejection !== null) {
    throw new Error(`Verifier finding "${findingId}" is already rejected.`);
  }
  if (reason.length === 0) {
    throw new Error('Verifier finding rejection reason must be non-empty.');
  }

  const rejectedHandoff = {
    ...handoff,
    findings: handoff.findings.map((currentFinding) =>
      currentFinding.id === findingId
        ? { ...currentFinding, rejection: { reason } }
        : currentFinding,
    ),
  };
  assertVerifierHandoff(rejectedHandoff);
  await writeJsonAtomically({ path, data: rejectedHandoff });

  return rejectedHandoff;
};
