/**
 * Objective: Mark an owner-approved drafting spec ready for a builder.
 * Used: When the owner approves the spec content.
 */

import type { GetMaestroPaths } from '#paths.ts';
import { pathExists } from '#utils/path-exists.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_EVENTS, type WorkflowState } from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';

type MarkSpecReadyInput = {
  paths: GetMaestroPaths;
  specId: string;
  activeWorkflowSpecId: string | null;
};

export const markSpecReady = async ({
  paths,
  specId,
  activeWorkflowSpecId,
}: MarkSpecReadyInput): Promise<WorkflowState> => {
  if (activeWorkflowSpecId === null) {
    throw new Error('No active Maestro workflow exists.');
  }

  if (activeWorkflowSpecId !== specId) {
    throw new Error(
      `Active workflow spec ID mismatch: expected "${specId}", found "${activeWorkflowSpecId}".`,
    );
  }

  const specFilePath = paths.getSpecFilePath(specId);

  if (!(await pathExists(specFilePath))) {
    throw new Error(`Spec file is missing: ${specFilePath}.`);
  }

  const current = await readWorkflowState({
    path: paths.getWorkflowPath(specId),
  });
  const state = transitionWorkflow({
    state: current,
    event: WORKFLOW_EVENTS.MARK_SPEC_READY,
  });
  await writeWorkflowState({
    path: paths.getWorkflowPath(specId),
    state,
    currentRevision: current.revision,
  });

  return state;
};
