/**
 * Objective: Read and check a builder handoff.
 * Used: When Maestro handles builder handoff artifacts.
 * Entrypoint: readBuilderHandoff().
 */

import { assertBuilderHandoff } from '#artifacts/builder-handoff/assertBuilderHandoff.ts';
import type { BuilderHandoff } from '#artifacts/builder-handoff/schema.ts';
import { readJsonFile } from '#utils/read-json.ts';

export const readBuilderHandoff = async ({
  path,
  specId,
  revision,
}: {
  path: string;
  specId: string;
  revision: number;
}): Promise<BuilderHandoff> => {
  const handoff = await readJsonFile({ path, description: 'Builder handoff' });
  assertBuilderHandoff(handoff, specId, revision);
  return handoff;
};
