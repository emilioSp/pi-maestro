/**
 * Objective: Check that Git can inspect this repository.
 * Used: When Maestro checks that Git can inspect a repository.
 */

import { runGitCommand } from '#git/command.ts';

// git status --porcelain=v1 --untracked-files=no
export async function assertRepositoryTrusted(
  repositoryRoot: string,
): Promise<void> {
  await runGitCommand({
    arguments: ['status', '--porcelain=v1', '--untracked-files=no'],
    cwd: repositoryRoot,
  });
}
