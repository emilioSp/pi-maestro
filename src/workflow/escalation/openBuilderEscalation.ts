/**
 * Objective: Open a builder escalation and move the workflow to a decision.
 * Used: When a builder needs an owner decision.
 * Entrypoint: openBuilderEscalation().
 */

import { mkdir } from 'node:fs/promises';
import {
  createEscalation,
  type Escalation,
  type NewEscalation,
} from '#artifacts/escalation.ts';
import type { GetMaestroPaths } from '#paths.ts';
import { pathExists } from '#utils/path-exists.ts';
import { getBuilderEscalationsPath } from '#workflow/escalation/utils.ts';
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
import { getPath, validateWorktree } from '#workflow/utils.ts';

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

const getPaths = async ({
  paths,
  specId,
}: Omit<OpenBuilderEscalationInput, 'escalation'>) => {
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

  const handoffPath = getPath({
    paths,
    worktreePath: builderWorktree.worktreePath,
    target: paths.getBuilderHandoffPath(specId),
  });

  const escalationsPath = getBuilderEscalationsPath({
    paths,
    worktreePath: builderWorktree.worktreePath,
    specId,
  });

  const worktreePath = builderWorktree.worktreePath;

  return { worktreePath, workflowPath, handoffPath, escalationsPath };
};

export const openBuilderEscalation = async ({
  paths,
  specId,
  escalation,
}: OpenBuilderEscalationInput): Promise<OpenedBuilderEscalation> => {
  const { worktreePath, escalationsPath, workflowPath, handoffPath } =
    await getPaths({ paths, specId });

  const currentState = await readWorkflowState({ path: workflowPath });

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
    specId,
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
