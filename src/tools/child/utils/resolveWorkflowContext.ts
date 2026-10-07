/**
 * Objective: Resolve the current project and explicit workflow identity.
 * Used: By tools that write workflow artifacts.
 */

import { isValidSpecId } from '#ids/isValidSpecId.ts';
import { resolveToolRunContext } from '#tools/utils/resolveToolRunContext.ts';

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

  const { paths, projectRoot } = await resolveToolRunContext(cwd);

  return { paths, specId, projectRoot };
};
