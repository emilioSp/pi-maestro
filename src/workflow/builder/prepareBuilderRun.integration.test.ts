import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BUILDER_HANDOFF_STATUSES,
  PROBE_STATUSES,
} from '#artifacts/builder-handoff/schema.ts';
import { runGitCommand } from '#git/command.ts';
import { getCurrentBranch } from '#git/repository/getCurrentBranch.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { pathExists } from '#utils/path-exists.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';

afterEach(cleanupBuilderWorkflows);

describe('builder run preparation', () => {
  it('commits a running checkpoint on the current branch without workflow resources', async () => {
    const { paths, repository } = await createApprovedWorkflow();

    const run = await prepareBuilderRun({ paths, specId: SPEC_ID });

    expect(run).toMatchObject({
      specId: SPEC_ID,
      revision: 3,
      repositoryRoot: repository.path,
    });
    await expect(getCurrentBranch(repository.path)).resolves.toBe('main');
    await expect(getHeadCommit(repository.path)).resolves.toBe(
      run.checkpointCommit,
    );
    await expect(
      readWorkflowState(paths.getWorkflowPath(SPEC_ID)),
    ).resolves.toMatchObject({
      revision: 3,
      phase: WORKFLOW_PHASES.BUILDER_RUNNING,
    });
  });

  it('does not rerun a builder while it is running', async () => {
    const { paths } = await createApprovedWorkflow();
    await prepareBuilderRun({ paths, specId: SPEC_ID });

    await expect(prepareBuilderRun({ paths, specId: SPEC_ID })).rejects.toThrow(
      'Builder run is not valid from phase "builder-running".',
    );
  });

  it('stops after a builder failure and does not run again', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    await prepareBuilderRun({ paths, specId: SPEC_ID });

    await completeBuilderPass({
      paths,
      specId: SPEC_ID,
      handoff: {
        status: BUILDER_HANDOFF_STATUSES.FAILED,
        summary: 'The builder was blocked.',
        acceptanceCriteria: [
          {
            id: 'AC1',
            probe: 'npm test',
            probeStatus: PROBE_STATUSES.NOT_RUN,
          },
        ],
        failure: { reason: 'The implementation was blocked.' },
        notes: [],
      },
    });
    await repository.commit('Builder failed');

    await expect(prepareBuilderRun({ paths, specId: SPEC_ID })).rejects.toThrow(
      'Builder run is not valid from phase "builder-failed".',
    );
    await expect(
      readWorkflowState(paths.getWorkflowPath(SPEC_ID)),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.BUILDER_FAILED });
    await expect(
      pathExists(paths.getBuilderHandoffPath(SPEC_ID)),
    ).resolves.toBe(true);
  });

  it('rejects an uncommitted current checkout before creating a checkpoint', async () => {
    const { paths, repository } = await createApprovedWorkflow({
      commitApproval: false,
    });

    await expect(prepareBuilderRun({ paths, specId: SPEC_ID })).rejects.toThrow(
      'clean current checkout',
    );
    await expect(getCurrentBranch(repository.path)).resolves.toBe('main');
  });

  it('rejects dirty product changes in the current checkout', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    await writeFile(
      join(repository.path, 'owner-change.txt'),
      'dirty\n',
      'utf8',
    );

    await expect(prepareBuilderRun({ paths, specId: SPEC_ID })).rejects.toThrow(
      'clean current checkout',
    );
  });

  it('rejects staged product changes', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    const stagedPath = join(repository.path, 'staged-change.txt');
    await writeFile(stagedPath, 'staged\n', 'utf8');
    await runGitCommand({
      arguments: ['add', '--', stagedPath],
      cwd: repository.path,
    });

    await expect(prepareBuilderRun({ paths, specId: SPEC_ID })).rejects.toThrow(
      'clean current checkout',
    );
  });
});
