/**
 * Objective: Create a clean verifier worktree and commit its running checkpoint.
 * Used: When Maestro starts an independent verifier pass.
 * Entrypoint: prepareVerifierLaunch().
 */

import { branchExists } from '#git/branches/branchExists.ts';
import { createBranch } from '#git/branches/createBranch.ts';
import { createCommit } from '#git/commits/createCommit.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
import { createWorktree } from '#git/worktrees/createWorktree.ts';
import { findWorktree } from '#git/worktrees/findWorktree.ts';
import type { GetMaestroPaths } from '#paths.ts';
import { pathExists } from '#utils/path-exists.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_EVENTS, WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';
import { assertWorktree } from '#workflow/utils/assertWorktree.ts';
import { getRelativePathFromRoot } from '#workflow/utils/getRelativePathFromRoot.ts';

export type VerifierLaunch = {
  specId: string;
  pass: number;
  branch: string;
  worktreePath: string;
  candidateCommit: string;
  checkpointCommit: string;
  revision: number;
};

const getNextPass = async ({
  paths,
  specId,
}: {
  paths: GetMaestroPaths;
  specId: string;
}): Promise<number> => {
  let pass = 1;
  while (true) {
    const branch = paths.getVerifierBranch({ specId, pass });
    const worktreePath = paths.getVerifierWorktreePath({ specId, pass });
    const [hasBranch, worktree, hasPath] = await Promise.all([
      branchExists({ repositoryRoot: paths.repositoryRoot, branch }),
      findWorktree({
        repositoryRoot: paths.repositoryRoot,
        path: worktreePath,
      }),
      pathExists(worktreePath),
    ]);
    if (!hasBranch && worktree === undefined && !hasPath) {
      return pass;
    }
    if (!hasBranch || worktree === undefined || !hasPath) {
      throw new Error('Verifier resources are incomplete or already in use.');
    }
    pass += 1;
    if (!Number.isSafeInteger(pass)) {
      throw new Error('Verifier pass number exceeded the safe integer range.');
    }
  }
};

export const prepareVerifierLaunch = async ({
  paths,
  specId,
}: {
  paths: GetMaestroPaths;
  specId: string;
}): Promise<VerifierLaunch> => {
  const builderWorktreePath = paths.getBuilderWorktreePath(specId);
  await assertWorktree({
    repositoryRoot: paths.repositoryRoot,
    branch: paths.getBuilderBranch(specId),
    worktreePath: builderWorktreePath,
  });

  const builderWorkflowPath = paths.getWorkflowPathInWorktree({
    specId,
    worktreePath: builderWorktreePath,
  });

  const builderState = await readWorkflowState({ path: builderWorkflowPath });
  if (builderState.phase !== WORKFLOW_PHASES.READY_FOR_VERIFIER) {
    throw new Error(
      `Verifier launch requires ready-for-verifier state, found "${builderState.phase}".`,
    );
  }
  const builderStatus = await getRepositoryStatus({
    repositoryRoot: builderWorktreePath,
  });
  if (!builderStatus.clean) {
    throw new Error(
      'Verifier launch requires a committed ready-for-verifier candidate.',
    );
  }
  const candidateCommit = await getHeadCommit({
    repositoryRoot: builderWorktreePath,
  });
  const pass = await getNextPass({ paths, specId });
  const verifierBranch = paths.getVerifierBranch({ specId, pass });
  const worktreePath = paths.getVerifierWorktreePath({ specId, pass });

  await createBranch({
    repositoryRoot: paths.repositoryRoot,
    branch: verifierBranch,
    startPoint: candidateCommit,
  });
  await createWorktree({
    repositoryRoot: paths.repositoryRoot,
    path: worktreePath,
    branch: verifierBranch,
  });

  const workflowPath = paths.getWorkflowPathInWorktree({
    specId,
    worktreePath,
  });
  const currentState = await readWorkflowState({ path: workflowPath });
  if (currentState.phase !== WORKFLOW_PHASES.READY_FOR_VERIFIER) {
    throw new Error(
      `Verifier launch requires ready-for-verifier state, found "${currentState.phase}".`,
    );
  }
  const nextState = transitionWorkflow({
    state: currentState,
    event: WORKFLOW_EVENTS.LAUNCH_VERIFIER,
  });
  await writeWorkflowState({
    path: workflowPath,
    state: nextState,
    currentRevision: currentState.revision,
  });
  const checkpointCommit = await createCommit({
    repositoryRoot: worktreePath,
    expectedPaths: [
      getRelativePathFromRoot({ root: worktreePath, target: workflowPath }),
    ],
  });

  return {
    specId,
    pass,
    branch: verifierBranch,
    worktreePath,
    candidateCommit,
    checkpointCommit,
    revision: nextState.revision,
  };
};
