/**
 * Objective: Open a builder escalation and move the workflow to an owner decision.
 * Used: When a builder identifies a significant discovery that requires owner attention.
 */

import { mkdir } from 'node:fs/promises';
import { createEscalation } from '#artifacts/escalation/createEscalation.ts';
import type {
  Escalation,
  NewEscalation,
} from '#artifacts/escalation/schema.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import {
  WORKFLOW_EVENTS,
  WORKFLOW_PHASES,
  type WorkflowState,
} from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';

export type OpenedBuilderEscalation = {
  escalation: Escalation;
  state: WorkflowState;
  projectRoot: string;
  workflowPath: string;
  escalationPath: string;
};

type OpenBuilderEscalationInput = {
  paths: MaestroPaths;
  specId: string;
  escalation: NewEscalation;
};

export const openBuilderEscalation = async ({
  paths,
  specId,
  escalation,
}: OpenBuilderEscalationInput): Promise<OpenedBuilderEscalation> => {
  const workflowPath = paths.getWorkflowPath(specId);
  const escalationsPath = paths.getEscalationsPath(specId);
  const currentState = await readWorkflowState(workflowPath);

  if (currentState.specId !== specId) {
    throw new Error(
      `Workflow spec ID mismatch: expected "${specId}", found "${currentState.specId}".`,
    );
  }

  if (currentState.phase !== WORKFLOW_PHASES.BUILDER_RUNNING) {
    throw new Error(
      `Builder escalation requires builder-running state, found "${currentState.phase}".`,
    );
  }

  const nextState = transitionWorkflow({
    state: currentState,
    event: WORKFLOW_EVENTS.OPEN_ESCALATION,
  });

  await mkdir(escalationsPath, { recursive: true });

  const created = await createEscalation({
    directory: escalationsPath,
    specId: currentState.specId,
    escalation,
  });

  await writeWorkflowState({
    path: workflowPath,
    state: nextState,
  });

  return {
    escalation: created.escalation,
    state: nextState,
    projectRoot: paths.getProjectRoot(),
    workflowPath,
    escalationPath: created.path,
  };
};
