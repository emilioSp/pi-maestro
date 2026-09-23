/**
 * Objective: Check that a builder handoff has the expected spec ID and revision.
 * Used: When Maestro handles builder handoff artifacts.
 * Entrypoint: assertBuilderHandoffHasExpectedFields().
 */

import type { BuilderHandoff } from '#artifacts/builder-handoff/schema.ts';
import { isValidSpecId } from '#ids.ts';

export const assertBuilderHandoffHasExpectedFields = ({
  handoff,
  specId,
  revision,
}: {
  handoff: BuilderHandoff;
  specId: string;
  revision: number;
}): void => {
  if (!isValidSpecId(specId)) {
    throw new Error(`Invalid expected builder handoff spec ID: "${specId}".`);
  }
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new Error(
      'Expected builder handoff revision must be a positive integer.',
    );
  }
  if (handoff.specId !== specId) {
    throw new Error(
      `Builder handoff spec ID mismatch: expected "${specId}", found "${handoff.specId}".`,
    );
  }
  if (handoff.revision !== revision) {
    throw new Error(
      `Builder handoff revision mismatch: expected ${revision}, found ${handoff.revision}.`,
    );
  }
};
