/**
 * Objective: Find a commit by its exact subject.
 * Used: When Maestro finds a checkpoint by its subject.
 * Entrypoint: findCommitByMessage().
 */

import { runGitCommand } from '#git/command.ts';

// Finds a commit whose subject exactly matches the given message.
// git log --all --format=%H%x00%s --fixed-strings --grep=<message>
export const findCommitByMessage = async ({
  repositoryRoot,
  message,
}: {
  repositoryRoot: string;
  message: string;
}): Promise<string | undefined> => {
  const result = await runGitCommand({
    arguments: [
      'log',
      '--all',
      '--format=%H%x00%s',
      '--fixed-strings',
      `--grep=${message}`,
    ],
    cwd: repositoryRoot,
  });

  for (const line of result.stdout.split(/\r?\n/)) {
    const [commit, subject] = line.split('\0');
    if (subject === message) {
      return commit;
    }
  }
  return undefined;
};
