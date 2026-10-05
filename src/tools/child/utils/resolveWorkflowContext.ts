/**
 * Objective: Resolve the current checkout and explicit workflow identity.
 * Used: By tools that write workflow artifacts.
 */

import { isValidSpecId } from '#ids/isValidSpecId.ts';
import { resolveToolLaunchContext } from '#tools/utils/resolveToolLaunchContext.ts';

export type ResolveWorkflowContextInput = {
  cwd: string;
  specId: string;
};

export const resolveWorkflowContext = async ({
  cwd,
  specId,
}: ResolveWorkflowContextInput) => {
  if (!isValidSpecId(specId)) {
    throw new Error(`Invalid spec ID: "${specId}".`);
  }

  const { paths, repositoryRoot } = await resolveToolLaunchContext(cwd);

  return { paths, specId, repositoryRoot };
};
