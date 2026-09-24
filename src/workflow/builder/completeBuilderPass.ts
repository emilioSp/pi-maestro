/**
 * Objective: Complete a builder pass with a validated terminal handoff.
 * Used: When the builder reports done or failed through the child tool.
 */

import { mkdir } from 'node:fs/promises';
import { dirname, relative } from 'node:path';
import { assertBuilderHandoff } from '#artifacts/builder-handoff/assertBuilderHandoff.ts';
import {
  BUILDER_HANDOFF_STATUSES,
  BUILDER_HANDOFF_VERSION,
  type BuilderHandoff,
  type BuilderHandoffSubmissionInput,
} from '#artifacts/builder-handoff/schema.ts';
import { writeBuilderHandoff } from '#artifacts/builder-handoff/writeBuilderHandoff.ts';
import { runGitCommand } from '#git/command.ts';
import { CHECKPOINT_COMMIT_MESSAGE } from '#git/commits/createCommit.ts';
import type { GetMaestroPaths } from '#paths.ts';
import { pathExists } from '#utils/path-exists.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import {
  WORKFLOW_EVENTS,
  WORKFLOW_PHASES,
  type WorkflowState,
} from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';
import { assertWorktree } from '#workflow/utils/assertWorktree.ts';

export type CompletedBuilderPass = {
  handoff: BuilderHandoff;
  state: WorkflowState;
  worktreePath: string;
};

// git log --format=%H%x00%s --fixed-strings --grep=<checkpoint-message> HEAD
const getBuilderCheckpoint = async ({
  worktreePath,
}: {
  worktreePath: string;
}): Promise<string> => {
  const result = await runGitCommand({
    arguments: [
      'log',
      '--format=%H%x00%s',
      '--fixed-strings',
      `--grep=${CHECKPOINT_COMMIT_MESSAGE}`,
      'HEAD',
    ],
    cwd: worktreePath,
  });

  for (const line of result.stdout.split(/\r?\n/)) {
    const [commit, subject] = line.split('\0');

    if (subject === CHECKPOINT_COMMIT_MESSAGE) {
      return commit;
    }
  }

  throw new Error('Builder launch checkpoint was not found in Git history.');
};

// git diff --no-renames --name-only -z <checkpoint> -- <spec-path>
// git diff --cached --no-renames --name-only -z <checkpoint> -- <spec-path>
// git ls-files --others --exclude-standard -z -- <spec-path>
const assertProtocolFilesUnchanged = async ({
  paths,
  specId,
  worktreePath,
  checkpoint,
}: {
  paths: GetMaestroPaths;
  specId: string;
  worktreePath: string;
  checkpoint: string;
}): Promise<void> => {
  const specPath = relative(worktreePath, paths.getSpecPath(specId));

  const [workingDiff, stagedDiff, untrackedFiles] = await Promise.all([
    runGitCommand({
      arguments: [
        'diff',
        '--no-renames',
        '--name-only',
        '-z',
        checkpoint,
        '--',
        specPath,
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
        checkpoint,
        '--',
        specPath,
      ],
      cwd: worktreePath,
    }),
    runGitCommand({
      arguments: [
        'ls-files',
        '--others',
        '--exclude-standard',
        '-z',
        '--',
        specPath,
      ],
      cwd: worktreePath,
    }),
  ]);

  const changedPath = [
    workingDiff.stdout,
    stagedDiff.stdout,
    untrackedFiles.stdout,
  ]
    .flatMap((output) => output.split('\0'))
    .find((path) => path.length > 0);

  if (changedPath !== undefined) {
    throw new Error(
      `Builder changed a protected workflow file after launch: "${changedPath}".`,
    );
  }
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
  ...(draftHandoff.failure === undefined
    ? {}
    : { failure: draftHandoff.failure }),
  notes: draftHandoff.notes,
});

export const completeBuilderPass = async ({
  paths,
  specId,
  handoff: draftHandoff,
}: {
  paths: GetMaestroPaths;
  specId: string;
  handoff: BuilderHandoffSubmissionInput;
}): Promise<CompletedBuilderPass> => {
  const builderWorktreePath = paths.repositoryRoot;
  await assertWorktree({
    repositoryRoot: paths.repositoryRoot,
    branch: paths.getBuilderBranch(specId),
    worktreePath: builderWorktreePath,
  });

  const checkpoint = await getBuilderCheckpoint({
    worktreePath: builderWorktreePath,
  });

  await assertProtocolFilesUnchanged({
    paths,
    specId,
    worktreePath: builderWorktreePath,
    checkpoint,
  });

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
    worktreePath: builderWorktreePath,
  };
};
