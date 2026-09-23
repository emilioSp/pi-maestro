/**
 * Objective: Read staged, unstaged, and untracked repository changes.
 * Used: When Maestro checks whether a worktree is clean.
 */

import { type GitCommandResult, runGitCommand } from '#git/command.ts';

export type RepositoryStatus = {
  clean: boolean;
  staged: readonly string[];
  unstaged: readonly string[];
  untracked: readonly string[];
};

const parseRepositoryStatus = (result: GitCommandResult): RepositoryStatus => {
  const staged: string[] = [];
  const unstaged: string[] = [];
  const untracked: string[] = [];
  const records = result.stdout.split('\0');

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (record.length === 0) {
      continue;
    }
    const indexStatus = record[0];
    const worktreeStatus = record[1];
    const path = record.slice(3);

    if (indexStatus === '?' && worktreeStatus === '?') {
      untracked.push(path);
      continue;
    }
    if (indexStatus !== ' ') {
      staged.push(path);
    }
    if (worktreeStatus !== ' ') {
      unstaged.push(path);
    }

    if (
      indexStatus === 'R' ||
      indexStatus === 'C' ||
      worktreeStatus === 'R' ||
      worktreeStatus === 'C'
    ) {
      index += 1;
    }
  }

  return {
    clean:
      staged.length === 0 && unstaged.length === 0 && untracked.length === 0,
    staged,
    unstaged,
    untracked,
  };
};

// git status --porcelain=v1 --untracked-files=all -z
export const getRepositoryStatus = async ({
  repositoryRoot,
}: {
  repositoryRoot: string;
}): Promise<RepositoryStatus> => {
  const result = await runGitCommand({
    arguments: ['status', '--porcelain=v1', '--untracked-files=all', '-z'],
    cwd: repositoryRoot,
  });
  return parseRepositoryStatus(result);
};
