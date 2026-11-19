/**
 * Objective: Set up temporary projects and explicitly initialize Git when a test needs it.
 * Used: In tests that need isolated file system artifacts.
 */

import { execFile } from 'node:child_process';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const initTestGitRepository = async (path: string): Promise<void> => {
  await execFileAsync('git', ['init', '-q', path]);
};

export const createTemporaryProject = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pi-maestro-'));

  return {
    path: await realpath(directory),
    cleanup: async () => {
      await rm(directory, { force: true, recursive: true });
    },
  };
};
