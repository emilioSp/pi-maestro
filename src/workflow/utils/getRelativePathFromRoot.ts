/**
 * Objective: Get a path relative to a root without leaving that root.
 * Used: When workflow operations map protocol files into a worktree.
 * Entrypoint: getRelativePathFromRoot().
 */

import { relative } from 'node:path';

export const getRelativePathFromRoot = ({
  root,
  target,
}: {
  root: string;
  target: string;
}): string => {
  const value = relative(root, target);
  if (value.length === 0 || value === '..' || value.startsWith('../')) {
    throw new Error(`Path is outside the expected root: ${target}.`);
  }
  return value;
};
