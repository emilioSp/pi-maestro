/**
 * Objective: Prepare a committed verifier run checkpoint in the current checkout.
 * Used: When Maestro starts a verifier pass.
 */

import { rm } from 'node:fs/promises';
import { createWorkflowCheckpointCommit } from '#git/commits/createWorkflowCheckpointCommit.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import { pathExists } from '#utils/path-exists.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_EVENTS, WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';

export type VerifierRun = {
  specId: string;
  repositoryRoot: string;
  candidateCommit: string;
  checkpointCommit: string;
  revision: number;
};

type PrepareVerifierRunInput = {
  paths: MaestroPaths;
  specId: string;
};

export const prepareVerifierRun = async ({
  paths,
  specId,
}: PrepareVerifierRunInput): Promise<VerifierRun> => {
  const repositoryRoot = paths.getRepositoryRoot();
  const workflowPath = paths.getWorkflowPath(specId);
  const handoffPath = paths.getVerifierHandoffPath(specId);
  const currentState = await readWorkflowState(workflowPath);

  if (currentState.specId !== specId) {
    throw new Error(
      `Workflow spec ID mismatch: expected "${specId}", found "${currentState.specId}".`,
    );
  }

  if (currentState.phase !== WORKFLOW_PHASES.READY_FOR_VERIFIER) {
    throw new Error(
      `Verifier run requires ready-for-verifier state, found "${currentState.phase}".`,
    );
  }

  const status = await getRepositoryStatus(repositoryRoot);

  if (!status.clean) {
    throw new Error(
      'Verifier run requires a committed ready-for-verifier candidate.',
    );
  }

  const nextState = transitionWorkflow({
    state: currentState,
    event: WORKFLOW_EVENTS.RUN_VERIFIER,
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

  const checkpointCommit = await createWorkflowCheckpointCommit({
    repositoryRoot,
    expectedPaths,
  });

  maestroSessionState.setVerifierCheckpointCommit(checkpointCommit);

  return {
    specId,
    repositoryRoot,
    candidateCommit: checkpointCommit,
    checkpointCommit,
    revision: nextState.revision,
  };
};
