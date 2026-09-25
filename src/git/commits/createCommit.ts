/**
 * Objective: Create a checkpoint commit containing exactly the expected paths.
 * Used: When Maestro records a workflow checkpoint.
 */

import { isAbsolute, relative } from 'node:path';
import { runGitCommand } from '#git/command.ts';
import { getStagedPaths } from '#git/commits/getStagedPaths.ts';
import { isPathStrictlyWithin } from '#utils/path-strictly-within.ts';

export const CHECKPOINT_COMMIT_MESSAGE = 'maestro checkpoint';

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

// git add <path>...
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
  const expectedGitPaths = expectedPaths.map((path) => {
    if (
      !isAbsolute(path) ||
      !isPathStrictlyWithin({ parent: repositoryRoot, candidate: path })
    ) {
      throw new Error(
        `Checkpoint path must be inside the repository: ${path}.`,
      );
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
