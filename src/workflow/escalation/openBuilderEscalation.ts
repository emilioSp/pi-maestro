/**
 * Objective: Open a builder escalation and move the workflow to a decision.
 * Used: When a builder needs an owner decision.
 */

import { mkdir } from 'node:fs/promises';
import { createEscalation } from '#artifacts/escalation/createEscalation.ts';
import type {
  Escalation,
  NewEscalation,
} from '#artifacts/escalation/schema.ts';
import type { GetMaestroPaths } from '#paths.ts';
import { pathExists } from '#utils/path-exists.ts';
import { assertBuilderProtocolUnchanged } from '#workflow/builder/assertBuilderProtocolUnchanged.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import {
  WORKFLOW_EVENTS,
  WORKFLOW_PHASES,
  type WorkflowState,
} from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';
import { assertWorktree } from '#workflow/utils/assertWorktree.ts';

export type OpenedBuilderEscalation = {
  escalation: Escalation;
  state: WorkflowState;
  worktreePath: string;
  workflowPath: string;
  escalationPath: string;
};

type OpenBuilderEscalationInput = {
  paths: GetMaestroPaths;
  specId: string;
  escalation: NewEscalation;
};

export const openBuilderEscalation = async ({
  paths,
  specId,
  escalation,
}: OpenBuilderEscalationInput): Promise<OpenedBuilderEscalation> => {
  const worktreePath = paths.repositoryRoot;

  await assertWorktree({
    repositoryRoot: paths.repositoryRoot,
    branch: paths.getBuilderBranch(specId),
    worktreePath: paths.repositoryRoot,
  });

  await assertBuilderProtocolUnchanged({ paths, specId });

  const workflowPath = paths.getWorkflowPath(specId);
  const handoffPath = paths.getBuilderHandoffPath(specId);
  const escalationsPath = paths.getEscalationsPath(specId);
  const currentState = await readWorkflowState({ path: workflowPath });

  if (currentState.specId !== specId) {
    throw new Error(
      `Workflow spec ID mismatch: expected "${specId}", found "${currentState.specId}".`,
    );
  }

  if (currentState.phase !== WORKFLOW_PHASES.BUILDER_RUNNING) {
    throw new Error(
      `Builder escalation requires builder-running state, found "${currentState.phase}".`,
    );
  }

  if (await pathExists(handoffPath)) {
    throw new Error('Builder terminal handoff already exists.');
  }

  const nextState = transitionWorkflow({
    state: currentState,
    event: WORKFLOW_EVENTS.OPEN_ESCALATION,
  });

  await mkdir(escalationsPath, { recursive: true });

  const created = await createEscalation({
    directory: escalationsPath,
    specId: currentState.specId,
    revision: nextState.revision,
    escalation,
  });

  await writeWorkflowState({
    path: workflowPath,
    state: nextState,
    currentRevision: currentState.revision,
  });

  return {
    escalation: created.escalation,
    state: nextState,
    worktreePath,
    workflowPath,
    escalationPath: created.path,
  };
};
