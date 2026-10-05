/**
 * Objective: Read and validate a workflow state file.
 * Used: When Maestro loads a workflow phase or revision.
 */

import { readJsonFile } from '#utils/read-json.ts';
import {
  assertWorkflowState,
  type WorkflowState,
} from '#workflow/state/schema.ts';

export const readWorkflowState = async ({
  path,
}: {
  path: string;
}): Promise<WorkflowState> => {
  const state = await readJsonFile({ path, description: 'Workflow state' });
  assertWorkflowState(state);

  return state;
};
