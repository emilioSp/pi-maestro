/**
 * Objective: Check whether a filesystem path exists.
 * Used: Before Maestro reads, creates, or removes files and directories.
 */

import { access } from 'node:fs/promises';

export const pathExists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
};
