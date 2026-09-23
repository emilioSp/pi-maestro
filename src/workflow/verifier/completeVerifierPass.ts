/**
 * Objective: Complete a verifier pass without allowing candidate changes.
 * Used: When the verifier submits its terminal handoff.
 * Entrypoint: completeVerifierPass().
 */

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  assertVerifierHandoff,
  assertVerifierHandoffForWorkflow,
  type VerifierHandoff,
  writeVerifierHandoff,
} from '#artifacts/verifier-handoff.ts';
import { runGitCommand } from '#git/command.ts';
import { getRepositoryStatus } from '#git/repository.ts';
import type { GetMaestroPaths } from '#paths.ts';
import { pathExists } from '#utils/path-exists.ts';
import {
  WORKFLOW_EVENTS,
  WORKFLOW_PHASES,
  type WorkflowState,
} from '#workflow/state/schema.ts';
import {
  readWorkflowState,
  writeWorkflowState,
} from '#workflow/state/store.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';
import { assertWorktree, getPath, relativePath } from '#workflow/utils.ts';

export const VERIFIER_PASS_ERRORS = {
  PRODUCT_FILES_MODIFIED: 'PRODUCT_FILES_MODIFIED',
} as const;

const VERIFIER_PASS_MESSAGES = {
  PRODUCT_FILES_MODIFIED:
    'Product files differ from the candidate commit. Restore the candidate before submitting the verifier handoff.',
} as const;

export type CompletedVerifierPass = {
  handoff: VerifierHandoff;
  state: WorkflowState;
  worktreePath: string;
};

export type VerifierPassRejection = {
  error: (typeof VERIFIER_PASS_ERRORS)[keyof typeof VERIFIER_PASS_ERRORS];
  message: string;
};

const hasProductChanges = async ({
  worktreePath,
  candidateCommit,
  workflowPath,
  handoffPath,
}: {
  worktreePath: string;
  candidateCommit: string;
  workflowPath: string;
  handoffPath: string;
}): Promise<boolean> => {
  /*
   * Compare both versions of each tracked file with the candidate:
   * git diff --no-renames --name-only -z <candidateCommit> -- checks files on disk.
   * git diff --cached --no-renames --name-only -z <candidateCommit> -- checks staged files.
   *
   * Example: product.txt contains "A" in the candidate. The verifier changes it
   * to "B" and runs `git add product.txt`. Then it restores only the disk file
   * to "A" with `git restore --source=<candidateCommit> --worktree -- product.txt`.
   * The first diff sees "A" and finds no change. The second sees staged "B".
   */
  const [diff, stagedDiff, status] = await Promise.all([
    runGitCommand({
      arguments: [
        'diff',
        '--no-renames',
        '--name-only',
        '-z',
        candidateCommit,
        '--',
      ],
      cwd: worktreePath,
    }),
    runGitCommand({
      arguments: [
        'diff',
        '--cached',
        '--no-renames',
        '--name-only',
        '-z',
        candidateCommit,
        '--',
      ],
      cwd: worktreePath,
    }),
    getRepositoryStatus({ repositoryRoot: worktreePath }),
  ]);
  const allowedPaths = new Set([
    relativePath({ root: worktreePath, target: workflowPath }),
    relativePath({ root: worktreePath, target: handoffPath }),
  ]);
  const changedTrackedPaths = [diff.stdout, stagedDiff.stdout]
    .flatMap((output) => output.split('\0'))
    .filter((path) => path.length > 0);
  return (
    changedTrackedPaths.some((path) => !allowedPaths.has(path)) ||
    status.untracked.some((path) => !allowedPaths.has(path))
  );
};

export const completeVerifierPass = async ({
  paths,
  specId,
  pass,
  candidateCommit,
  handoff,
}: {
  paths: GetMaestroPaths;
  specId: string;
  pass: number;
  candidateCommit: string;
  handoff: unknown;
}): Promise<CompletedVerifierPass | VerifierPassRejection> => {
  const verifierWorktreePath = paths.getVerifierWorktreePath({ specId, pass });
  await assertWorktree({
    repositoryRoot: paths.repositoryRoot,
    branch: paths.getVerifierBranch({ specId, pass }),
    worktreePath: verifierWorktreePath,
  });
  const workflowPath = getPath({
    paths,
    worktreePath: verifierWorktreePath,
    target: paths.getWorkflowPath(specId),
  });
  const handoffPath = getPath({
    paths,
    worktreePath: verifierWorktreePath,
    target: paths.getVerifierHandoffPath(specId),
  });
  const currentState = await readWorkflowState({ path: workflowPath });
  if (currentState.phase !== WORKFLOW_PHASES.VERIFIER_RUNNING) {
    throw new Error(
      `Verifier handoff requires verifier-running state, found "${currentState.phase}".`,
    );
  }
  if (await pathExists(handoffPath)) {
    throw new Error('Verifier terminal handoff already exists.');
  }

  if (
    await hasProductChanges({
      worktreePath: verifierWorktreePath,
      candidateCommit,
      workflowPath,
      handoffPath,
    })
  ) {
    // Return a structured result so the verifier can restore the candidate and retry this pass.
    return {
      error: VERIFIER_PASS_ERRORS.PRODUCT_FILES_MODIFIED,
      message: VERIFIER_PASS_MESSAGES.PRODUCT_FILES_MODIFIED,
    };
  }

  assertVerifierHandoff(handoff);
  assertVerifierHandoffForWorkflow({
    handoff,
    specId,
    revision: currentState.revision + 1,
  });
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
    worktreePath: verifierWorktreePath,
  };
};
