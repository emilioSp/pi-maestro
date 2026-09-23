/**
 * Objective: Create a clean verifier worktree and commit its running checkpoint.
 * Used: When Maestro starts an independent verifier pass.
 * Entrypoint: prepareVerifierLaunch().
 */

import { branchExists, createBranch } from '#git/branches.ts';
import { createCommit } from '#git/commits.ts';
import { getHeadCommit, getRepositoryStatus } from '#git/repository.ts';
import { createWorktree, findWorktree } from '#git/worktrees.ts';
import type { GetMaestroPaths } from '#paths.ts';
import { pathExists } from '#utils/path-exists.ts';
import { WORKFLOW_EVENTS, WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import {
  readWorkflowState,
  writeWorkflowState,
} from '#workflow/state/store.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';
import { assertWorktree, getPath, relativePath } from '#workflow/utils.ts';

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

  const builderWorkflowPath = getPath({
    paths,
    worktreePath: builderWorktreePath,
    target: paths.getWorkflowPath(specId),
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

  const workflowPath = getPath({
    paths,
    worktreePath,
    target: paths.getWorkflowPath(specId),
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
    expectedPaths: [relativePath({ root: worktreePath, target: workflowPath })],
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
