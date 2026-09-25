/**
 * Objective: Squash a verified candidate onto a clean base branch without committing it.
 * Used: When Maestro prepares a candidate for owner review.
 */

import { runGitCommand } from '#git/command.ts';
import { isAncestor } from '#git/history/isAncestor.ts';
import { getCurrentBranch } from '#git/repository/getCurrentBranch.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';

type SquashCandidateInput = {
  repositoryRoot: string;
  baseBranch: string;
  candidateBranch: string;
  worktreeDirectory: string;
};

export const squashCandidate = async ({
  repositoryRoot,
  baseBranch,
  candidateBranch,
  worktreeDirectory,
}: SquashCandidateInput): Promise<void> => {
  const status = await getRepositoryStatus({
    repositoryRoot,
    worktreeDirectory,
  });

  if (!status.clean) {
    throw new Error('Refusing final review on a dirty base branch.');
  }

  const currentBranch = await getCurrentBranch({ repositoryRoot });

  if (currentBranch !== baseBranch) {
    throw new Error(
      `Expected base branch "${baseBranch}", found "${currentBranch}".`,
    );
  }

  if (
    !(await isAncestor({
      repositoryRoot,
      ancestor: baseBranch,
      descendant: candidateBranch,
    }))
  ) {
    throw new Error(
      `Candidate branch "${candidateBranch}" does not descend from "${baseBranch}".`,
    );
  }

  // git merge --squash --no-commit <candidate-branch>
  await runGitCommand({
    arguments: ['merge', '--squash', '--no-commit', candidateBranch],
    cwd: repositoryRoot,
  });
};
