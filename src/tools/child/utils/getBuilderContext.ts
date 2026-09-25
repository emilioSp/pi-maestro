/**
 * Objective: Resolve the current checkout and explicit builder workflow identity.
 * Used: By child-only tools that write builder workflow artifacts.
 */

import { loadConfiguration } from '#config/loadConfiguration.ts';
import { findRepositoryRoot } from '#git/repository/findRepositoryRoot.ts';
import { isValidSpecId } from '#ids/isValidSpecId.ts';
import { MaestroPaths } from '#MaestroPaths.ts';

export type BuilderContextInput = {
  cwd: string;
  specId: string;
};

export const getBuilderContext = async ({
  cwd,
  specId,
}: BuilderContextInput) => {
  if (!isValidSpecId(specId)) {
    throw new Error(`Invalid spec ID: "${specId}".`);
  }

  const repositoryRoot = await findRepositoryRoot({ cwd });
  const config = await loadConfiguration({ cwd: repositoryRoot });
  const paths = new MaestroPaths({ repositoryRoot, config });

  return { paths, specId, repositoryRoot };
};
