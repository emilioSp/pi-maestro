/**
 * Objective: Complete a builder pass with a validated terminal handoff.
 * Used: When the builder reports done or failed through the child tool.
 * Entrypoint: completeBuilderPass().
 */

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  BUILDER_HANDOFF_STATUSES,
  type BuilderHandoff,
  validateBuilderHandoff,
  validateBuilderHandoffForWorkflow,
  writeBuilderHandoff,
} from '#artifacts/builder-handoff.ts';
import type { GetMaestroPaths } from '#paths.ts';
import { pathExists } from '#utils/path-exists.ts';
import {
  getBuilderHandoffPath,
  getBuilderWorkflowPath,
  validateBuilderWorktree,
} from '#workflow/builder/utils.ts';
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

export type CompletedBuilderPass = {
  handoff: BuilderHandoff;
  state: WorkflowState;
  worktreePath: string;
};

export const completeBuilderPass = async ({
  paths,
  specId,
  handoff,
}: {
  paths: GetMaestroPaths;
  specId: string;
  handoff: unknown;
}): Promise<CompletedBuilderPass> => {
  const builderWorktree = await validateBuilderWorktree({ paths, specId });

  const workflowPath = getBuilderWorkflowPath({
    paths,
    worktreePath: builderWorktree.worktreePath,
    specId,
  });

  const handoffPath = getBuilderHandoffPath({
    paths,
    worktreePath: builderWorktree.worktreePath,
    specId,
  });

  const currentState = await readWorkflowState({ path: workflowPath });
  if (currentState.phase !== WORKFLOW_PHASES.BUILDER_RUNNING) {
    throw new Error(
      `Builder handoff requires builder-running state, found "${currentState.phase}".`,
    );
  }

  if (await pathExists(handoffPath)) {
    throw new Error('Builder terminal handoff already exists.');
  }

  const validatedHandoff = validateBuilderHandoff(handoff);

  const nextState = transitionWorkflow({
    state: currentState,
    event:
      validatedHandoff.status === BUILDER_HANDOFF_STATUSES.DONE
        ? WORKFLOW_EVENTS.BUILDER_DONE
        : WORKFLOW_EVENTS.BUILDER_FAILED,
  });

  const workflowHandoff = validateBuilderHandoffForWorkflow({
    handoff: validatedHandoff,
    specId,
    revision: nextState.revision,
  });

  await mkdir(dirname(handoffPath), { recursive: true });

  await writeBuilderHandoff({
    path: handoffPath,
    handoff: workflowHandoff,
    specId,
    revision: nextState.revision,
  });

  await writeWorkflowState({
    path: workflowPath,
    state: nextState,
    currentRevision: currentState.revision,
  });

  return {
    handoff: workflowHandoff,
    state: nextState,
    worktreePath: builderWorktree.worktreePath,
  };
};
