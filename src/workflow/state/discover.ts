/**
 * Objective: Find the single active Maestro workflow.
 * Used: During Maestro activation and workflow inspection.
 */

import { readdir } from 'node:fs/promises';
import { isValidSpecId } from '#ids/isValidSpecId.ts';
import type { GetMaestroPaths } from '#paths.ts';
import { pathExists } from '#utils/path-exists.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES, type WorkflowState } from '#workflow/state/schema.ts';

export type DiscoveredWorkflow = {
  specId: string;
  state: WorkflowState;
};

// TO FIX: this function works only during the spec creation, because it inspects the workflow.json inside the base branch
export const discoverActiveWorkflow = async ({
  paths,
}: {
  paths: GetMaestroPaths;
}): Promise<DiscoveredWorkflow | null> => {
  if (!(await pathExists(paths.specDirectory))) {
    return null;
  }

  const entries = await readdir(paths.specDirectory, { withFileTypes: true });
  const active: DiscoveredWorkflow[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !isValidSpecId(entry.name)) {
      continue;
    }

    const specId = entry.name;
    const workflowPath = paths.getWorkflowPath(specId);

    if (!(await pathExists(workflowPath))) {
      continue;
    }

    const state = await readWorkflowState({ path: workflowPath });

    if (state.specId !== specId) {
      throw new Error(
        `Workflow state ID mismatch: directory "${specId}" contains "${state.specId}".`,
      );
    }

    if (state.phase !== WORKFLOW_PHASES.FINAL_REVIEW) {
      active.push({ specId, state });
    }
  }

  if (active.length > 1) {
    throw new Error('Multiple active Maestro workflows exist.');
  }

  return active[0] ?? null;
};
