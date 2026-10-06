/**
 * Objective: Prepare a committed builder run checkpoint in the current checkout.
 * Used: Before Maestro runs a builder pass.
 */

import { rm } from 'node:fs/promises';
import { createWorkflowCheckpointCommit } from '#git/commits/createWorkflowCheckpointCommit.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import { pathExists } from '#utils/path-exists.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_EVENTS, WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';

export type BuilderRun = {
  specId: string;
  revision: number;
  repositoryRoot: string;
  checkpointCommit: string;
};

type AssertBuilderRunBaseInput = {
  paths: MaestroPaths;
  specId: string;
};

async function assertBuilderRunBase({
  paths,
  specId,
}: AssertBuilderRunBaseInput): Promise<void> {
  const state = await readWorkflowState(paths.getWorkflowPath(specId));

  if (state.specId !== specId) {
    throw new Error(
      `Workflow spec ID mismatch: expected "${specId}", found "${state.specId}".`,
    );
  }

  if (state.phase !== WORKFLOW_PHASES.READY_FOR_BUILDER) {
    throw new Error(`Builder run is not valid from phase "${state.phase}".`);
  }

  const status = await getRepositoryStatus(paths.getRepositoryRoot());

  if (!status.clean) {
    throw new Error('Builder run requires a clean current checkout.');
  }

  if (!(await pathExists(paths.getSpecFilePath(specId)))) {
    throw new Error(`Spec file is missing: ${paths.getSpecFilePath(specId)}.`);
  }
}

type PrepareBuilderRunInput = {
  paths: MaestroPaths;
  specId: string;
};

export const prepareBuilderRun = async ({
  paths,
  specId,
}: PrepareBuilderRunInput): Promise<BuilderRun> => {
  const activeSpecId = maestroSessionState.getActiveSpecId();

  if (activeSpecId !== specId) {
    throw new Error(
      `Builder run requires active Maestro spec "${specId}", found "${activeSpecId ?? 'none'}".`,
    );
  }

  await assertBuilderRunBase({ paths, specId });

  const workflowPath = paths.getWorkflowPath(specId);
  const handoffPath = paths.getBuilderHandoffPath(specId);
  const currentState = await readWorkflowState(workflowPath);
  const handoffExists = await pathExists(handoffPath);

  if (handoffExists) {
    await rm(handoffPath);
  }

  const nextState = transitionWorkflow({
    state: currentState,
    event: WORKFLOW_EVENTS.RUN_BUILDER,
  });

  await writeWorkflowState({
    path: workflowPath,
    state: nextState,
    currentRevision: currentState.revision,
  });

  const expectedPaths = [workflowPath];

  if (handoffExists) {
    expectedPaths.push(handoffPath);
  }

  const checkpointCommit = await createWorkflowCheckpointCommit({
    repositoryRoot: paths.getRepositoryRoot(),
    expectedPaths,
  });

  await maestroSessionState.setSpecSha256(paths.getSpecFilePath(specId));

  return {
    specId,
    revision: nextState.revision,
    repositoryRoot: paths.getRepositoryRoot(),
    checkpointCommit,
  };
};
