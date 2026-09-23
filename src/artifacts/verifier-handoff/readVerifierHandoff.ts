/**
 * Objective: Read and check a verifier handoff.
 * Used: When Maestro handles verifier handoff artifacts.
 * Entrypoint: readVerifierHandoff().
 */

import { assertVerifierHandoff } from '#artifacts/verifier-handoff/assertVerifierHandoff.ts';
import { assertVerifierHandoffHasExpectedFields } from '#artifacts/verifier-handoff/assertVerifierHandoffHasExpectedFields.ts';
import type { VerifierHandoff } from '#artifacts/verifier-handoff/schema.ts';
import { readJsonFile } from '#utils/read-json.ts';

export const readVerifierHandoff = async ({
  path,
  specId,
  revision,
}: {
  path: string;
  specId: string;
  revision: number;
}): Promise<VerifierHandoff> => {
  const handoff = await readJsonFile({ path, description: 'Verifier handoff' });
  assertVerifierHandoff(handoff);
  assertVerifierHandoffHasExpectedFields({
    handoff,
    specId,
    revision,
  });
  return handoff;
};
