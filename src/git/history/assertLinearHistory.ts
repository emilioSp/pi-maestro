/**
 * Objective: Reject divergent or unrelated commit histories.
 * Used: When Maestro accepts a workflow branch history.
 */

import { getMergeBase } from '#git/history/getMergeBase.ts';
import { isAncestor } from '#git/history/isAncestor.ts';

// Rejects a branch that is unrelated to or diverges from its base.
// git merge-base <base> <branch>
// git merge-base --is-ancestor <base> <branch>
export const assertLinearHistory = async ({
  repositoryRoot,
  base,
  branch,
}: {
  repositoryRoot: string;
  base: string;
  branch: string;
}): Promise<void> => {
  const mergeBase = await getMergeBase({
    repositoryRoot,
    first: base,
    second: branch,
  });
  if (!mergeBase) {
    throw new Error(`Refusing unrelated histories: ${base} and ${branch}.`);
  }
  if (
    !(await isAncestor({ repositoryRoot, ancestor: base, descendant: branch }))
  ) {
    throw new Error(`Refusing divergent histories: ${base} and ${branch}.`);
  }
};
