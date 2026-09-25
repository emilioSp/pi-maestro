import { afterEach, describe, expect, it } from 'vitest';
import { runGitCommand } from '#git/command.ts';
import {
  cleanupBuilderWorkflows,
  commitAll,
  createApprovedWorkflow,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderLaunch } from '#workflow/builder/prepareBuilderLauncher.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';

afterEach(cleanupBuilderWorkflows);

describe('builder completion', () => {
  it('writes the builder handoff and state in the current checkout', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    const launch = await prepareBuilderLaunch({ paths, specId: SPEC_ID });
    const handoff = {
      status: 'done' as const,
      summary: 'Implemented the approved change.',
      acceptanceCriteria: [],
      notes: [],
    };

    const completed = await completeBuilderPass({
      paths,
      specId: SPEC_ID,
      handoff,
    });

    expect(completed.repositoryRoot).toBe(repository.path);
    expect(completed.state.phase).toBe(WORKFLOW_PHASES.READY_FOR_VERIFIER);
    await commitAll({ path: repository.path, message: 'Builder completed' });
    await expect(
      readWorkflowState({ path: paths.getWorkflowPath(SPEC_ID) }),
    ).resolves.toMatchObject({
      revision: launch.revision + 1,
      phase: WORKFLOW_PHASES.READY_FOR_VERIFIER,
    });
    await expect(
      runGitCommand({
        arguments: ['log', '-1', '--format=%s'],
        cwd: repository.path,
      }),
    ).resolves.toMatchObject({ stdout: 'Builder completed\n' });
  });
});
