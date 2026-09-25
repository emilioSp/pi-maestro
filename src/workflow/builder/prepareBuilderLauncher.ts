/**
 * Objective: Prepare a committed builder launch checkpoint.
 * Used: Before Maestro launches or explicitly retries a builder pass.
 */

import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { branchExists } from '#git/branches/branchExists.ts';
import { createBranch } from '#git/branches/createBranch.ts';
import { createCommit } from '#git/commits/createCommit.ts';
import { getCurrentBranch } from '#git/repository/getCurrentBranch.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
import { createWorktree } from '#git/worktrees/createWorktree.ts';
import { findWorktree } from '#git/worktrees/findWorktree.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import type { GetMaestroPaths } from '#paths.ts';
import { pathExists } from '#utils/path-exists.ts';
import { isPathWithinOrEqual } from '#utils/path-within-or-equal.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import {
  WORKFLOW_EVENTS,
  WORKFLOW_PHASES,
  type WorkflowEvent,
  type WorkflowState,
} from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';
import { assertWorktree } from '#workflow/utils/assertWorktree.ts';

export type BuilderLaunch = {
  specId: string;
  revision: number;
  branch: string;
  worktreePath: string;
  checkpointCommit: string;
};

const assertBuilderLaunchBase = async ({
  paths,
  specId,
  allowedWorktreePath,
}: {
  paths: GetMaestroPaths;
  specId: string;
  allowedWorktreePath?: string;
}): Promise<void> => {
  const state = await readWorkflowState({
    path: paths.getWorkflowPath(specId),
  });

  if (state.specId !== specId) {
    throw new Error(
      `Workflow spec ID mismatch: expected "${specId}", found "${state.specId}".`,
    );
  }

  if (state.phase !== WORKFLOW_PHASES.READY_FOR_BUILDER) {
    throw new Error(
      `Builder launch requires ready-for-builder state, found "${state.phase}".`,
    );
  }

  const currentBranch = await getCurrentBranch({
    repositoryRoot: paths.repositoryRoot,
  });

  if (currentBranch !== state.baseBranch) {
    throw new Error(
      `Builder launch requires base branch "${state.baseBranch}", found "${currentBranch}".`,
    );
  }

  const status = await getRepositoryStatus({
    repositoryRoot: paths.repositoryRoot,
  });
  const hasUnexpectedChanges =
    status.staged.length > 0 ||
    status.unstaged.length > 0 ||
    status.untracked.some((path) => {
      if (allowedWorktreePath === undefined) {
        return true;
      }
      return !isPathWithinOrEqual({
        parent: allowedWorktreePath,
        candidate: resolve(paths.repositoryRoot, path),
      });
    });

  if (hasUnexpectedChanges) {
    throw new Error('Builder launch requires a clean base branch.');
  }

  if (!(await pathExists(paths.getSpecFilePath(specId)))) {
    throw new Error(`Spec file is missing: ${paths.getSpecFilePath(specId)}.`);
  }
};

const assertBuilderWorktreeClean = async (
  worktreePath: string,
): Promise<void> => {
  const status = await getRepositoryStatus({ repositoryRoot: worktreePath });

  if (!status.clean) {
    throw new Error(`Expected builder worktree is dirty: ${worktreePath}.`);
  }
};

const assertBuilderResourcesAbsent = async ({
  paths,
  specId,
}: {
  paths: GetMaestroPaths;
  specId: string;
}): Promise<void> => {
  const branch = paths.getBuilderBranch(specId);
  const worktreePath = paths.getBuilderWorktreePath(specId);
  const branchFound = await branchExists({
    repositoryRoot: paths.repositoryRoot,
    branch,
  });
  const worktree = await findWorktree({
    repositoryRoot: paths.repositoryRoot,
    path: worktreePath,
  });
  const pathFound = await pathExists(worktreePath);

  if (branchFound || worktree !== undefined || pathFound) {
    throw new Error(`Builder resources already exist for ${specId}.`);
  }
};

const getBuilderLaunchEvent = ({
  phase,
  retry,
  handoffExists,
}: {
  phase: WorkflowState['phase'];
  retry: boolean;
  handoffExists: boolean;
}): WorkflowEvent => {
  if (retry && phase === WORKFLOW_PHASES.READY_FOR_BUILDER) {
    throw new Error('Builder retry is not valid from ready-for-builder.');
  }

  if (handoffExists && phase === WORKFLOW_PHASES.BUILDER_RUNNING) {
    throw new Error(
      'Builder worktree contains a terminal handoff while the builder is running.',
    );
  }

  if (!handoffExists && phase === WORKFLOW_PHASES.BUILDER_FAILED) {
    throw new Error('Failed builder state is missing its terminal handoff.');
  }

  if (
    (!retry && phase === WORKFLOW_PHASES.BUILDER_RUNNING) ||
    (!retry && phase === WORKFLOW_PHASES.BUILDER_FAILED)
  ) {
    throw new Error('Builder retry must be explicit.');
  }

  if (phase === WORKFLOW_PHASES.READY_FOR_BUILDER) {
    return WORKFLOW_EVENTS.LAUNCH_BUILDER;
  }

  if (phase === WORKFLOW_PHASES.BUILDER_RUNNING) {
    return WORKFLOW_EVENTS.RETRY_BUILDER;
  }

  if (phase === WORKFLOW_PHASES.BUILDER_FAILED) {
    return WORKFLOW_EVENTS.RETRY_BUILDER;
  }

  throw new Error(`Builder launch is not valid from phase "${phase}".`);
};

export const prepareBuilderLaunch = async ({
  paths,
  specId,
  retry = false,
}: {
  paths: GetMaestroPaths;
  specId: string;
  retry?: boolean;
}): Promise<BuilderLaunch> => {
  const activeSpecId = maestroSessionState.getActiveSpecId();

  if (activeSpecId !== specId) {
    throw new Error(
      `Builder launch requires active Maestro spec "${specId}", found "${activeSpecId ?? 'none'}".`,
    );
  }

  const builderBranch = paths.getBuilderBranch(specId);
  const worktreePath = paths.getBuilderWorktreePath(specId);
  const existingBranch = await branchExists({
    repositoryRoot: paths.repositoryRoot,
    branch: builderBranch,
  });

  const existingWorktree = await findWorktree({
    repositoryRoot: paths.repositoryRoot,
    path: worktreePath,
  });

  const existingPath = await pathExists(worktreePath);
  const hasExistingResources =
    existingBranch || existingWorktree !== undefined || existingPath;

  if (retry && !hasExistingResources) {
    throw new Error('Builder retry requires existing builder resources.');
  }

  await assertBuilderLaunchBase({
    paths,
    specId,
    allowedWorktreePath: hasExistingResources ? worktreePath : undefined,
  });

  if (hasExistingResources) {
    await assertWorktree({
      repositoryRoot: paths.repositoryRoot,
      branch: builderBranch,
      worktreePath,
    });
    await assertBuilderWorktreeClean(worktreePath);
  } else {
    await assertBuilderResourcesAbsent({ paths, specId }); // no worktree, no worktree path, no branch
    await createBranch({
      repositoryRoot: paths.repositoryRoot,
      branch: builderBranch,
      startPoint: await getHeadCommit({
        repositoryRoot: paths.repositoryRoot,
      }),
    });
    await createWorktree({
      repositoryRoot: paths.repositoryRoot,
      path: worktreePath,
      branch: builderBranch,
    });
  }

  const workflowPath = paths.getWorkflowPathInWorktree({
    specId,
    worktreePath,
  });
  const handoffPath = paths.getBuilderHandoffPathInWorktree({
    specId,
    worktreePath,
  });

  const currentState = await readWorkflowState({ path: workflowPath });

  if (currentState.specId !== specId) {
    throw new Error(
      `Workflow spec ID mismatch: expected "${specId}", found "${currentState.specId}".`,
    );
  }

  const handoffExists = await pathExists(handoffPath);
  const event = getBuilderLaunchEvent({
    phase: currentState.phase,
    retry,
    handoffExists,
  });

  if (handoffExists) {
    await rm(handoffPath);
  }

  const nextState = transitionWorkflow({
    state: currentState,
    event,
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

  const checkpointCommit = await createCommit({
    repositoryRoot: worktreePath,
    expectedPaths,
  });

  await maestroSessionState.setSpecSha256({
    specPath: paths.getSpecFilePath(specId),
  });

  return {
    branch: builderBranch,
    worktreePath,
    specId,
    revision: nextState.revision,
    checkpointCommit,
  };
};
