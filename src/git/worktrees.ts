/**
 * Objective: Create, find, list, and remove Git worktrees.
 * Used: When builders and verifiers need isolated work directories.
 * Entrypoint: createWorktree().
 */

import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { runGitCommand } from '#git/command.ts';
import { getRepositoryStatus } from '#git/repository.ts';
import { pathExists } from '#utils/path-exists.ts';
import { isStrictlyInside } from '#utils/path-security.ts';

export type Worktree = {
  path: string;
  head: string;
  branch: string | null;
  bare: boolean;
};

const parseWorktrees = (output: string): Worktree[] => {
  const worktrees: Worktree[] = [];
  let current: Partial<Worktree> | undefined;

  for (const line of output.split(/\r?\n/)) {
    if (line.length === 0) {
      if (current?.path && current.head) {
        worktrees.push({
          path: current.path,
          head: current.head,
          branch: current.branch ?? null,
          bare: current.bare ?? false,
        });
      }
      current = undefined;
      continue;
    }

    const separator = line.indexOf(' ');
    const key = separator === -1 ? line : line.slice(0, separator);
    const value = separator === -1 ? '' : line.slice(separator + 1);
    if (key === 'worktree') {
      current = { path: value };
    } else if (current && key === 'HEAD') {
      current.head = value;
    } else if (current && key === 'branch') {
      current.branch = value.replace(/^refs\/heads\//, '');
    } else if (current && key === 'bare') {
      current.bare = true;
    }
  }

  if (current?.path && current.head) {
    worktrees.push({
      path: current.path,
      head: current.head,
      branch: current.branch ?? null,
      bare: current.bare ?? false,
    });
  }
  return worktrees;
};

// git worktree list --porcelain
export const listWorktrees = async ({
  repositoryRoot,
}: {
  repositoryRoot: string;
}): Promise<readonly Worktree[]> => {
  const result = await runGitCommand({
    arguments: ['worktree', 'list', '--porcelain'],
    cwd: repositoryRoot,
  });
  return parseWorktrees(result.stdout);
};

// git worktree list --porcelain
export const findWorktree = async ({
  repositoryRoot,
  path,
}: {
  repositoryRoot: string;
  path: string;
}): Promise<Worktree | undefined> => {
  const expectedPath = resolve(path);
  const worktrees = await listWorktrees({ repositoryRoot });
  return worktrees.find((worktree) => resolve(worktree.path) === expectedPath);
};

// git worktree list --porcelain
// git worktree add <path> <branch>
export const createWorktree = async ({
  repositoryRoot,
  path,
  branch,
}: {
  repositoryRoot: string;
  path: string;
  branch: string;
}): Promise<void> => {
  if (branch.length === 0 || branch.includes('\0')) {
    throw new Error('Worktree branch must be non-empty.');
  }
  const normalizedPath = resolve(path);
  const registered = await findWorktree({
    repositoryRoot,
    path: normalizedPath,
  });
  const exists = await pathExists(normalizedPath);

  if (registered) {
    throw new Error(`Worktree is already registered at ${normalizedPath}.`);
  }
  if (exists) {
    throw new Error(`Worktree path already exists: ${normalizedPath}.`);
  }

  await mkdir(dirname(normalizedPath), { recursive: true });
  await runGitCommand({
    arguments: ['worktree', 'add', normalizedPath, branch],
    cwd: repositoryRoot,
  });
};

// git worktree list --porcelain
// git status --porcelain=v1 --untracked-files=all -z
// git worktree remove <path>
export const removeWorktree = async ({
  repositoryRoot,
  path,
  branch,
  worktreeDirectory,
}: {
  repositoryRoot: string;
  path: string;
  branch: string;
  worktreeDirectory: string;
}): Promise<void> => {
  const normalizedPath = resolve(path);
  const worktree = await findWorktree({ repositoryRoot, path: normalizedPath });
  if (!worktree) {
    throw new Error(`Worktree is not registered at ${normalizedPath}.`);
  }
  if (worktree.branch !== branch) {
    throw new Error(
      `Refusing to remove worktree at ${normalizedPath}: expected branch ${branch}.`,
    );
  }
  if (
    !isStrictlyInside({
      parent: resolve(worktreeDirectory),
      candidate: normalizedPath,
    })
  ) {
    throw new Error(
      `Refusing to remove worktree outside Maestro directory: ${normalizedPath}.`,
    );
  }

  const status = await getRepositoryStatus({ repositoryRoot: normalizedPath });
  if (!status.clean) {
    throw new Error(`Refusing to remove dirty worktree at ${normalizedPath}.`);
  }

  await runGitCommand({
    arguments: ['worktree', 'remove', normalizedPath],
    cwd: repositoryRoot,
  });
};
