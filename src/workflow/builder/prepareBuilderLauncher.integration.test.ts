import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runGitCommand } from '#git/command.ts';
import { getCurrentBranch } from '#git/repository/getCurrentBranch.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import {
  cleanupBuilderWorkflows,
  commitAll,
  createApprovedWorkflow,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { pathExists } from '#utils/path-exists.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderLaunch } from '#workflow/builder/prepareBuilderLauncher.ts';
import { markSpecReady } from '#workflow/spec/markSpecReady.ts';
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

  it('retries a failed builder', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    const firstLaunch = await prepareBuilderLaunch({
      paths,
      specId: SPEC_ID,
    });
    const firstSpecSha = maestroSessionState.getSpecSha256();

    await completeBuilderPass({
      paths,
      specId: SPEC_ID,
      handoff: {
        status: 'failed',
        summary: 'The builder was blocked.',
        acceptanceCriteria: [
          {
            id: 'AC1',
            probe: 'npm test',
            probeStatus: 'not-run',
            breakageStatus: 'not-run',
          },
        ],
        failure: { reason: 'The implementation was blocked.' },
        notes: [],
      },
    });
    await commitAll({ path: repository.path, message: 'Builder failed' });

    const retry = await prepareBuilderLaunch({
      paths,
      specId: SPEC_ID,
      retry: true,
    });

    expect(retry).toMatchObject({
      specId: SPEC_ID,
      revision: firstLaunch.revision + 2,
      repositoryRoot: repository.path,
    });
    await expect(
      getCurrentBranch({ repositoryRoot: repository.path }),
    ).resolves.toBe('main');
    await expect(
      getHeadCommit({ repositoryRoot: repository.path }),
    ).resolves.toBe(retry.checkpointCommit);
    await expect(
      readWorkflowState({ path: paths.getWorkflowPath(SPEC_ID) }),
    ).resolves.toMatchObject({
      revision: retry.revision,
      phase: WORKFLOW_PHASES.BUILDER_RUNNING,
    });
    await expect(
      pathExists(paths.getBuilderHandoffPath(SPEC_ID)),
    ).resolves.toBe(false);
    expect(maestroSessionState.getSpecSha256()).toBe(firstSpecSha);
  });

  it('starts a normal builder launch after an approved spec revision', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    const firstLaunch = await prepareBuilderLaunch({
      paths,
      specId: SPEC_ID,
    });
    const firstSpecSha = maestroSessionState.getSpecSha256();

    await completeBuilderPass({
      paths,
      specId: SPEC_ID,
      handoff: {
        status: 'failed',
        summary: 'The builder was blocked.',
        acceptanceCriteria: [
          {
            id: 'AC1',
            probe: 'npm test',
            probeStatus: 'not-run',
            breakageStatus: 'not-run',
          },
        ],
        failure: { reason: 'The implementation was blocked.' },
        notes: [],
      },
    });
    await commitAll({ path: repository.path, message: 'Builder failed' });

    await writeFile(
      paths.getSpecFilePath(SPEC_ID),
      '# Revised owner-approved content\n',
      'utf8',
    );
    await markSpecReady({
      paths,
      specId: SPEC_ID,
      activeWorkflowSpecId: SPEC_ID,
    });
    await commitAll({
      path: repository.path,
      message: 'Approve revised builder spec',
    });

    const launch = await prepareBuilderLaunch({
      paths,
      specId: SPEC_ID,
    });

    expect(launch).toMatchObject({
      specId: SPEC_ID,
      revision: firstLaunch.revision + 3,
      repositoryRoot: repository.path,
    });
    expect(maestroSessionState.getSpecSha256()).not.toBe(firstSpecSha);
    await expect(
      getHeadCommit({ repositoryRoot: repository.path }),
    ).resolves.toBe(launch.checkpointCommit);
  });

  it('requires the owner to commit an approved spec revision before launch', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    await prepareBuilderLaunch({ paths, specId: SPEC_ID });
    await completeBuilderPass({
      paths,
      specId: SPEC_ID,
      handoff: {
        status: 'failed',
        summary: 'The builder was blocked.',
        acceptanceCriteria: [
          {
            id: 'AC1',
            probe: 'npm test',
            probeStatus: 'not-run',
            breakageStatus: 'not-run',
          },
        ],
        failure: { reason: 'The implementation was blocked.' },
        notes: [],
      },
    });
    await commitAll({ path: repository.path, message: 'Builder failed' });

    await markSpecReady({
      paths,
      specId: SPEC_ID,
      activeWorkflowSpecId: SPEC_ID,
    });

    await expect(
      prepareBuilderLaunch({ paths, specId: SPEC_ID }),
    ).rejects.toThrow('clean current checkout');
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

  it('rejects staged product changes', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    const stagedPath = join(repository.path, 'staged-change.txt');
    await writeFile(stagedPath, 'staged\n', 'utf8');
    await runGitCommand({
      arguments: ['add', '--', stagedPath],
      cwd: repository.path,
    });

    await expect(
      prepareBuilderLaunch({ paths, specId: SPEC_ID }),
    ).rejects.toThrow('clean current checkout');
  });
});
