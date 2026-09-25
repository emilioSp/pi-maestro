/**
 * Objective: Prepare a committed verifier launch checkpoint in the current checkout.
 * Used: When Maestro starts a verifier pass.
 */

import { rm } from 'node:fs/promises';
import { createCommit } from '#git/commits/createCommit.ts';
import { getParentCommit } from '#git/history/getParentCommit.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import { pathExists } from '#utils/path-exists.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_EVENTS, WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';

export type VerifierLaunch = {
  specId: string;
  repositoryRoot: string;
  candidateCommit: string;
  checkpointCommit: string;
  revision: number;
};

export const prepareVerifierLaunch = async ({
  paths,
  specId,
}: {
  paths: MaestroPaths;
  specId: string;
}): Promise<VerifierLaunch> => {
  const repositoryRoot = paths.getRepositoryRoot();
  const workflowPath = paths.getWorkflowPath(specId);
  const handoffPath = paths.getVerifierHandoffPath(specId);
  const currentState = await readWorkflowState({ path: workflowPath });

  if (currentState.specId !== specId) {
    throw new Error(
      `Workflow spec ID mismatch: expected "${specId}", found "${currentState.specId}".`,
    );
  }

  if (currentState.phase !== WORKFLOW_PHASES.READY_FOR_VERIFIER) {
    throw new Error(
      `Verifier launch requires ready-for-verifier state, found "${currentState.phase}".`,
    );
  }

  const status = await getRepositoryStatus({ repositoryRoot });

  if (!status.clean) {
    throw new Error(
      'Verifier launch requires a committed ready-for-verifier candidate.',
    );
  }

  const nextState = transitionWorkflow({
    state: currentState,
    event: WORKFLOW_EVENTS.LAUNCH_VERIFIER,
  });
  const handoffExists = await pathExists(handoffPath);

  if (handoffExists) {
    await rm(handoffPath);
  }

  await writeWorkflowState({
    path: workflowPath,
    state: nextState,
    currentRevision: currentState.revision,
  });

  const expectedPaths = [workflowPath];

  if (handoffExists) {
    expectedPaths.push(handoffPath);
  }

  const previousHead = await getHeadCommit({ repositoryRoot });

  const checkpointCommit = await createCommit({
    repositoryRoot,
    expectedPaths,
  });

  const candidateCommit = await getParentCommit({
    repositoryRoot,
    commit: checkpointCommit,
  });

  if (candidateCommit !== previousHead) {
    throw new Error(
      'Verifier candidate changed while creating its checkpoint.',
    );
  }

  return {
    specId,
    repositoryRoot,
    candidateCommit,
    checkpointCommit,
    revision: nextState.revision,
  };
};
