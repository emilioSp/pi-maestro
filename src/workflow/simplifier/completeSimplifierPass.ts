/**
 * Objective: Save a validated simplifier handoff before completing the workflow.
 * Used: When the simplifier records its single result.
 */

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { assertSimplifierHandoff } from '#artifacts/simplifier-handoff/assertSimplifierHandoff.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import { writeJson } from '#utils/write-json.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_EVENTS, WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';

type CompleteSimplifierPassInput = {
  paths: MaestroPaths;
  specId: string;
  handoff: unknown;
};

export const completeSimplifierPass = async ({
  paths,
  specId,
  handoff,
}: CompleteSimplifierPassInput) => {
  const workflowPath = paths.getWorkflowPath(specId);
  const state = await readWorkflowState(workflowPath);

  if (state.specId !== specId) {
    throw new Error(
      `Workflow spec ID mismatch: expected "${specId}", found "${state.specId}".`,
    );
  }

  if (state.phase !== WORKFLOW_PHASES.SIMPLIFIER_RUNNING) {
    throw new Error(
      `Simplifier handoff requires simplifier-running state, found "${state.phase}".`,
    );
  }

  const input = { handoff, specId, projectRoot: paths.getProjectRoot() };
  assertSimplifierHandoff(input);

  const handoffPath = paths.getSimplifierHandoffPath(specId);
  await mkdir(dirname(handoffPath), { recursive: true });
  await writeJson({ path: handoffPath, data: input.handoff });

  const nextState = transitionWorkflow({
    state,
    event: WORKFLOW_EVENTS.SIMPLIFIER_DONE,
  });

  await writeWorkflowState({ path: workflowPath, state: nextState });

  return { handoff: input.handoff, handoffPath, state: nextState };
};
