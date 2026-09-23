/**
 * Objective: Check and persist a builder handoff.
 * Used: When Maestro handles builder handoff artifacts.
 * Entrypoint: writeBuilderHandoff().
 */

import { assertBuilderHandoff } from '#artifacts/builder-handoff/assertBuilderHandoff.ts';
import { writeJsonAtomically } from '#atomic-write.ts';

export const writeBuilderHandoff = async ({
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
  assertBuilderHandoff(handoff, specId, revision);
  await writeJsonAtomically({ path, data: handoff });
};
