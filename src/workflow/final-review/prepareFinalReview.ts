/**
 * Objective: Conclude a verified workflow on the current branch for Pull Request delivery.
 * Used: When the owner requests final review preparation.
 */

import { readVerifierHandoff } from '#artifacts/verifier-handoff/readVerifierHandoff.ts';
import { createCommit } from '#git/commits/createCommit.ts';
import { getCurrentBranch } from '#git/repository/getCurrentBranch.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_EVENTS, WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';

export type FinalReviewResult = {
  currentBranch: string;
  candidateCommit: string;
  finalReviewCommit: string;
  phase: typeof WORKFLOW_PHASES.FINAL_REVIEW;
  pullRequestGuidance: string;
};

export const prepareFinalReview = async ({
  paths,
  specId,
}: {
  paths: MaestroPaths;
  specId: string;
}): Promise<FinalReviewResult> => {
  const repositoryRoot = paths.getRepositoryRoot();
  const workflowPath = paths.getWorkflowPath(specId);
  const handoffPath = paths.getVerifierHandoffPath(specId);
  const currentState = await readWorkflowState({ path: workflowPath });

  if (currentState.specId !== specId) {
    throw new Error(
      `Workflow spec ID mismatch: expected "${specId}", found "${currentState.specId}".`,
    );
  }

  if (currentState.phase !== WORKFLOW_PHASES.CANDIDATE_READY) {
    throw new Error(
      `Final review requires candidate-ready state, found "${currentState.phase}".`,
    );
  }

  const handoff = await readVerifierHandoff({
    path: handoffPath,
    specId,
    revision: currentState.revision,
  });

  if (handoff.findings.some(({ rejection }) => rejection === null)) {
    throw new Error(
      'Candidate contains verifier findings that were not rejected.',
    );
  }

  const status = await getRepositoryStatus({ repositoryRoot });

  if (!status.clean) {
    throw new Error('Final review requires a clean current checkout.');
  }

  const currentBranch = await getCurrentBranch({ repositoryRoot });
  const candidateCommit = await getHeadCommit({ repositoryRoot });
  const nextState = transitionWorkflow({
    state: currentState,
    event: WORKFLOW_EVENTS.PREPARE_FINAL_REVIEW,
  });

  await writeWorkflowState({
    path: workflowPath,
    state: nextState,
    currentRevision: currentState.revision,
  });

  const finalReviewCommit = await createCommit({
    repositoryRoot,
    expectedPaths: [workflowPath],
    message: WORKFLOW_PHASES.FINAL_REVIEW,
  });

  return {
    currentBranch,
    candidateCommit,
    finalReviewCommit,
    phase: WORKFLOW_PHASES.FINAL_REVIEW,
    pullRequestGuidance:
      'Open a Pull Request from the current branch. Maestro does not push, merge, or choose the merge method. Squash merge is recommended to remove intermediate commits and keep the history clean',
  };
};
