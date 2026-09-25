import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getCurrentBranch } from '#git/repository/getCurrentBranch.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { pathExists } from '#utils/path-exists.ts';
import { prepareBuilderLaunch } from '#workflow/builder/prepareBuilderLauncher.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';

afterEach(cleanupBuilderWorkflows);

describe('builder launch preparation', () => {
  it('commits a running checkpoint on the current branch without workflow resources', async () => {
    const { paths, repository } = await createApprovedWorkflow();

    const launch = await prepareBuilderLaunch({ paths, specId: SPEC_ID });

    expect(launch).toMatchObject({
      specId: SPEC_ID,
      revision: 3,
      repositoryRoot: repository.path,
    });
    await expect(
      getCurrentBranch({ repositoryRoot: repository.path }),
    ).resolves.toBe('main');
    await expect(
      getHeadCommit({ repositoryRoot: repository.path }),
    ).resolves.toBe(launch.checkpointCommit);
    await expect(
      readWorkflowState({ path: paths.getWorkflowPath(SPEC_ID) }),
    ).resolves.toMatchObject({
      revision: 3,
      phase: WORKFLOW_PHASES.BUILDER_RUNNING,
    });
    await expect(pathExists(join(repository.path, '.worktree'))).resolves.toBe(
      false,
    );
    expect(maestroSessionState.getSpecSha256()).not.toBeNull();
  });

  it('does not relaunch a builder while it is running', async () => {
    const { paths } = await createApprovedWorkflow();
    await prepareBuilderLaunch({ paths, specId: SPEC_ID });

    await expect(
      prepareBuilderLaunch({ paths, specId: SPEC_ID, retry: true }),
    ).rejects.toThrow(
      'Builder launch is not valid from phase "builder-running".',
    );
  });

  it('rejects an uncommitted current checkout before creating a checkpoint', async () => {
    const { paths, repository } = await createApprovedWorkflow({
      commitApproval: false,
    });

    await expect(
      prepareBuilderLaunch({ paths, specId: SPEC_ID }),
    ).rejects.toThrow('clean current checkout');
    await expect(
      getCurrentBranch({ repositoryRoot: repository.path }),
    ).resolves.toBe('main');
  });

  it('rejects dirty product changes in the current checkout', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    await writeFile(
      join(repository.path, 'owner-change.txt'),
      'dirty\n',
      'utf8',
    );

    await expect(
      prepareBuilderLaunch({ paths, specId: SPEC_ID }),
    ).rejects.toThrow('clean current checkout');
  });
});
