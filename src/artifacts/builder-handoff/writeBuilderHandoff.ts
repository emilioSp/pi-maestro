/**
 * Objective: Check and persist a builder handoff.
 * Used: When Maestro handles builder handoff artifacts.
 */

import { assertBuilderHandoff } from '#artifacts/builder-handoff/assertBuilderHandoff.ts';
import { writeJsonAtomically } from '#utils/write-json-atomically.ts';

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
