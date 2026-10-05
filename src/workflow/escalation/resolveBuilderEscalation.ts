/**
 * Objective: Resolve the current builder escalation and checkpoint the decision.
 * Used: When the owner keeps the approved contract and makes a decision.
 */

import { readEscalationHistory } from '#artifacts/escalation/readEscalationHistory.ts';
import { resolveEscalation } from '#artifacts/escalation/resolveEscalation.ts';
import type {
  Escalation,
  EscalationResolution,
} from '#artifacts/escalation/schema.ts';
import { createWorkflowCheckpointCommit } from '#git/commits/createWorkflowCheckpointCommit.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import {
  WORKFLOW_EVENTS,
  WORKFLOW_PHASES,
  type WorkflowState,
} from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';

export type ResolvedBuilderEscalation = {
  escalation: Escalation;
  state: WorkflowState;
  repositoryRoot: string;
  checkpointCommit: string;
};

type AssertCurrentEscalationInput<CurrentEscalation = Escalation | undefined> =
  {
    currentEscalation: CurrentEscalation;
    escalationId: string;
  };

function assertCurrentEscalation(
  input: AssertCurrentEscalationInput,
): asserts input is AssertCurrentEscalationInput<Escalation> {
  const { currentEscalation, escalationId } = input;

  if (currentEscalation === undefined) {
    throw new Error('There is no escalation to solve.');
  }

  if (currentEscalation.id !== escalationId) {
    throw new Error(
      `Only the current escalation can be resolved: expected "${currentEscalation.id}", found "${escalationId}".`,
    );
  }

  if (currentEscalation.resolution !== null) {
    throw new Error(`Escalation "${escalationId}" is already resolved.`);
  }
}

type ResolveBuilderEscalationInput = {
  paths: MaestroPaths;
  specId: string;
  escalationId: string;
  resolution: EscalationResolution;
};

export const resolveBuilderEscalation = async ({
  paths,
  specId,
  escalationId,
  resolution,
}: ResolveBuilderEscalationInput): Promise<ResolvedBuilderEscalation> => {
  const workflowPath = paths.getWorkflowPath(specId);
  const escalationsPath = paths.getEscalationsPath(specId);
  const currentState = await readWorkflowState(workflowPath);

  if (currentState.phase !== WORKFLOW_PHASES.ESCALATION_DECISION) {
    throw new Error(
      `Escalation resolution requires escalation-decision state, found "${currentState.phase}".`,
    );
  }

  const history = await readEscalationHistory({
    directory: escalationsPath,
    specId,
    currentRevision: currentState.revision,
  });

  const escalationInput = { currentEscalation: history.at(-1), escalationId };
  assertCurrentEscalation(escalationInput);
  const { currentEscalation } = escalationInput;

  const nextState = transitionWorkflow({
    state: currentState,
    event: WORKFLOW_EVENTS.RESOLVE_ESCALATION,
  });

  const escalationPath = paths.getEscalationPath({
    specId,
    escalationNumber: Number(currentEscalation.id.slice(1)),
  });

  const resolvedEscalation = await resolveEscalation({
    path: escalationPath,
    specId,
    revision: nextState.revision,
    resolution,
  });

  await writeWorkflowState({
    path: workflowPath,
    state: nextState,
    currentRevision: currentState.revision,
  });

  const checkpointCommit = await createWorkflowCheckpointCommit({
    repositoryRoot: paths.getRepositoryRoot(),
    expectedPaths: [workflowPath, escalationPath],
  });

  return {
    escalation: resolvedEscalation,
    state: nextState,
    repositoryRoot: paths.getRepositoryRoot(),
    checkpointCommit,
  };
};
