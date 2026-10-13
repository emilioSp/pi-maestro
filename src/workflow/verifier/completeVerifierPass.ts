/**
 * Objective: Complete a verifier pass with a validated handoff.
 * Used: When the verifier submits its terminal handoff.
 */

import { mkdir, readFile } from 'node:fs/promises';
import { assertVerifierHandoff } from '#artifacts/verifier-handoff/assertVerifierHandoff.ts';
import type { VerifierHandoff } from '#artifacts/verifier-handoff/schema.ts';
import { writeVerifierHandoff } from '#artifacts/verifier-handoff/writeVerifierHandoff.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES, type WorkflowState } from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';
import { assertSpecAcceptanceCriteria } from '#workflow/utils/assertSpecAcceptanceCriteria.ts';
import { getWorkflowEventByVerifierHandoff } from '#workflow/verifier/utils/getWorkflowEventByVerifierHandoff.ts';

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

  assertSpecAcceptanceCriteria({
    markdown: await readFile(paths.getSpecFilePath(specId), 'utf8'),
    criterionIds: new Set(handoff.acceptanceCriteria.map(({ id }) => id)),
  });

  const nextState = transitionWorkflow({
    state: currentState,
    event: getWorkflowEventByVerifierHandoff(handoff),
  });

  await mkdir(paths.getVerifierHandoffsPath(specId), { recursive: true });
  const handoffPath = await paths.getNextVerifierHandoffPath(specId);

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
