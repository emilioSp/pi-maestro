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
};

export const writeVerifierHandoff = async ({
  path,
  handoff: draftHandoff,
  specId,
}: WriteVerifierHandoffInput): Promise<void> => {
  const input = { handoff: draftHandoff, specId };
  assertVerifierHandoff(input);
  const { handoff } = input;

  if (handoff.findings.some((finding) => finding.decision !== null)) {
    throw new Error(
      'New verifier handoff findings must have no owner decision.',
    );
  }

  await writeJsonAtomically({ path, data: handoff });
};
