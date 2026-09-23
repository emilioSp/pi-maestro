/**
 * Objective: Create a workflow worktree at a safe empty path.
 * Used: When Maestro launches a builder or verifier.
 * Entrypoint: createWorktree().
 */

import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { runGitCommand } from '#git/command.ts';
import { findWorktree } from '#git/worktrees/findWorktree.ts';
import { pathExists } from '#utils/path-exists.ts';

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
