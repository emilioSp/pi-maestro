/**
 * Objective: Complete a builder pass with a validated terminal handoff.
 * Used: When the builder reports done, escalation, or failed through the child tool.
 */

import { mkdir } from 'node:fs/promises';
import { Value } from 'typebox/value';
import { assertBuilderHandoff } from '#artifacts/builder-handoff/assertBuilderHandoff.ts';
import {
  BUILDER_HANDOFF_STATUSES,
  BUILDER_HANDOFF_VERSION,
  type BuilderHandoff,
  type BuilderHandoffSubmissionInput,
  BuilderHandoffSubmissionSchema,
} from '#artifacts/builder-handoff/schema.ts';
import { writeBuilderHandoff } from '#artifacts/builder-handoff/writeBuilderHandoff.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
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
  projectRoot: string;
  handoffPath: string;
};

function assertBuilderHandoffSubmission(
  input: unknown,
): asserts input is BuilderHandoffSubmissionInput {
  const [error] = Value.Errors(BuilderHandoffSubmissionSchema, input);

  if (error !== undefined)
    throw new Error(`Invalid builder submission: ${error.message}.`);
}

type CompleteBuilderPassInput = {
  paths: MaestroPaths;
  specId: string;
  handoff: BuilderHandoffSubmissionInput;
};

export const completeBuilderPass = async ({
  paths,
  specId,
  handoff: draftHandoff,
}: CompleteBuilderPassInput): Promise<CompletedBuilderPass> => {
  const workflowPath = paths.getWorkflowPath(specId);
  const currentState = await readWorkflowState(workflowPath);

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

  assertBuilderHandoffSubmission(draftHandoff);

  const handoffInput = {
    handoff: {
      ...draftHandoff,
      version: BUILDER_HANDOFF_VERSION,
      specId: currentState.specId,
    },
    specId: currentState.specId,
  };

  assertBuilderHandoff(handoffInput);
  const { handoff } = handoffInput;

  const nextState = transitionWorkflow({
    state: currentState,
    event:
      draftHandoff.status === BUILDER_HANDOFF_STATUSES.DONE
        ? WORKFLOW_EVENTS.BUILDER_DONE
        : draftHandoff.status === BUILDER_HANDOFF_STATUSES.ESCALATION
          ? WORKFLOW_EVENTS.OPEN_ESCALATION
          : WORKFLOW_EVENTS.BUILDER_FAILED,
  });

  await mkdir(paths.getBuilderHandoffsPath(specId), { recursive: true });
  const handoffPath = await paths.getNextBuilderHandoffPath(specId);

  await writeBuilderHandoff({
    path: handoffPath,
    handoff,
    specId: currentState.specId,
  });

  await writeWorkflowState({
    path: workflowPath,
    state: nextState,
  });

  return {
    handoff,
    handoffPath,
    state: nextState,
    projectRoot: paths.getProjectRoot(),
  };
};
