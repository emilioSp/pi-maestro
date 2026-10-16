/**
 * Objective: Read the fixed simplifier handoff and validate its identity.
 * Used: After foreground simplifier execution completes.
 */

import { assertSimplifierHandoff } from '#artifacts/simplifier-handoff/assertSimplifierHandoff.ts';
import { readJsonFile } from '#utils/read-json.ts';

type ReadSimplifierHandoffInput = {
  path: string;
  specId: string;
  projectRoot: string;
};

export const readSimplifierHandoff = async ({
  path,
  specId,
  projectRoot,
}: ReadSimplifierHandoffInput) => {
  const input = {
    handoff: await readJsonFile({ path, description: 'Simplifier handoff' }),
    specId,
    projectRoot,
  };

  assertSimplifierHandoff(input);

  return input.handoff;
};
