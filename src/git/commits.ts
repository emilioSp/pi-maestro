import { runGitCommand } from '#git/command.ts';
import { getCurrentBranch } from '#git/repository.ts';
import { WORKFLOW_ROLES } from '#paths.ts';

export const CHECKPOINT_COMMIT_MESSAGE = 'maestro checkpoint';

// Parses Git's NUL-delimited path output.
const parsePaths = (output: string): readonly string[] =>
  output.split('\0').filter((path) => path.length > 0);

// Checks that staging contains exactly the expected paths.
const hasSamePaths = ({
  actual,
  expected,
}: {
  actual: readonly string[];
  expected: readonly string[];
}): boolean => {
  if (actual.length !== expected.length) {
    return false;
  }
  return actual.every((path) => expected.includes(path));
};

// Identifies branches managed by the Maestro workflow.
const isWorkflowBranch = (branch: string): boolean =>
  branch.startsWith(`${WORKFLOW_ROLES.BUILDER}/`) ||
  branch.startsWith(`${WORKFLOW_ROLES.VERIFIER}/`);

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

// Creates a commit after staging exactly the expected workflow paths.
// git symbolic-ref --quiet --short HEAD
// git add -- <path>...
// git diff --cached --name-only -z
// git commit --message <message>
// git rev-parse --verify HEAD^{commit}
export const createCommit = async ({
  repositoryRoot,
  expectedPaths,
  message = CHECKPOINT_COMMIT_MESSAGE,
}: {
  repositoryRoot: string;
  expectedPaths: readonly string[];
  message?: string;
}): Promise<string> => {
  const branch = await getCurrentBranch({ repositoryRoot });
  if (!isWorkflowBranch(branch)) {
    throw new Error(
      `Refusing to create a checkpoint on non-workflow branch: ${branch}.`,
    );
  }

  await runGitCommand({
    arguments: ['add', '--', ...expectedPaths],
    cwd: repositoryRoot,
  });
  const stagedPaths = await getStagedPaths({ repositoryRoot });
  if (!hasSamePaths({ actual: stagedPaths, expected: expectedPaths })) {
    throw new Error('Checkpoint has staged paths outside the expected set.');
  }

  await runGitCommand({
    arguments: ['commit', '--message', message],
    cwd: repositoryRoot,
  });
  const result = await runGitCommand({
    arguments: ['rev-parse', '--verify', 'HEAD^{commit}'],
    cwd: repositoryRoot,
  });
  return result.stdout.trim();
};

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
