/**
 * Objective: Check whether product files differ from a commit.
 * Used: Before verifier handoffs and owner finding resolutions.
 */

import { relative } from 'node:path';
import { runGitCommand } from '#git/command.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';

type HasProductChangesInput = {
  repositoryRoot: string;
  candidateCommit: string;
  workflowPath: string;
  handoffPath: string;
};

export const hasProductChanges = async ({
  repositoryRoot,
  candidateCommit,
  workflowPath,
  handoffPath,
}: HasProductChangesInput): Promise<boolean> => {
  /*
   * Compare both the checkout and index with the candidate. The second diff
   * catches a product file that the verifier staged and then restored only on
   * disk.
   */
  const [diff, stagedDiff, status] = await Promise.all([
    runGitCommand({
      arguments: [
        'diff',
        '--no-renames',
        '--name-only',
        '-z',
        candidateCommit,
        '--',
      ],
      cwd: repositoryRoot,
    }),
    runGitCommand({
      arguments: [
        'diff',
        '--cached',
        '--no-renames',
        '--name-only',
        '-z',
        candidateCommit,
        '--',
      ],
      cwd: repositoryRoot,
    }),
    getRepositoryStatus({ repositoryRoot }),
  ]);

  const allowedPaths = new Set([
    relative(repositoryRoot, workflowPath),
    relative(repositoryRoot, handoffPath),
  ]);

  const changedTrackedPaths = [diff.stdout, stagedDiff.stdout]
    .flatMap((output) => output.split('\0'))
    .filter((path) => path.length > 0);

  return (
    changedTrackedPaths.some((path) => !allowedPaths.has(path)) ||
    status.untracked.some((path) => !allowedPaths.has(path))
  );
};
