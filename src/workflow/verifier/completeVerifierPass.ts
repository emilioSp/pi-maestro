/**
 * Objective: Complete a verifier pass with a validated handoff.
 * Used: When the verifier submits its terminal handoff.
 */

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { assertVerifierHandoff } from '#artifacts/verifier-handoff/assertVerifierHandoff.ts';
import type { VerifierHandoff } from '#artifacts/verifier-handoff/schema.ts';
import { writeVerifierHandoff } from '#artifacts/verifier-handoff/writeVerifierHandoff.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import {
  WORKFLOW_EVENTS,
  WORKFLOW_PHASES,
  type WorkflowState,
} from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';

export type CompletedVerifierPass = {
  handoff: VerifierHandoff;
  state: WorkflowState;
  projectRoot: string;
  handoffPath: string;
};

type CompleteVerifierPassInput = {
  paths: MaestroPaths;
  specId: string;
  handoff: unknown;
};

export const completeVerifierPass = async ({
  paths,
  specId,
  handoff: draftHandoff,
}: CompleteVerifierPassInput): Promise<CompletedVerifierPass> => {
  const projectRoot = paths.getProjectRoot();
  const workflowPath = paths.getWorkflowPath(specId);
  const handoffPath = await paths.getNextVerifierHandoffPath(specId);
  const currentState = await readWorkflowState(workflowPath);

  if (currentState.specId !== specId) {
    throw new Error(
      `Workflow spec ID mismatch: expected "${specId}", found "${currentState.specId}".`,
    );
  }

  if (currentState.phase !== WORKFLOW_PHASES.VERIFIER_RUNNING) {
    throw new Error(
      `Verifier handoff requires verifier-running state, found "${currentState.phase}".`,
    );
  }

  const handoffInput = {
    handoff: draftHandoff,
    specId,
  };

  assertVerifierHandoff(handoffInput);
  const { handoff } = handoffInput;

  const nextState = transitionWorkflow({
    state: currentState,
    event:
      handoff.findings.length > 0
        ? WORKFLOW_EVENTS.VERIFIER_FOUND_FINDINGS
        : WORKFLOW_EVENTS.VERIFIER_APPROVED,
  });

  await mkdir(dirname(handoffPath), { recursive: true });
  await writeVerifierHandoff({
    path: handoffPath,
    handoff,
    specId,
  });
  await writeWorkflowState({
    path: workflowPath,
    state: nextState,
  });

  return {
    handoff,
    handoffPath,
    state: nextState,
    projectRoot,
  };
};
