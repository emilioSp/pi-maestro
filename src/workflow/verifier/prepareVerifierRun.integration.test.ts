import { afterEach, describe, expect, it } from 'vitest';
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
  it('given completed builder work when verification starts then the live project enters verifier-running', async () => {
    const { paths, repository } = await createApprovedWorkflow();

    await prepareBuilderRun({
      paths,
      specId: SPEC_ID,
    });

    await completeBuilderPass({
      paths,
      specId: SPEC_ID,
      handoff: doneHandoff(),
    });

    const run = await prepareVerifierRun({ paths, specId: SPEC_ID });

    expect(run.projectRoot).toBe(repository.path);

    await expect(
      readWorkflowState(paths.getWorkflowPath(SPEC_ID)),
    ).resolves.toMatchObject({
      phase: WORKFLOW_PHASES.VERIFIER_RUNNING,
    });
  });
});
