import { hasGitExitCode, runGitCommand } from '#git/command.ts';

// Checks whether one commit is reachable from another.
// git merge-base --is-ancestor <ancestor> <descendant>
export const isAncestor = async ({
  repositoryRoot,
  ancestor,
  descendant,
}: {
  repositoryRoot: string;
  ancestor: string;
  descendant: string;
}): Promise<boolean> => {
  try {
    await runGitCommand({
      arguments: ['merge-base', '--is-ancestor', ancestor, descendant],
      cwd: repositoryRoot,
    });
    return true;
  } catch (error) {
    if (hasGitExitCode({ error, exitCode: 1 })) {
      // git returns exit 1 to say "no"
      return false;
    }
    throw error;
  }
};

// Gets a commit's direct parent.
// git rev-parse --verify <commit>^
export const getParentCommit = async ({
  repositoryRoot,
  commit,
}: {
  repositoryRoot: string;
  commit: string;
}): Promise<string> => {
  const result = await runGitCommand({
    arguments: ['rev-parse', '--verify', `${commit}^`],
    cwd: repositoryRoot,
  });
  return result.stdout.trim();
};

// Gets the shared ancestor of two histories, if one exists.
// git merge-base <first> <second>
export const getMergeBase = async ({
  repositoryRoot,
  first,
  second,
}: {
  repositoryRoot: string;
  first: string;
  second: string;
}): Promise<string | undefined> => {
  try {
    const result = await runGitCommand({
      arguments: ['merge-base', first, second],
      cwd: repositoryRoot,
    });
    return result.stdout.trim();
  } catch (error) {
    if (hasGitExitCode({ error, exitCode: 1 })) {
      return undefined;
    }
    throw error;
  }
};

// Checks whether a branch can advance to a target without merging.
// git merge-base --is-ancestor <branch> <target>
export const canFastForward = async ({
  repositoryRoot,
  branch,
  target,
}: {
  repositoryRoot: string;
  branch: string;
  target: string;
}): Promise<boolean> =>
  isAncestor({ repositoryRoot, ancestor: branch, descendant: target });

// Rejects a branch that is unrelated to or diverges from its base.
// git merge-base <base> <branch>
// git merge-base --is-ancestor <base> <branch>
export const assertLinearHistory = async ({
  repositoryRoot,
  base,
  branch,
}: {
  repositoryRoot: string;
  base: string;
  branch: string;
}): Promise<void> => {
  const mergeBase = await getMergeBase({
    repositoryRoot,
    first: base,
    second: branch,
  });
  if (!mergeBase) {
    throw new Error(`Refusing unrelated histories: ${base} and ${branch}.`);
  }
  if (
    !(await isAncestor({ repositoryRoot, ancestor: base, descendant: branch }))
  ) {
    throw new Error(`Refusing divergent histories: ${base} and ${branch}.`);
  }
};
