/**
 * Objective: Resolve the current checkout and explicit workflow identity.
 * Used: By tools that write workflow artifacts.
 */

import { loadConfiguration } from '#config/loadConfiguration.ts';
import { findRepositoryRoot } from '#git/repository/findRepositoryRoot.ts';
import { isValidSpecId } from '#ids/isValidSpecId.ts';
import { MaestroPaths } from '#MaestroPaths.ts';

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

  const repositoryRoot = await findRepositoryRoot({ cwd });
  const config = await loadConfiguration({ cwd: repositoryRoot });
  const paths = new MaestroPaths({ repositoryRoot, config });

  return { paths, specId, repositoryRoot };
};
