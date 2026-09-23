/**
 * Objective: Check that a verifier handoff has the expected spec ID and revision.
 * Used: When Maestro handles verifier handoff artifacts.
 * Entrypoint: assertVerifierHandoffHasExpectedFields().
 */

import type { VerifierHandoff } from '#artifacts/verifier-handoff/schema.ts';

export const assertVerifierHandoffHasExpectedFields = ({
  handoff,
  specId,
  revision,
}: {
  handoff: VerifierHandoff;
  specId: string;
  revision: number;
}): void => {
  if (handoff.specId !== specId) {
    throw new Error(
      `Verifier handoff spec ID mismatch: expected "${specId}", found "${handoff.specId}".`,
    );
  }
  if (handoff.revision !== revision) {
    throw new Error(
      `Verifier handoff revision mismatch: expected ${revision}, found ${handoff.revision}.`,
    );
  }
};
