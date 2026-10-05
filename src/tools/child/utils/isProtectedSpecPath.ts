/**
 * Objective: Identify paths that resolve to the protected workflow spec.
 * Used: Before child write and edit tools run.
 */

import { lstat, realpath } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { isErrnoException } from '#utils/is-errno-exception.ts';

const resolveThroughExistingParent = async (path: string): Promise<string> => {
  const unresolvedParts: string[] = [];
  let currentPath = path;

  while (true) {
    try {
      await lstat(currentPath);

      const existingPath = await realpath(currentPath);

      return resolve(existingPath, ...unresolvedParts);
    } catch (error) {
      if (!isErrnoException(error) || error.code !== 'ENOENT') {
        throw error;
      }

      const parentPath = dirname(currentPath);

      if (parentPath === currentPath) {
        throw new Error(`Cannot resolve path "${path}".`);
      }

      unresolvedParts.unshift(basename(currentPath));
      currentPath = parentPath;
    }
  }
};

type IsProtectedSpecPathInput = {
  repositoryRoot: string;
  specPath: string;
  targetPath: string;
};

export const isProtectedSpecPath = async ({
  repositoryRoot,
  specPath,
  targetPath,
}: IsProtectedSpecPathInput): Promise<boolean> => {
  const pathWithoutPrefix = targetPath.startsWith('@')
    ? targetPath.slice(1)
    : targetPath;

  const resolvedTargetPath = resolve(repositoryRoot, pathWithoutPrefix);

  const [resolvedSpecPath, resolvedTarget] = await Promise.all([
    resolveThroughExistingParent(specPath),
    resolveThroughExistingParent(resolvedTargetPath),
  ]);

  return resolvedTarget === resolvedSpecPath;
};
