/**
 * Objective: List staged paths.
 * Used: When Maestro checks the exact paths staged for a checkpoint.
 * Entrypoint: getStagedPaths().
 */

import { runGitCommand } from '#git/command.ts';

// Parses Git's NUL-delimited path output.
const parsePaths = (output: string): readonly string[] =>
  output.split('\0').filter((path) => path.length > 0);

// Lists the paths currently staged for commit.
// git diff --cached --name-only -z
export const getStagedPaths = async ({
  repositoryRoot,
}: {
  repositoryRoot: string;
}): Promise<readonly string[]> => {
  const result = await runGitCommand({
    arguments: ['diff', '--cached', '--name-only', '-z'],
    cwd: repositoryRoot,
  });
  return parsePaths(result.stdout);
};
