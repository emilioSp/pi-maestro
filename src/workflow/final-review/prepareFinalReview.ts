/**
 * Objective: Prepare and conclude a verified candidate for owner review.
 * Used: When the owner requests final review preparation.
 */

import { readVerifierHandoff } from '#artifacts/verifier-handoff/readVerifierHandoff.ts';
import { runGitCommand } from '#git/command.ts';
import { getStagedPaths } from '#git/commits/getStagedPaths.ts';
import { cleanupWorkflowResources } from '#git/final-review/cleanupWorkflowResources.ts';
import { squashCandidate } from '#git/final-review/squashCandidate.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_EVENTS, WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';
import { assertWorktree } from '#workflow/utils/assertWorktree.ts';

export type FinalReviewResult = {
  candidateCommit: string;
  candidateBranch: string;
  baseBranch: string;
  stagedPaths: readonly string[];
  cleanup: { removed: string[]; failures: string[] };
};

// git rev-parse --verify HEAD^{commit}
// git add <workflow-state-path>
// git diff --cached --name-only -z
export const prepareFinalReview = async ({
  paths,
  specId,
  pass,
}: {
  paths: MaestroPaths;
  specId: string;
  pass: number;
}): Promise<FinalReviewResult> => {
  const verifierBranch = paths.getVerifierBranch({ specId, pass });
  const verifierWorktreePath = paths.getVerifierWorktreePath({ specId, pass });
  const builderBranch = paths.getBuilderBranch(specId);
  const builderWorktreePath = paths.getBuilderWorktreePath(specId);

  await assertWorktree({
    repositoryRoot: paths.getRepositoryRoot(),
    branch: verifierBranch,
    worktreePath: verifierWorktreePath,
  });
  await assertWorktree({
    repositoryRoot: paths.getRepositoryRoot(),
    branch: builderBranch,
    worktreePath: builderWorktreePath,
  });

  const statePath = paths.getWorkflowPath(specId);
  const verifierStatePath = paths.getWorkflowPathInWorktree({
    specId,
    worktreePath: verifierWorktreePath,
  });
  const verifierState = await readWorkflowState({ path: verifierStatePath });

  if (verifierState.phase !== WORKFLOW_PHASES.CANDIDATE_READY) {
    throw new Error(
      `Final review requires candidate-ready state, found "${verifierState.phase}".`,
    );
  }

  const handoff = await readVerifierHandoff({
    path: paths.getVerifierHandoffPathInWorktree({
      specId,
      worktreePath: verifierWorktreePath,
    }),
    specId,
    revision: verifierState.revision,
  });

  if (handoff.findings.some(({ rejection }) => rejection === null)) {
    throw new Error(
      'Candidate contains verifier findings that were not rejected.',
    );
  }

  const candidateCommit = await getHeadCommit({
    repositoryRoot: verifierWorktreePath,
  });

  const worktreeDirectory = paths.getWorktreeDirectory();

  await squashCandidate({
    repositoryRoot: paths.getRepositoryRoot(),
    baseBranch: verifierState.baseBranch,
    candidateBranch: verifierBranch,
    worktreeDirectory,
  });

  const stagedCandidatePaths = await getStagedPaths({
    repositoryRoot: paths.getRepositoryRoot(),
  });
  const status = await getRepositoryStatus({
    repositoryRoot: paths.getRepositoryRoot(),
    worktreeDirectory,
  });

  if (
    stagedCandidatePaths.length === 0 ||
    status.unstaged.length > 0 ||
    status.untracked.length > 0
  ) {
    throw new Error(
      'Candidate squash produced an empty or unexpected staging state.',
    );
  }

  const nextState = transitionWorkflow({
    state: verifierState,
    event: WORKFLOW_EVENTS.PREPARE_FINAL_REVIEW,
  });
  await writeWorkflowState({
    path: statePath,
    state: nextState,
    currentRevision: verifierState.revision,
  });
  await runGitCommand({
    arguments: ['add', '--', statePath],
    cwd: paths.getRepositoryRoot(),
  });
  const stagedPaths = await getStagedPaths({
    repositoryRoot: paths.getRepositoryRoot(),
  });

  const cleanup = await cleanupWorkflowResources({
    repositoryRoot: paths.getRepositoryRoot(),
    worktreeDirectory: paths.getWorktreeDirectory(),
    resources: [
      { branch: verifierBranch, worktreePath: verifierWorktreePath },
      { branch: builderBranch, worktreePath: builderWorktreePath },
    ],
  });

  return {
    candidateCommit,
    candidateBranch: verifierBranch,
    baseBranch: verifierState.baseBranch,
    stagedPaths,
    cleanup,
  };
};
