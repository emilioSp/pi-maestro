/**
 * Objective: Prepare a verifier run transition in the project directory.
 * Used: When Maestro starts a verifier pass.
 */

import type { MaestroPaths } from '#MaestroPaths.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_EVENTS, WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';

export type VerifierRun = {
  specId: string;
  projectRoot: string;
};

type PrepareVerifierRunInput = {
  paths: MaestroPaths;
  specId: string;
};

export const prepareVerifierRun = async ({
  paths,
  specId,
}: PrepareVerifierRunInput): Promise<VerifierRun> => {
  const projectRoot = paths.getProjectRoot();
  const workflowPath = paths.getWorkflowPath(specId);
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

  const nextState = transitionWorkflow({
    state: currentState,
    event: WORKFLOW_EVENTS.RUN_VERIFIER,
  });

  await writeWorkflowState({
    path: workflowPath,
    state: nextState,
  });

  return {
    specId,
    projectRoot,
  };
};
