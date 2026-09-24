/**
 * Objective: List and parse Git worktrees.
 * Used: When Maestro discovers registered worktrees.
 */

import { runGitCommand } from '#git/command.ts';

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
