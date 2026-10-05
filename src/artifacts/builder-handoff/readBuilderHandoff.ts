/**
 * Objective: Read and check a builder handoff.
 * Used: When Maestro handles builder handoff artifacts.
 */

import { assertBuilderHandoff } from '#artifacts/builder-handoff/assertBuilderHandoff.ts';
import type { BuilderHandoff } from '#artifacts/builder-handoff/schema.ts';
import { readJsonFile } from '#utils/read-json.ts';

type ReadBuilderHandoffInput = {
  path: string;
  specId: string;
  revision: number;
};

export const readBuilderHandoff = async ({
  path,
  specId,
  revision,
}: ReadBuilderHandoffInput): Promise<BuilderHandoff> => {
  const input = {
    handoff: await readJsonFile({ path, description: 'Builder handoff' }),
    specId,
    revision,
  };

  assertBuilderHandoff(input);

  return input.handoff;
};
