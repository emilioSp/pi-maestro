/**
 * Objective: Complete a builder pass with a validated terminal handoff.
 * Used: When the builder reports done or failed through the child tool.
 */

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { assertBuilderHandoff } from '#artifacts/builder-handoff/assertBuilderHandoff.ts';
import {
  BUILDER_HANDOFF_STATUSES,
  BUILDER_HANDOFF_VERSION,
  type BuilderHandoff,
  type BuilderHandoffSubmissionInput,
} from '#artifacts/builder-handoff/schema.ts';
import { writeBuilderHandoff } from '#artifacts/builder-handoff/writeBuilderHandoff.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import { pathExists } from '#utils/path-exists.ts';
import { assertBuilderProtocolUnchanged } from '#workflow/builder/assertBuilderProtocolUnchanged.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import {
  WORKFLOW_EVENTS,
  WORKFLOW_PHASES,
  type WorkflowState,
} from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';

export type CompletedBuilderPass = {
  handoff: BuilderHandoff;
  state: WorkflowState;
  repositoryRoot: string;
};

const buildBuilderHandoff = ({
  draftHandoff,
  state,
}: {
  draftHandoff: BuilderHandoffSubmissionInput;
  state: WorkflowState;
}): unknown => ({
  version: BUILDER_HANDOFF_VERSION,
  specId: state.specId,
  revision: state.revision + 1,
  status: draftHandoff.status,
  summary: draftHandoff.summary,
  acceptanceCriteria: draftHandoff.acceptanceCriteria,
  ...(draftHandoff.status === BUILDER_HANDOFF_STATUSES.FAILED
    ? { failure: draftHandoff.failure }
    : {}),
  notes: draftHandoff.notes,
});

export const completeBuilderPass = async ({
  paths,
  specId,
  handoff: draftHandoff,
}: {
  paths: MaestroPaths;
  specId: string;
  handoff: BuilderHandoffSubmissionInput;
}): Promise<CompletedBuilderPass> => {
  await assertBuilderProtocolUnchanged({ paths, specId });

  const workflowPath = paths.getWorkflowPath(specId);
  const handoffPath = paths.getBuilderHandoffPath(specId);
  const currentState = await readWorkflowState({ path: workflowPath });

  if (currentState.specId !== specId) {
    throw new Error(
      `Workflow spec ID mismatch: expected "${specId}", found "${currentState.specId}".`,
    );
  }

  if (currentState.phase !== WORKFLOW_PHASES.BUILDER_RUNNING) {
    throw new Error(
      `Builder handoff requires builder-running state, found "${currentState.phase}".`,
    );
  }

  if (await pathExists(handoffPath)) {
    throw new Error('Builder terminal handoff already exists.');
  }

  const handoff = buildBuilderHandoff({ draftHandoff, state: currentState });
  assertBuilderHandoff(handoff, currentState.specId, currentState.revision + 1);

  const nextState = transitionWorkflow({
    state: currentState,
    event:
      handoff.status === BUILDER_HANDOFF_STATUSES.DONE
        ? WORKFLOW_EVENTS.BUILDER_DONE
        : WORKFLOW_EVENTS.BUILDER_FAILED,
  });

  await mkdir(dirname(handoffPath), { recursive: true });

  await writeBuilderHandoff({
    path: handoffPath,
    handoff,
    specId: currentState.specId,
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
    repositoryRoot: paths.getRepositoryRoot(),
  };
};
