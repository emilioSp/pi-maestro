import { afterEach, describe, expect, it } from 'vitest';
import { BUILDER_HANDOFF_STATUSES } from '#artifacts/builder-handoff/schema.ts';
import { runGitCommand } from '#git/command.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';

afterEach(cleanupBuilderWorkflows);

describe('builder completion', () => {
  it('writes the builder handoff and state in the current checkout', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    const run = await prepareBuilderRun({ paths, specId: SPEC_ID });

    const handoff = {
      status: BUILDER_HANDOFF_STATUSES.DONE,
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
    await repository.commit('Builder completed');
    await expect(
      readWorkflowState(paths.getWorkflowPath(SPEC_ID)),
    ).resolves.toMatchObject({
      revision: run.revision + 1,
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
