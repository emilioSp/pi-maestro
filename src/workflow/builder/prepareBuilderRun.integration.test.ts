import { afterEach, describe, expect, it } from 'vitest';
import {
  BUILDER_HANDOFF_STATUSES,
  PROBE_STATUSES,
} from '#artifacts/builder-handoff/schema.ts';
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
  it('saves the running phase in the current project', async () => {
    const { paths, repository } = await createApprovedWorkflow();

    const run = await prepareBuilderRun({ paths, specId: SPEC_ID });

    expect(run).toMatchObject({
      specId: SPEC_ID,
      projectRoot: repository.path,
    });
    await expect(
      readWorkflowState(paths.getWorkflowPath(SPEC_ID)),
    ).resolves.toMatchObject({
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
    const { paths } = await createApprovedWorkflow();
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

    await expect(prepareBuilderRun({ paths, specId: SPEC_ID })).rejects.toThrow(
      'Builder run is not valid from phase "builder-failed".',
    );
    await expect(
      readWorkflowState(paths.getWorkflowPath(SPEC_ID)),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.BUILDER_FAILED });
    await expect(
      pathExists(
        paths.getBuilderHandoffPath({ specId: SPEC_ID, handoffNumber: 1 }),
      ),
    ).resolves.toBe(true);
  });
});
