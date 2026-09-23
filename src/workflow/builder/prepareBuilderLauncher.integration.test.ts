import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { branchExists } from '#git/branches/branchExists.ts';
import { CHECKPOINT_COMMIT_MESSAGE } from '#git/commits/createCommit.ts';
import { findCommitByMessage } from '#git/commits/findCommitByMessage.ts';
import { getCurrentBranch } from '#git/repository/getCurrentBranch.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
import {
  builderHandoffPath,
  builderWorkflowPath,
  cleanupBuilderWorkflows,
  commitAll,
  createApprovedWorkflow,
  failedHandoff,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { pathExists } from '#utils/path-exists.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderLaunch } from '#workflow/builder/prepareBuilderLauncher.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';

afterEach(cleanupBuilderWorkflows);

describe('builder launch preparation', () => {
  it('creates a builder branch, worktree, and committed running checkpoint', async () => {
    const { paths, builderBranch, builderWorktreePath } =
      await createApprovedWorkflow();

    const launch = await prepareBuilderLaunch({
      paths,
      specId: SPEC_ID,
    });

    expect(launch).toMatchObject({
      specId: SPEC_ID,
      revision: 3,
      branch: builderBranch,
      worktreePath: builderWorktreePath,
    });
    expect(
      await getCurrentBranch({ repositoryRoot: builderWorktreePath }),
    ).toBe(builderBranch);
    expect(await getHeadCommit({ repositoryRoot: builderWorktreePath })).toBe(
      launch.checkpointCommit,
    );
    await expect(
      findCommitByMessage({
        repositoryRoot: builderWorktreePath,
        message: CHECKPOINT_COMMIT_MESSAGE,
      }),
    ).resolves.toBe(launch.checkpointCommit);
    await expect(
      readWorkflowState({ path: builderWorkflowPath(builderWorktreePath) }),
    ).resolves.toMatchObject({
      revision: 3,
      phase: WORKFLOW_PHASES.BUILDER_RUNNING,
    });
  });

  it('blocks an uncommitted approval before creating builder resources', async () => {
    const { paths, builderBranch, builderWorktreePath } =
      await createApprovedWorkflow({ commitApproval: false });

    await expect(
      prepareBuilderLaunch({ paths, specId: SPEC_ID }),
    ).rejects.toThrow('clean base branch');
    await expect(
      branchExists({
        repositoryRoot: paths.repositoryRoot,
        branch: builderBranch,
      }),
    ).resolves.toBe(false);
    await expect(pathExists(builderWorktreePath)).resolves.toBe(false);
  });

  it('blocks a dirty base without changing builder resources', async () => {
    const { paths, repository, builderBranch, builderWorktreePath } =
      await createApprovedWorkflow();
    await writeFile(join(repository.path, 'owner-change.txt'), 'dirty\n');

    await expect(
      prepareBuilderLaunch({ paths, specId: SPEC_ID }),
    ).rejects.toThrow('clean base branch');
    await expect(
      branchExists({
        repositoryRoot: paths.repositoryRoot,
        branch: builderBranch,
      }),
    ).resolves.toBe(false);
    await expect(pathExists(builderWorktreePath)).resolves.toBe(false);
  });

  it('requires an explicit retry and reuses recovered resources', async () => {
    const { paths, builderWorktreePath } = await createApprovedWorkflow();
    const firstLaunch = await prepareBuilderLaunch({
      paths,
      specId: SPEC_ID,
    });
    const firstHead = await getHeadCommit({
      repositoryRoot: builderWorktreePath,
    });

    await expect(
      prepareBuilderLaunch({ paths, specId: SPEC_ID }),
    ).rejects.toThrow('retry must be explicit');
    await expect(
      getHeadCommit({ repositoryRoot: builderWorktreePath }),
    ).resolves.toBe(firstHead);

    const retry = await prepareBuilderLaunch({
      paths,
      specId: SPEC_ID,
      retry: true,
    });

    expect(retry.revision).toBe(firstLaunch.revision + 1);
    expect(retry.worktreePath).toBe(builderWorktreePath);
    await expect(
      getRepositoryStatus({ repositoryRoot: builderWorktreePath }),
    ).resolves.toMatchObject({ clean: true });
  });

  it('retries an explicit failed pass and removes the old terminal handoff', async () => {
    const { paths, builderWorktreePath } = await createApprovedWorkflow();
    const launch = await prepareBuilderLaunch({ paths, specId: SPEC_ID });
    await completeBuilderPass({
      paths,
      specId: SPEC_ID,
      handoff: failedHandoff(launch.revision + 1),
    });
    await commitAll({
      path: builderWorktreePath,
      message: 'Builder failed',
    });

    const retry = await prepareBuilderLaunch({
      paths,
      specId: SPEC_ID,
      retry: true,
    });

    expect(retry.revision).toBe(launch.revision + 2);
    await expect(
      pathExists(builderHandoffPath(builderWorktreePath)),
    ).resolves.toBe(false);
    await expect(
      readWorkflowState({ path: builderWorkflowPath(builderWorktreePath) }),
    ).resolves.toMatchObject({
      revision: retry.revision,
      phase: WORKFLOW_PHASES.BUILDER_RUNNING,
    });
  });

  it('blocks a retry when the builder worktree is dirty', async () => {
    const { paths, builderWorktreePath } = await createApprovedWorkflow();
    await prepareBuilderLaunch({ paths, specId: SPEC_ID });
    const workflowPath = builderWorkflowPath(builderWorktreePath);
    await writeFile(
      join(builderWorktreePath, 'unfinished.txt'),
      'unfinished\n',
    );

    await expect(
      prepareBuilderLaunch({ paths, specId: SPEC_ID, retry: true }),
    ).rejects.toThrow('builder worktree is dirty');
    await expect(
      readWorkflowState({ path: workflowPath }),
    ).resolves.toMatchObject({
      revision: 3,
      phase: WORKFLOW_PHASES.BUILDER_RUNNING,
    });
  });

  it('starts a correction pass on the existing builder resources', async () => {
    const { paths, builderBranch, builderWorktreePath } =
      await createApprovedWorkflow();
    await prepareBuilderLaunch({ paths, specId: SPEC_ID });
    const workflowPath = builderWorkflowPath(builderWorktreePath);
    const runningState = await readWorkflowState({ path: workflowPath });
    const correctionState = {
      ...runningState,
      revision: runningState.revision + 1,
      phase: WORKFLOW_PHASES.READY_FOR_BUILDER,
    };
    await writeWorkflowState({
      path: workflowPath,
      state: correctionState,
      currentRevision: runningState.revision,
    });
    await commitAll({
      path: builderWorktreePath,
      message: 'Request builder corrections',
    });

    const correction = await prepareBuilderLaunch({
      paths,
      specId: SPEC_ID,
    });

    expect(correction).toMatchObject({
      revision: correctionState.revision + 1,
      branch: builderBranch,
      worktreePath: builderWorktreePath,
    });
  });
});
