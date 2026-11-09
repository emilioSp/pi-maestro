/**
 * Objective: Check for an existing spec without collecting the directory contents.
 * Used: Before offering the new-or-restart menu during Maestro activation.
 */

import { opendir } from 'node:fs/promises';

import { isValidSpecId } from '#ids/isValidSpecId.ts';
import { isErrnoException } from '#utils/is-errno-exception.ts';

export const hasSpecs = async (specDirectory: string): Promise<boolean> => {
  try {
    for await (const entry of await opendir(specDirectory)) {
      // early return, just check if there is at least 1 spec present in the spec directory
      if (entry.isDirectory() && isValidSpecId(entry.name)) return true;
    }

    // empty dir
    return false;
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') return false;

    throw error;
  }
};
