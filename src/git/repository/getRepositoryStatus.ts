/**
 * Objective: Read staged, unstaged, and untracked repository changes.
 * Used: When Maestro checks whether a worktree is clean.
 */

import { resolve } from 'node:path';
import { type GitCommandResult, runGitCommand } from '#git/command.ts';
import { isPathWithinOrEqual } from '#utils/path-within-or-equal.ts';

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

type GetRepositoryStatusInput = {
  repositoryRoot: string;
  worktreeDirectory?: string;
};

type ExcludeWorktreePathFromUntrackedFilesInput = {
  repositoryRoot: string;
  untrackedPaths: readonly string[];
  worktreeDirectory?: string;
};

const excludeWorktreePathFromUntrackedFiles = ({
  repositoryRoot,
  untrackedPaths,
  worktreeDirectory,
}: ExcludeWorktreePathFromUntrackedFilesInput): readonly string[] => {
  if (worktreeDirectory === undefined) {
    return untrackedPaths;
  }

  const resolvedWorktreeDirectory = resolve(repositoryRoot, worktreeDirectory);

  return untrackedPaths.filter(
    (path) =>
      !isPathWithinOrEqual({
        parent: resolvedWorktreeDirectory,
        candidate: resolve(repositoryRoot, path),
      }),
  );
};

// git status --porcelain=v1 --untracked-files=all -z
export const getRepositoryStatus = async ({
  repositoryRoot,
  worktreeDirectory,
}: GetRepositoryStatusInput): Promise<RepositoryStatus> => {
  const result = await runGitCommand({
    arguments: ['status', '--porcelain=v1', '--untracked-files=all', '-z'],
    cwd: repositoryRoot,
  });
  const status = parseRepositoryStatus(result);

  // Exclude Maestro-managed worktree files from the base repository status.
  const untracked = excludeWorktreePathFromUntrackedFiles({
    repositoryRoot,
    untrackedPaths: status.untracked,
    worktreeDirectory,
  });

  return {
    ...status,
    clean:
      status.staged.length === 0 &&
      status.unstaged.length === 0 &&
      untracked.length === 0,
    untracked,
  };
};
