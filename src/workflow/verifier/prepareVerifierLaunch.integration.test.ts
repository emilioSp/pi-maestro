import { afterEach, describe, expect, it } from 'vitest';
import { getCurrentBranch } from '#git/repository/getCurrentBranch.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
import {
  cleanupBuilderWorkflows,
  commitAll,
  createApprovedWorkflow,
  doneHandoff,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderLaunch } from '#workflow/builder/prepareBuilderLauncher.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { prepareVerifierLaunch } from '#workflow/verifier/prepareVerifierLaunch.ts';

afterEach(cleanupBuilderWorkflows);

describe('verifier launch preparation', () => {
  it('uses the current HEAD as the candidate and commits the running checkpoint', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    const builderLaunch = await prepareBuilderLaunch({
      paths,
      specId: SPEC_ID,
    });
    await completeBuilderPass({
      paths,
      specId: SPEC_ID,
      handoff: {
        status: 'done',
        summary: 'Implemented the approved change.',
        acceptanceCriteria: [],
        notes: [],
      },
    });
    const builderHandoff = doneHandoff(builderLaunch.revision + 1);
    expect(builderHandoff.status).toBe('done');
    await commitAll({ path: repository.path, message: 'Builder completed' });
    const candidateBefore = await getHeadCommit({
      repositoryRoot: repository.path,
    });

    const launch = await prepareVerifierLaunch({ paths, specId: SPEC_ID });

    expect(launch.candidateCommit).toBe(candidateBefore);
    expect(launch.repositoryRoot).toBe(repository.path);
    expect(launch.checkpointCommit).not.toBe(candidateBefore);
    await expect(
      getCurrentBranch({ repositoryRoot: repository.path }),
    ).resolves.toBe('main');
    await expect(
      getRepositoryStatus({ repositoryRoot: repository.path }),
    ).resolves.toMatchObject({ clean: true });
    await expect(
      readWorkflowState({ path: paths.getWorkflowPath(SPEC_ID) }),
    ).resolves.toMatchObject({
      phase: WORKFLOW_PHASES.VERIFIER_RUNNING,
    });
  });
});
