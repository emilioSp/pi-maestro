/**
 * Objective: Create a checkpoint with only the expected staged paths.
 * Used: When Maestro records a workflow checkpoint.
 * Entrypoint: createCommit().
 */

import { isAbsolute, relative } from 'node:path';
import { runGitCommand } from '#git/command.ts';
import { getStagedPaths } from '#git/commits/getStagedPaths.ts';
import { getCurrentBranch } from '#git/repository/getCurrentBranch.ts';
import { WORKFLOW_ROLES } from '#paths.ts';
import { isPathStrictlyWithin } from '#utils/path-strictly-within.ts';

export const CHECKPOINT_COMMIT_MESSAGE = 'maestro checkpoint';

// Checks that staging contains exactly the expected paths.
const hasSamePaths = ({
  actual,
  expected,
}: {
  actual: readonly string[];
  expected: readonly string[];
}): boolean => {
  if (actual.length !== expected.length) {
    return false;
  }
  return actual.every((path) => expected.includes(path));
};

// Identifies branches managed by the Maestro workflow.
const isWorkflowBranch = (branch: string): boolean =>
  branch.startsWith(`${WORKFLOW_ROLES.BUILDER}/`) ||
  branch.startsWith(`${WORKFLOW_ROLES.VERIFIER}/`);

// Creates a commit after staging exactly the expected workflow paths.
// git symbolic-ref --quiet --short HEAD
// git add -- <path>...
// git diff --cached --name-only -z
// git commit --message <message>
// git rev-parse --verify HEAD^{commit}
export const createCommit = async ({
  repositoryRoot,
  expectedPaths,
  message = CHECKPOINT_COMMIT_MESSAGE,
}: {
  repositoryRoot: string;
  expectedPaths: readonly string[];
  message?: string;
}): Promise<string> => {
  const branch = await getCurrentBranch({ repositoryRoot });
  if (!isWorkflowBranch(branch)) {
    throw new Error(
      `Refusing to create a checkpoint on non-workflow branch: ${branch}.`,
    );
  }

  const expectedGitPaths = expectedPaths.map((path) => {
    if (
      !isAbsolute(path) ||
      !isPathStrictlyWithin({ parent: repositoryRoot, candidate: path })
    ) {
      throw new Error(`Checkpoint path must be inside the worktree: ${path}.`);
    }
    return relative(repositoryRoot, path);
  });

  await runGitCommand({
    arguments: ['add', '--', ...expectedPaths],
    cwd: repositoryRoot,
  });
  const stagedPaths = await getStagedPaths({ repositoryRoot });
  if (!hasSamePaths({ actual: stagedPaths, expected: expectedGitPaths })) {
    throw new Error('Checkpoint has staged paths outside the expected set.');
  }

  await runGitCommand({
    arguments: ['commit', '--message', message],
    cwd: repositoryRoot,
  });
  const result = await runGitCommand({
    arguments: ['rev-parse', '--verify', 'HEAD^{commit}'],
    cwd: repositoryRoot,
  });
  return result.stdout.trim();
};
