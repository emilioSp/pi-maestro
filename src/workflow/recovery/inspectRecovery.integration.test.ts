import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runGitCommand } from '#git/command.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
import {
  cleanupBuilderWorkflows,
  commitAll,
  createApprovedWorkflow,
  doneHandoff,
  failedHandoff,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderLaunch } from '#workflow/builder/prepareBuilderLauncher.ts';
import {
  inspectRecovery,
  RECOVERY_ACTIONS,
  RECOVERY_STATUSES,
} from '#workflow/recovery/inspectRecovery.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { prepareVerifierLaunch } from '#workflow/verifier/prepareVerifierLaunch.ts';

afterEach(cleanupBuilderWorkflows);

const prepareInterruptedBuilder = async () => {
  const workflow = await createApprovedWorkflow();
  await prepareBuilderLaunch({ paths: workflow.paths, specId: SPEC_ID });
  const state = await readWorkflowState({
    path: workflow.paths.getWorkflowPathInWorktree({
      specId: SPEC_ID,
      worktreePath: workflow.builderWorktreePath,
    }),
  });
  return { ...workflow, state };
};

const prepareInterruptedVerifier = async () => {
  const workflow = await createApprovedWorkflow();
  const builderLaunch = await prepareBuilderLaunch({
    paths: workflow.paths,
    specId: SPEC_ID,
  });
  await completeBuilderPass({
    paths: workflow.paths,
    specId: SPEC_ID,
    handoff: doneHandoff(builderLaunch.revision + 1),
  });
  await commitAll({
    path: workflow.builderWorktreePath,
    message: 'Builder candidate',
  });
  const verifierLaunch = await prepareVerifierLaunch({
    paths: workflow.paths,
    specId: SPEC_ID,
  });
  const state = await readWorkflowState({
    path: workflow.paths.getWorkflowPathInWorktree({
      specId: SPEC_ID,
      worktreePath: verifierLaunch.worktreePath,
    }),
  });
  return { ...workflow, verifierLaunch, state };
};

describe('inspectRecovery', () => {
  it('reports a clean interrupted builder and its explicit retry action', async () => {
    const { paths, state, builderBranch, builderWorktreePath } =
      await prepareInterruptedBuilder();

    await expect(inspectRecovery({ paths, state })).resolves.toMatchObject({
      status: RECOVERY_STATUSES.INTERRUPTED,
      role: 'builder',
      branch: builderBranch,
      worktreePath: builderWorktreePath,
      dirty: false,
      retryAction: RECOVERY_ACTIONS.RETRY_BUILDER,
      resumeAllowed: false,
      issues: [],
    });
  });

  it('reports a clean interrupted verifier and its explicit retry action', async () => {
    const { paths, state, verifierLaunch } = await prepareInterruptedVerifier();

    await expect(inspectRecovery({ paths, state })).resolves.toMatchObject({
      status: RECOVERY_STATUSES.INTERRUPTED,
      role: 'verifier',
      branch: verifierLaunch.branch,
      worktreePath: verifierLaunch.worktreePath,
      dirty: false,
      retryAction: RECOVERY_ACTIONS.RETRY_VERIFIER,
      resumeAllowed: false,
      issues: [],
    });
  });

  it('allows a clean explicit retry but does not mutate the workflow', async () => {
    const { paths, state, builderWorktreePath } =
      await prepareInterruptedBuilder();
    const headBefore = await getHeadCommit({
      repositoryRoot: builderWorktreePath,
    });
    const workflowBefore = await readWorkflowState({
      path: paths.getWorkflowPathInWorktree({
        specId: SPEC_ID,
        worktreePath: builderWorktreePath,
      }),
    });

    const inspection = await inspectRecovery({ paths, state });

    expect(inspection.retryAction).toBe(RECOVERY_ACTIONS.RETRY_BUILDER);
    expect(await getHeadCommit({ repositoryRoot: builderWorktreePath })).toBe(
      headBefore,
    );
    await expect(
      readWorkflowState({
        path: paths.getWorkflowPathInWorktree({
          specId: SPEC_ID,
          worktreePath: builderWorktreePath,
        }),
      }),
    ).resolves.toEqual(workflowBefore);
  });

  it('blocks retry when the expected worktree is missing', async () => {
    const { paths, state, builderWorktreePath } =
      await prepareInterruptedBuilder();
    await runGitCommand({
      arguments: ['worktree', 'remove', '--force', builderWorktreePath],
      cwd: paths.repositoryRoot,
    });

    await expect(inspectRecovery({ paths, state })).resolves.toMatchObject({
      status: RECOVERY_STATUSES.BLOCKED,
      worktreePath: null,
      retryAction: null,
      issues: [
        expect.stringContaining('Expected builder worktree is missing:'),
      ],
    });
  });

  it('blocks retry for a dirty worktree', async () => {
    const { paths, state, builderWorktreePath } =
      await prepareInterruptedBuilder();
    await writeFile(
      join(builderWorktreePath, 'uncommitted.txt'),
      'work in progress\n',
    );

    await expect(inspectRecovery({ paths, state })).resolves.toMatchObject({
      status: RECOVERY_STATUSES.BLOCKED,
      dirty: true,
      retryAction: null,
      issues: ['Expected builder worktree is dirty.'],
    });
  });

  it('blocks a builder phase when its handoff is missing', async () => {
    const { paths, state, builderWorktreePath } =
      await prepareInterruptedBuilder();
    const completed = await completeBuilderPass({
      paths,
      specId: SPEC_ID,
      handoff: failedHandoff(state.revision + 1),
    });
    const failedState = await readWorkflowState({
      path: paths.getWorkflowPathInWorktree({
        specId: SPEC_ID,
        worktreePath: builderWorktreePath,
      }),
    });
    expect(failedState.revision).toBe(completed.state.revision);
    await rm(
      paths.getBuilderHandoffPathInWorktree({
        specId: SPEC_ID,
        worktreePath: builderWorktreePath,
      }),
    );

    await expect(
      inspectRecovery({ paths, state: failedState }),
    ).resolves.toMatchObject({
      status: RECOVERY_STATUSES.BLOCKED,
      retryAction: null,
      issues: expect.arrayContaining([
        'Builder handoff is missing or invalid.',
      ]),
    });
  });

  it('blocks when the base branch no longer precedes the builder branch', async () => {
    const { paths, state, repository } = await prepareInterruptedBuilder();
    await writeFile(
      join(repository.path, 'divergent.txt'),
      'new base commit\n',
    );
    await runGitCommand({
      arguments: ['add', '--', 'divergent.txt'],
      cwd: repository.path,
    });
    await runGitCommand({
      arguments: ['commit', '--message', 'Advance base independently'],
      cwd: repository.path,
    });

    await expect(inspectRecovery({ paths, state })).resolves.toMatchObject({
      status: RECOVERY_STATUSES.BLOCKED,
      retryAction: null,
      issues: expect.arrayContaining([
        'Builder branch has broken ancestry from the workflow base branch.',
      ]),
    });
  });

  it('treats final-review as completed and never offers resume or retry', async () => {
    const { paths } = await createApprovedWorkflow();
    const state = {
      version: '1.0.0',
      specId: SPEC_ID,
      revision: 2,
      phase: WORKFLOW_PHASES.FINAL_REVIEW,
      baseBranch: 'main',
    } as const;

    await expect(inspectRecovery({ paths, state })).resolves.toMatchObject({
      status: RECOVERY_STATUSES.COMPLETED,
      resumeAllowed: false,
      retryAction: null,
      issues: [],
    });
  });

  it('keeps a clean non-running workflow resumable without mutation', async () => {
    const { paths } = await createApprovedWorkflow();
    const state = {
      version: '1.0.0',
      specId: SPEC_ID,
      revision: 1,
      phase: WORKFLOW_PHASES.READY_FOR_BUILDER,
      baseBranch: 'main',
    } as const;
    const statusBefore = await getRepositoryStatus({
      repositoryRoot: paths.repositoryRoot,
    });

    const result = await inspectRecovery({ paths, state });

    expect(result).toMatchObject({
      status: RECOVERY_STATUSES.READY,
      resumeAllowed: true,
      retryAction: null,
    });
    expect(
      await getRepositoryStatus({ repositoryRoot: paths.repositoryRoot }),
    ).toEqual(statusBefore);
  });
});
