/**
 * Objective: Reject changes to builder protocol artifacts after launch.
 * Used: Before a builder tool writes a terminal workflow artifact.
 */

import { relative } from 'node:path';
import { runGitCommand } from '#git/command.ts';
import { CHECKPOINT_COMMIT_MESSAGE } from '#git/commits/createCommit.ts';
import type { GetMaestroPaths } from '#paths.ts';

// git log --format=%H%x00%s --fixed-strings --grep=<checkpoint-message> HEAD
const getBuilderCheckpoint = async ({
  worktreePath,
}: {
  worktreePath: string;
}): Promise<string> => {
  const result = await runGitCommand({
    arguments: [
      'log',
      '--format=%H%x00%s',
      '--fixed-strings',
      `--grep=${CHECKPOINT_COMMIT_MESSAGE}`,
      'HEAD',
    ],
    cwd: worktreePath,
  });

  for (const line of result.stdout.split(/\r?\n/)) {
    const [commit, subject] = line.split('\0');

    if (subject === CHECKPOINT_COMMIT_MESSAGE) {
      return commit;
    }
  }

  throw new Error('Builder launch checkpoint was not found in Git history.');
};

// git diff --no-renames --name-only -z <checkpoint> -- <spec-path>
// git diff --cached --no-renames --name-only -z <checkpoint> -- <spec-path>
// git ls-files --others --exclude-standard -z -- <spec-path>
export const assertBuilderProtocolUnchanged = async ({
  paths,
  specId,
}: {
  paths: GetMaestroPaths;
  specId: string;
}): Promise<void> => {
  const worktreePath = paths.repositoryRoot;
  const checkpoint = await getBuilderCheckpoint({ worktreePath });
  const specPath = relative(worktreePath, paths.getSpecPath(specId));

  const [workingDiff, stagedDiff, untrackedFiles] = await Promise.all([
    runGitCommand({
      arguments: [
        'diff',
        '--no-renames',
        '--name-only',
        '-z',
        checkpoint,
        '--',
        specPath,
      ],
      cwd: worktreePath,
    }),
    runGitCommand({
      arguments: [
        'diff',
        '--cached',
        '--no-renames',
        '--name-only',
        '-z',
        checkpoint,
        '--',
        specPath,
      ],
      cwd: worktreePath,
    }),
    runGitCommand({
      arguments: [
        'ls-files',
        '--others',
        '--exclude-standard',
        '-z',
        '--',
        specPath,
      ],
      cwd: worktreePath,
    }),
  ]);

  const changedPath = [
    workingDiff.stdout,
    stagedDiff.stdout,
    untrackedFiles.stdout,
  ]
    .flatMap((output) => output.split('\0'))
    .find((path) => path.length > 0);

  if (changedPath !== undefined) {
    throw new Error(
      `Builder changed a protected workflow file after launch: "${changedPath}".`,
    );
  }
};
