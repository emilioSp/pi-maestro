/**
 * Objective: Inspect and validate the current Git repository.
 * Used: Before Maestro changes repository state.
 * Entrypoint: assertRepositoryTrusted().
 */

import { realpath } from 'node:fs/promises';
import { type GitCommandResult, runGitCommand } from '#git/command.ts';

export type RepositoryStatus = {
  clean: boolean;
  staged: readonly string[];
  unstaged: readonly string[];
  untracked: readonly string[];
};

const removeFinalLineEnding = (value: string): string =>
  value.replace(/\r?\n$/, '');

// git rev-parse --path-format=absolute --show-toplevel
export const findRepositoryRoot = async ({
  cwd = process.cwd(),
}: {
  cwd?: string;
} = {}): Promise<string> => {
  const result = await runGitCommand({
    arguments: ['rev-parse', '--path-format=absolute', '--show-toplevel'],
    cwd,
  });

  return realpath(removeFinalLineEnding(result.stdout));
};

// git symbolic-ref --quiet --short HEAD
export const getCurrentBranch = async ({
  repositoryRoot,
}: {
  repositoryRoot: string;
}): Promise<string> => {
  const result = await runGitCommand({
    arguments: ['symbolic-ref', '--quiet', '--short', 'HEAD'],
    cwd: repositoryRoot,
  });

  return removeFinalLineEnding(result.stdout);
};

// git rev-parse --verify HEAD^{commit}
export const getHeadCommit = async ({
  repositoryRoot,
}: {
  repositoryRoot: string;
}): Promise<string> => {
  const result = await runGitCommand({
    arguments: ['rev-parse', '--verify', 'HEAD^{commit}'],
    cwd: repositoryRoot,
  });

  return removeFinalLineEnding(result.stdout);
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

// git status --porcelain=v1 --untracked-files=no
export const assertRepositoryTrusted = async ({
  repositoryRoot,
}: {
  repositoryRoot: string;
}): Promise<void> => {
  await runGitCommand({
    arguments: ['status', '--porcelain=v1', '--untracked-files=no'],
    cwd: repositoryRoot,
  });
};
