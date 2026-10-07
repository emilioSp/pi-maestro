/**
 * Objective: Read and check a verifier handoff.
 * Used: When Maestro handles verifier handoff artifacts.
 */

import { assertVerifierHandoff } from '#artifacts/verifier-handoff/assertVerifierHandoff.ts';
import type { VerifierHandoff } from '#artifacts/verifier-handoff/schema.ts';
import { readJsonFile } from '#utils/read-json.ts';

type ReadVerifierHandoffInput = {
  path: string;
  specId: string;
};

export const readVerifierHandoff = async ({
  path,
  specId,
}: ReadVerifierHandoffInput): Promise<VerifierHandoff> => {
  const input = {
    handoff: await readJsonFile({ path, description: 'Verifier handoff' }),
    specId,
  };

  assertVerifierHandoff(input);

  return input.handoff;
};
