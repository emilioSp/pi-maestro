/**
 * Objective: Create a workflow checkpoint commit containing exactly the expected paths.
 * Used: When Maestro records a workflow checkpoint.
 */

import {
  createCommit,
  WORKFLOW_CHECKPOINT_COMMIT_MESSAGE,
} from '#git/commits/createCommit.ts';

type CreateWorkflowCheckpointCommitInput = {
  repositoryRoot: string;
  expectedPaths: readonly string[];
};

export const createWorkflowCheckpointCommit = async ({
  repositoryRoot,
  expectedPaths,
}: CreateWorkflowCheckpointCommitInput): Promise<string> =>
  createCommit({
    repositoryRoot,
    expectedPaths,
    message: WORKFLOW_CHECKPOINT_COMMIT_MESSAGE,
  });
