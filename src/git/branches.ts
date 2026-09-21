import { hasGitExitCode, runGitCommand } from '#git/command.ts';

const branchReference = (branch: string): string => `refs/heads/${branch}`;

// git show-ref --verify --quiet refs/heads/<branch>
export const branchExists = async ({
  repositoryRoot,
  branch,
}: {
  repositoryRoot: string;
  branch: string;
}): Promise<boolean> => {
  try {
    await runGitCommand({
      arguments: ['show-ref', '--verify', '--quiet', branchReference(branch)],
      cwd: repositoryRoot,
    });
    return true;
  } catch (error) {
    if (hasGitExitCode({ error, exitCode: 1 })) {
      return false;
    }
    throw error;
  }
};

// git show-ref --verify --quiet refs/heads/<branch>
// git branch <branch> <start-point>
export const createBranch = async ({
  repositoryRoot,
  branch,
  startPoint,
}: {
  repositoryRoot: string;
  branch: string;
  startPoint: string;
}): Promise<void> => {
  if (startPoint.length === 0 || startPoint.includes('\0')) {
    throw new Error('Branch start point must be non-empty.');
  }
  if (await branchExists({ repositoryRoot, branch })) {
    throw new Error(`Branch already exists: ${branch}.`);
  }

  await runGitCommand({
    arguments: ['branch', branch, startPoint],
    cwd: repositoryRoot,
  });
};

// git show-ref --verify --quiet refs/heads/<branch>
// git merge-base --is-ancestor <branch> <target>
// git rev-parse --verify <target>^{commit}
// git rev-parse --verify <branch>^{commit}
// git update-ref refs/heads/<branch> <target-commit> <branch-commit>
export const fastForwardBranch = async ({
  repositoryRoot,
  branch,
  target,
}: {
  repositoryRoot: string;
  branch: string;
  target: string;
}): Promise<void> => {
  if (target.length === 0 || target.includes('\0')) {
    throw new Error('Fast-forward target must be non-empty.');
  }
  if (!(await branchExists({ repositoryRoot, branch }))) {
    throw new Error(`Branch does not exist: ${branch}.`);
  }

  try {
    await runGitCommand({
      arguments: ['merge-base', '--is-ancestor', branch, target],
      cwd: repositoryRoot,
    });
  } catch (error) {
    if (hasGitExitCode({ error, exitCode: 1 })) {
      throw new Error(
        `Cannot fast-forward ${branch}: it is not an ancestor of ${target}.`,
      );
    }
    throw error;
  }

  const [targetResult, branchResult] = await Promise.all([
    runGitCommand({
      arguments: ['rev-parse', '--verify', `${target}^{commit}`],
      cwd: repositoryRoot,
    }),
    runGitCommand({
      arguments: ['rev-parse', '--verify', `${branch}^{commit}`],
      cwd: repositoryRoot,
    }),
  ]);
  const targetCommit = targetResult.stdout.trim();
  const branchCommit = branchResult.stdout.trim();

  await runGitCommand({
    arguments: [
      'update-ref',
      branchReference(branch),
      targetCommit,
      branchCommit,
    ],
    cwd: repositoryRoot,
  });
};

// git show-ref --verify --quiet refs/heads/<branch>
// git branch --delete <branch>
export const deleteBranch = async ({
  repositoryRoot,
  branch,
}: {
  repositoryRoot: string;
  branch: string;
}): Promise<void> => {
  if (!(await branchExists({ repositoryRoot, branch }))) {
    return;
  }

  await runGitCommand({
    arguments: ['branch', '--delete', branch],
    cwd: repositoryRoot,
  });
};
