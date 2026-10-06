import { afterEach, describe, expect, it } from 'vitest';
import { getCurrentBranch } from '#git/repository/getCurrentBranch.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  doneHandoff,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { prepareVerifierRun } from '#workflow/verifier/prepareVerifierRun.ts';

afterEach(cleanupBuilderWorkflows);

describe('verifier run preparation', () => {
  it('given completed builder work when verification starts then the running checkpoint is the fixed candidate', async () => {
    const { paths, repository } = await createApprovedWorkflow();

    const builderRun = await prepareBuilderRun({
      paths,
      specId: SPEC_ID,
    });

    await completeBuilderPass({
      paths,
      specId: SPEC_ID,
      handoff: doneHandoff(builderRun.revision + 1),
    });
    await repository.commit('Builder completed');

    const candidateBefore = await getHeadCommit(repository.path);

    const run = await prepareVerifierRun({ paths, specId: SPEC_ID });

    expect(run.candidateCommit).toBe(run.checkpointCommit);
    await expect(getHeadCommit(repository.path)).resolves.toBe(
      run.candidateCommit,
    );
    expect(run.repositoryRoot).toBe(repository.path);
    expect(run.checkpointCommit).not.toBe(candidateBefore);
    await expect(getCurrentBranch(repository.path)).resolves.toBe('main');
    await expect(getRepositoryStatus(repository.path)).resolves.toMatchObject({
      clean: true,
    });
    await expect(
      readWorkflowState(paths.getWorkflowPath(SPEC_ID)),
    ).resolves.toMatchObject({
      phase: WORKFLOW_PHASES.VERIFIER_RUNNING,
    });
  });
});
