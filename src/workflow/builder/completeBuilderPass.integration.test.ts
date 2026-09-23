import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  builderHandoffPath,
  builderWorkflowPath,
  cleanupBuilderWorkflows,
  commitAll,
  createApprovedWorkflow,
  doneHandoff,
  failedHandoff,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { pathExists } from '#utils/path-exists.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderLaunch } from '#workflow/builder/prepareBuilderLauncher.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';

afterEach(cleanupBuilderWorkflows);

describe('builder pass completion', () => {
  it('moves a done builder pass to ready-for-verifier', async () => {
    const { paths, builderWorktreePath } = await createApprovedWorkflow();
    const launch = await prepareBuilderLaunch({ paths, specId: SPEC_ID });
    await writeFile(join(builderWorktreePath, 'product.txt'), 'implemented\n');

    const completed = await completeBuilderPass({
      paths,
      specId: SPEC_ID,
      handoff: doneHandoff(launch.revision + 1),
    });

    expect(completed.state).toMatchObject({
      revision: launch.revision + 1,
      phase: WORKFLOW_PHASES.READY_FOR_VERIFIER,
    });
    await commitAll({
      path: builderWorktreePath,
      message: 'Builder done',
    });
    await expect(
      readWorkflowState({ path: builderWorkflowPath(builderWorktreePath) }),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.READY_FOR_VERIFIER });
    await expect(
      pathExists(builderHandoffPath(builderWorktreePath)),
    ).resolves.toBe(true);
  });

  it('moves a failed builder pass to builder-failed', async () => {
    const { paths, builderWorktreePath } = await createApprovedWorkflow();
    const launch = await prepareBuilderLaunch({ paths, specId: SPEC_ID });

    const completed = await completeBuilderPass({
      paths,
      specId: SPEC_ID,
      handoff: failedHandoff(launch.revision + 1),
    });

    expect(completed.state).toMatchObject({
      revision: launch.revision + 1,
      phase: WORKFLOW_PHASES.BUILDER_FAILED,
    });
    await commitAll({
      path: builderWorktreePath,
      message: 'Builder failed',
    });
    await expect(
      readWorkflowState({ path: builderWorkflowPath(builderWorktreePath) }),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.BUILDER_FAILED });
  });

  it('rejects a terminal handoff with the wrong revision without changing state', async () => {
    const { paths, builderWorktreePath } = await createApprovedWorkflow();
    const launch = await prepareBuilderLaunch({ paths, specId: SPEC_ID });

    await expect(
      completeBuilderPass({
        paths,
        specId: SPEC_ID,
        handoff: doneHandoff(launch.revision),
      }),
    ).rejects.toThrow('revision mismatch');
    await expect(
      readWorkflowState({ path: builderWorkflowPath(builderWorktreePath) }),
    ).resolves.toMatchObject({
      revision: launch.revision,
      phase: WORKFLOW_PHASES.BUILDER_RUNNING,
    });
  });
});
