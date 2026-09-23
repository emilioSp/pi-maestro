/**
 * Objective: Find the repository root from a working directory.
 * Used: When Maestro discovers the Git root from a working directory.
 */

import { realpath } from 'node:fs/promises';
import { runGitCommand } from '#git/command.ts';

// git rev-parse --path-format=absolute --show-toplevel
export const findRepositoryRoot = async ({
  cwd = process.cwd(),
}: {
  cwd?: string;
} = {}): Promise<string> => {
  const result = await runGitCommand({
    arguments: ['rev-parse', '--path-format=absolute', '--show-toplevel'],
    cwd,
  });

  return realpath(result.stdout.replace(/\r?\n$/, ''));
};
