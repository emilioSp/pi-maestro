/**
 * Objective: Read and validate a workflow state file.
 * Used: When Maestro loads a workflow phase.
 */

import { readJsonFile } from '#utils/read-json.ts';
import {
  assertWorkflowState,
  type WorkflowState,
} from '#workflow/state/schema.ts';

export const readWorkflowState = async (
  path: string,
): Promise<WorkflowState> => {
  const state = await readJsonFile({ path, description: 'Workflow state' });
  assertWorkflowState(state);

  return { version: state.version, specId: state.specId, phase: state.phase };
};
