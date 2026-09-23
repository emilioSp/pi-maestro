/**
 * Objective: Read and validate a workflow state file.
 * Used: When Maestro loads a workflow phase or revision.
 */

import { readFile } from 'node:fs/promises';
import {
  assertWorkflowState,
  type WorkflowState,
} from '#workflow/state/schema.ts';

const readJson = async (path: string): Promise<unknown> => {
  const content = await readFile(path, 'utf8');
  try {
    return JSON.parse(content);
  } catch (cause) {
    throw new Error(`Workflow state contains malformed JSON: ${path}.`, {
      cause,
    });
  }
};

export const readWorkflowState = async ({
  path,
}: {
  path: string;
}): Promise<WorkflowState> => {
  const state = await readJson(path);
  assertWorkflowState(state);
  return state;
};
