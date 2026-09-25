/**
 * Objective: Complete a verifier pass without allowing candidate changes.
 * Used: When the verifier submits its terminal handoff.
 */

import { mkdir } from 'node:fs/promises';
import { dirname, relative } from 'node:path';
import { assertVerifierHandoff } from '#artifacts/verifier-handoff/assertVerifierHandoff.ts';
import type { VerifierHandoff } from '#artifacts/verifier-handoff/schema.ts';
import { writeVerifierHandoff } from '#artifacts/verifier-handoff/writeVerifierHandoff.ts';
import { runGitCommand } from '#git/command.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
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
  repositoryRoot: string;
};

export type VerifierPassRejection = {
  error: (typeof VERIFIER_PASS_ERRORS)[keyof typeof VERIFIER_PASS_ERRORS];
  message: string;
};

const hasProductChanges = async ({
  repositoryRoot,
  candidateCommit,
  workflowPath,
  handoffPath,
}: {
  repositoryRoot: string;
  candidateCommit: string;
  workflowPath: string;
  handoffPath: string;
}): Promise<boolean> => {
  /*
   * Compare both the checkout and index with the candidate. The second diff
   * catches a product file that the verifier staged and then restored only on
   * disk.
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
      cwd: repositoryRoot,
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
      cwd: repositoryRoot,
    }),
    getRepositoryStatus({ repositoryRoot }),
  ]);

  const allowedPaths = new Set([
    relative(repositoryRoot, workflowPath),
    relative(repositoryRoot, handoffPath),
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
  candidateCommit,
  handoff,
}: {
  paths: MaestroPaths;
  specId: string;
  candidateCommit: string;
  handoff: unknown;
}): Promise<CompletedVerifierPass | VerifierPassRejection> => {
  const repositoryRoot = paths.getRepositoryRoot();
  const workflowPath = paths.getWorkflowPath(specId);
  const handoffPath = paths.getVerifierHandoffPath(specId);
  const currentState = await readWorkflowState({ path: workflowPath });

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

  if (
    await hasProductChanges({
      repositoryRoot,
      candidateCommit,
      workflowPath,
      handoffPath,
    })
  ) {
    return {
      error: VERIFIER_PASS_ERRORS.PRODUCT_FILES_MODIFIED,
      message: VERIFIER_PASS_MESSAGES.PRODUCT_FILES_MODIFIED,
    };
  }

  assertVerifierHandoff(handoff, specId, currentState.revision + 1);
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
