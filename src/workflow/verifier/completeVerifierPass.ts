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
import { pathExists } from '#utils/path-exists.ts';
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
  repositoryRoot: string;
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
  const repositoryRoot = paths.getRepositoryRoot();
  const workflowPath = paths.getWorkflowPath(specId);
  const handoffPath = paths.getVerifierHandoffPath(specId);
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

  if (await pathExists(handoffPath)) {
    throw new Error('Verifier terminal handoff already exists.');
  }

  const handoffInput = {
    handoff: draftHandoff,
    specId,
    revision: currentState.revision + 1,
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
    revision: nextState.revision,
  });
  await writeWorkflowState({
    path: workflowPath,
    state: nextState,
    currentRevision: currentState.revision,
  });

  return {
    handoff,
    state: nextState,
    repositoryRoot,
  };
};
