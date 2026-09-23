/**
 * Objective: Check whether a branch can advance without merging.
 * Used: When Maestro checks if a branch can advance.
 * Entrypoint: canFastForward().
 */

import { isAncestor } from '#git/history/isAncestor.ts';

// Checks whether a branch can advance to a target without merging.
// git merge-base --is-ancestor <branch> <target>
export const canFastForward = async ({
  repositoryRoot,
  branch,
  target,
}: {
  repositoryRoot: string;
  branch: string;
  target: string;
}): Promise<boolean> =>
  isAncestor({ repositoryRoot, ancestor: branch, descendant: target });
