/**
 * Objective: Check and persist a builder handoff.
 * Used: When Maestro handles builder handoff artifacts.
 */

import { assertBuilderHandoff } from '#artifacts/builder-handoff/assertBuilderHandoff.ts';
import { writeJson } from '#utils/write-json.ts';

type WriteBuilderHandoffInput = {
  path: string;
  handoff: unknown;
  specId: string;
};

export const writeBuilderHandoff = async ({
  path,
  handoff,
  specId,
}: WriteBuilderHandoffInput): Promise<void> => {
  assertBuilderHandoff({ handoff, specId });
  await writeJson({ path, data: handoff });
};
