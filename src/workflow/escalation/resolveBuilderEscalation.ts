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
import { createCommit } from '#git/commits/createCommit.ts';
import type { GetMaestroPaths } from '#paths.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import {
  WORKFLOW_EVENTS,
  WORKFLOW_PHASES,
  type WorkflowState,
} from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';
import { assertWorktree } from '#workflow/utils/assertWorktree.ts';

export type ResolvedBuilderEscalation = {
  escalation: Escalation;
  state: WorkflowState;
  worktreePath: string;
  checkpointCommit: string;
};

function assertCurrentEscalation(
  currentEscalation: Escalation | undefined,
  escalationId: string,
): asserts currentEscalation is Escalation {
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

export const resolveBuilderEscalation = async ({
  paths,
  specId,
  escalationId,
  resolution,
}: {
  paths: GetMaestroPaths;
  specId: string;
  escalationId: string;
  resolution: EscalationResolution;
}): Promise<ResolvedBuilderEscalation> => {
  const builderWorktreePath = paths.getBuilderWorktreePath(specId);
  await assertWorktree({
    repositoryRoot: paths.repositoryRoot,
    branch: paths.getBuilderBranch(specId),
    worktreePath: builderWorktreePath,
  });

  const workflowPath = paths.getWorkflowPathInWorktree({
    specId,
    worktreePath: builderWorktreePath,
  });

  const escalationsPath = paths.getEscalationsPathInWorktree({
    specId,
    worktreePath: builderWorktreePath,
  });

  const currentState = await readWorkflowState({ path: workflowPath });

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

  const currentEscalation = history.at(-1);
  assertCurrentEscalation(currentEscalation, escalationId);

  const nextState = transitionWorkflow({
    state: currentState,
    event: WORKFLOW_EVENTS.RESOLVE_ESCALATION,
  });

  const escalationPath = paths.getEscalationPathInWorktree({
    specId,
    escalationNumber: Number(currentEscalation.id.slice(1)),
    worktreePath: builderWorktreePath,
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

  const checkpointCommit = await createCommit({
    repositoryRoot: builderWorktreePath,
    expectedPaths: [workflowPath, escalationPath],
  });

  return {
    escalation: resolvedEscalation,
    state: nextState,
    worktreePath: builderWorktreePath,
    checkpointCommit,
  };
};
