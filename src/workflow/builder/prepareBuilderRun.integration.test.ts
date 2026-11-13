import { afterEach, describe, expect, it } from 'vitest';

import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import { TEST_CONFIG } from '#tests/fixtures/config/selected-agents.ts';
import { createApprovedWorkflow, SPEC_ID } from '#tests/support/builder-workflow.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';

afterEach(() => maestroSessionState.deactivate());

describe('builder run preparation', () => {
  it('GIVEN a workflow ready for the builder WHEN a run is prepared THEN builder-running is saved and the run uses the current project', async () => {
    maestroSessionState.activate();
    maestroSessionState.setActiveSpecId(SPEC_ID);

    const { paths, repository } = await createApprovedWorkflow();

    const run = await prepareBuilderRun({ config: TEST_CONFIG, paths, specId: SPEC_ID });

    expect(run).toMatchObject({
      specId: SPEC_ID,
      projectRoot: repository.path,
    });
    await expect(readWorkflowState(paths.getWorkflowPath(SPEC_ID))).resolves.toMatchObject({
      phase: WORKFLOW_PHASES.BUILDER_RUNNING,
    });
  });

  it('GIVEN the builder is already running WHEN another builder run is requested THEN preparation fails with a builder-running phase error', async () => {
    maestroSessionState.activate();
    maestroSessionState.setActiveSpecId(SPEC_ID);

    const { paths } = await createApprovedWorkflow();
    await prepareBuilderRun({ config: TEST_CONFIG, paths, specId: SPEC_ID });

    await expect(
      prepareBuilderRun({ config: TEST_CONFIG, paths, specId: SPEC_ID }),
    ).rejects.toThrow('Builder run is not valid from phase "builder-running".');
  });
});
