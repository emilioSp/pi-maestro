/**
 * Objective: Check and persist a new verifier handoff.
 * Used: When Maestro handles verifier handoff artifacts.
 */

import { assertVerifierHandoff } from '#artifacts/verifier-handoff/assertVerifierHandoff.ts';
import { writeJsonAtomically } from '#utils/write-json-atomically.ts';

type WriteVerifierHandoffInput = {
  path: string;
  handoff: unknown;
  specId: string;
  revision: number;
};

export const writeVerifierHandoff = async ({
  path,
  handoff: draftHandoff,
  specId,
  revision,
}: WriteVerifierHandoffInput): Promise<void> => {
  const input = { handoff: draftHandoff, specId, revision };
  assertVerifierHandoff(input);
  const { handoff } = input;

  if (handoff.findings.some((finding) => finding.rejection !== null)) {
    throw new Error('New verifier handoff findings must have no rejection.');
  }

  await writeJsonAtomically({ path, data: handoff });
};
