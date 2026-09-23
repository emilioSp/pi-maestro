import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import {
  builderWorkflowPath,
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

const prepareCandidate = async () => {
  const { paths, builderWorktreePath } = await createApprovedWorkflow();
  const builderLaunch = await prepareBuilderLaunch({ paths, specId: SPEC_ID });
  await writeFile(join(builderWorktreePath, 'product.txt'), 'candidate\n');
  await completeBuilderPass({
    paths,
    specId: SPEC_ID,
    handoff: doneHandoff(builderLaunch.revision + 1),
  });
  await commitAll({ path: builderWorktreePath, message: 'Builder candidate' });
  return { paths, builderWorktreePath };
};

describe('verifier launch preparation', () => {
  it('creates a fresh verifier worktree from the candidate and commits running state', async () => {
    const { paths, builderWorktreePath } = await prepareCandidate();
    const candidateCommit = await getHeadCommit({
      repositoryRoot: builderWorktreePath,
    });

    const launch = await prepareVerifierLaunch({ paths, specId: SPEC_ID });

    expect(launch).toMatchObject({
      specId: SPEC_ID,
      pass: 1,
      candidateCommit,
      branch: paths.getVerifierBranch({ specId: SPEC_ID, pass: 1 }),
      worktreePath: paths.getVerifierWorktreePath({ specId: SPEC_ID, pass: 1 }),
      revision: 5,
    });
    expect(launch.worktreePath).not.toBe(builderWorktreePath);
    await expect(
      getHeadCommit({ repositoryRoot: launch.worktreePath }),
    ).resolves.toBe(launch.checkpointCommit);
    await expect(
      readWorkflowState({
        path: join(launch.worktreePath, '.specs', SPEC_ID, 'workflow.json'),
      }),
    ).resolves.toMatchObject({
      revision: launch.revision,
      phase: WORKFLOW_PHASES.VERIFIER_RUNNING,
    });
    await expect(
      readWorkflowState({ path: builderWorkflowPath(builderWorktreePath) }),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.READY_FOR_VERIFIER });
  });

  it('uses the next verifier pass number', async () => {
    const { paths } = await prepareCandidate();
    const first = await prepareVerifierLaunch({ paths, specId: SPEC_ID });

    const second = await prepareVerifierLaunch({ paths, specId: SPEC_ID });

    expect(first.pass).toBe(1);
    expect(second.pass).toBe(2);
    expect(second.branch).toBe(
      paths.getVerifierBranch({ specId: SPEC_ID, pass: 2 }),
    );
  });
});
