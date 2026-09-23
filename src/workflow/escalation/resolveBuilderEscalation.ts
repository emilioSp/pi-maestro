/**
 * Objective: Resolve the current builder escalation and checkpoint the decision.
 * Used: When the owner keeps the approved contract and makes a decision.
 * Entrypoint: resolveBuilderEscalation().
 */

import {
  type Escalation,
  type EscalationResolution,
  readEscalationHistory,
  resolveEscalation,
} from '#artifacts/escalation.ts';
import { createCommit } from '#git/commits.ts';
import type { GetMaestroPaths } from '#paths.ts';
import {
  getBuilderEscalationPath,
  getBuilderEscalationsPath,
} from '#workflow/escalation/utils.ts';
import {
  WORKFLOW_EVENTS,
  WORKFLOW_PHASES,
  type WorkflowState,
} from '#workflow/state/schema.ts';
import {
  readWorkflowState,
  writeWorkflowState,
} from '#workflow/state/store.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';
import { getPath, relativePath, validateWorktree } from '#workflow/utils.ts';

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
  const builderWorktree = await validateWorktree({
    repositoryRoot: paths.repositoryRoot,
    branch: paths.getBuilderBranch(specId),
    worktreePath: paths.getBuilderWorktreePath(specId),
  });

  const workflowPath = getPath({
    paths,
    worktreePath: builderWorktree.worktreePath,
    target: paths.getWorkflowPath(specId),
  });

  const escalationsPath = getBuilderEscalationsPath({
    paths,
    worktreePath: builderWorktree.worktreePath,
    specId,
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

  const escalationPath = getBuilderEscalationPath({
    paths,
    worktreePath: builderWorktree.worktreePath,
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

  const checkpointCommit = await createCommit({
    repositoryRoot: builderWorktree.worktreePath,
    expectedPaths: [
      relativePath({
        root: builderWorktree.worktreePath,
        target: workflowPath,
      }),
      relativePath({
        root: builderWorktree.worktreePath,
        target: escalationPath,
      }),
    ],
  });

  return {
    escalation: resolvedEscalation,
    state: nextState,
    worktreePath: builderWorktree.worktreePath,
    checkpointCommit,
  };
};
