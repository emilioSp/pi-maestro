/**
 * Objective: Complete a builder pass with a validated terminal handoff.
 * Used: When the builder reports done or failed through the child tool.
 */

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { assertBuilderHandoff } from '#artifacts/builder-handoff/assertBuilderHandoff.ts';
import {
  BUILDER_HANDOFF_STATUSES,
  type BuilderHandoff,
} from '#artifacts/builder-handoff/schema.ts';
import { writeBuilderHandoff } from '#artifacts/builder-handoff/writeBuilderHandoff.ts';
import type { GetMaestroPaths } from '#paths.ts';
import { pathExists } from '#utils/path-exists.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import {
  WORKFLOW_EVENTS,
  WORKFLOW_PHASES,
  type WorkflowState,
} from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';
import { assertWorktree } from '#workflow/utils/assertWorktree.ts';

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

  const handoffPath = paths.getBuilderHandoffPathInWorktree({
    specId,
    worktreePath: builderWorktreePath,
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

  assertBuilderHandoff(handoff, specId, currentState.revision + 1);

  const nextState = transitionWorkflow({
    state: currentState,
    event:
      handoff.status === BUILDER_HANDOFF_STATUSES.DONE
        ? WORKFLOW_EVENTS.BUILDER_DONE
        : WORKFLOW_EVENTS.BUILDER_FAILED,
  });

  await mkdir(dirname(handoffPath), { recursive: true });

  await writeBuilderHandoff({
    path: handoffPath,
    handoff,
    specId,
    revision: nextState.revision,
  });

  await writeWorkflowState({
    path: workflowPath,
    state: nextState,
    currentRevision: currentState.revision,
  });

  return {
    handoff,
    state: nextState,
    worktreePath: builderWorktreePath,
  };
};
