/**
 * Objective: Create a temporary project without Git.
 * Used: In tests that need isolated file system artifacts.
 */

import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const createTemporaryProject = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pi-maestro-'));

  return {
    path: await realpath(directory),
    cleanup: async () => {
      await rm(directory, { force: true, recursive: true });
    },
  };
};
