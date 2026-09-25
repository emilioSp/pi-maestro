/**
 * Objective: Resolve paths and identity for the active builder worktree.
 * Used: By child-only tools that write builder workflow artifacts.
 */

import { loadConfiguration } from '#config/loadConfiguration.ts';
import { findRepositoryRoot } from '#git/repository/findRepositoryRoot.ts';
import { getCurrentBranch } from '#git/repository/getCurrentBranch.ts';
import { isValidSpecId } from '#ids/isValidSpecId.ts';
import { MaestroPaths } from '#MaestroPaths.ts';
import { WORKFLOW_ROLES } from '#workflow/roles.ts';

export const getBuilderWorktreeContext = async ({ cwd }: { cwd: string }) => {
  const worktreePath = await findRepositoryRoot({ cwd });
  const branch = await getCurrentBranch({ repositoryRoot: worktreePath });
  const prefix = `${WORKFLOW_ROLES.BUILDER}/`;

  if (!branch.startsWith(prefix)) {
    throw new Error(
      `Builder child tool must run on a "${WORKFLOW_ROLES.BUILDER}/" branch.`,
    );
  }

  const specId = branch.slice(prefix.length);

  if (!isValidSpecId(specId)) {
    throw new Error(`Invalid builder branch name: "${branch}".`);
  }

  const config = await loadConfiguration({ cwd: worktreePath });
  const paths = new MaestroPaths({ repositoryRoot: worktreePath, config });

  return { paths, specId, worktreePath };
};
