/**
 * Objective: Attempt best-effort removal of verified workflow worktrees and branches.
 * Used: After final-review state is staged.
 */

import { deleteBranch } from '#git/branches/deleteBranch.ts';
import { removeWorktree } from '#git/worktrees/removeWorktree.ts';

export type WorkflowResource = { branch: string; worktreePath: string };

// git worktree list --porcelain
// git status --porcelain=v1 --untracked-files=all -z
// git worktree remove <worktree-path>
// git show-ref --verify --quiet refs/heads/<branch>
// git branch --delete --force <branch>
export const cleanupWorkflowResources = async ({
  repositoryRoot,
  worktreeDirectory,
  resources,
}: {
  repositoryRoot: string;
  worktreeDirectory: string;
  resources: WorkflowResource[];
}): Promise<{ removed: string[]; failures: string[] }> => {
  const removed: string[] = [];
  const failures: string[] = [];

  for (const resource of resources) {
    try {
      await removeWorktree({
        repositoryRoot,
        path: resource.worktreePath,
        branch: resource.branch,
        worktreeDirectory,
      });
      // The candidate patch is already staged on the base branch. For example, squash leaves HEAD at B while the verifier branch points to C in B -> C, so normal deletion rejects C as unmerged.
      await deleteBranch({
        repositoryRoot,
        branch: resource.branch,
        force: true,
      });
      removed.push(resource.branch);
    } catch (error) {
      failures.push(
        `${resource.branch}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return { removed, failures };
};
