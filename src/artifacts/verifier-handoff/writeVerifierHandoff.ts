/**
 * Objective: Check and persist a new verifier handoff.
 * Used: When Maestro handles verifier handoff artifacts.
 */

import { assertVerifierHandoff } from '#artifacts/verifier-handoff/assertVerifierHandoff.ts';
import { writeJsonAtomically } from '#utils/write-json-atomically.ts';

export const writeVerifierHandoff = async ({
  path,
  handoff,
  specId,
  revision,
}: {
  path: string;
  handoff: unknown;
  specId: string;
  revision: number;
}): Promise<void> => {
  assertVerifierHandoff(handoff, specId, revision);
  if (handoff.findings.some((finding) => finding.rejection !== null)) {
    throw new Error('New verifier handoff findings must have no rejection.');
  }

  await writeJsonAtomically({ path, data: handoff });
};
