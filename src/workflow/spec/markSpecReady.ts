/**
 * Objective: Mark an owner-approved drafting spec ready for a builder.
 * Used: When the owner approves the spec content.
 * Entrypoint: markSpecReady().
 */

import type { GetMaestroPaths } from '#paths.ts';
import { pathExists } from '#utils/path-exists.ts';
import { discoverActiveWorkflow } from '#workflow/state/discover.ts';
import { WORKFLOW_EVENTS, type WorkflowState } from '#workflow/state/schema.ts';
import {
  readWorkflowState,
  writeWorkflowState,
} from '#workflow/state/store.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';

export const markSpecReady = async ({
  paths,
  specId,
}: {
  paths: GetMaestroPaths;
  specId: string;
}): Promise<WorkflowState> => {
  const activeWorkflow = await discoverActiveWorkflow({ paths });
  if (activeWorkflow === null) {
    throw new Error('No active Maestro workflow exists.');
  }
  if (activeWorkflow.specId !== specId) {
    throw new Error(
      `Active workflow spec ID mismatch: expected "${specId}", found "${activeWorkflow.specId}".`,
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
