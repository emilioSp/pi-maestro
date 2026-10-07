/**
 * Objective: Write a validated workflow state.
 * Used: When Maestro persists a sequential workflow transition.
 */

import { writeJson } from '#utils/write-json.ts';
import {
  assertWorkflowState,
  type WorkflowState,
} from '#workflow/state/schema.ts';

type WriteWorkflowStateInput = {
  path: string;
  state: WorkflowState;
};

export const writeWorkflowState = async ({
  path,
  state,
}: WriteWorkflowStateInput): Promise<void> => {
  assertWorkflowState(state);
  await writeJson({
    path,
    data: { version: state.version, specId: state.specId, phase: state.phase },
  });
};
