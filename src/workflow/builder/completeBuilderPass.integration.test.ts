import { writeFile } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { BUILDER_HANDOFF_STATUSES } from '#artifacts/builder-handoff/schema.ts';
import { runGitCommand } from '#git/command.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
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
  it('rejects builder completion when the spec SHA baseline is missing', async () => {
    const { paths } = await createApprovedWorkflow();
    await prepareBuilderRun({ paths, specId: SPEC_ID });
    maestroSessionState.deactivate();

    await expect(
      completeBuilderPass({
        paths,
        specId: SPEC_ID,
        handoff: {
          status: BUILDER_HANDOFF_STATUSES.DONE,
          summary: 'Implemented the approved change.',
          acceptanceCriteria: [],
          notes: [],
        },
      }),
    ).rejects.toThrow('Builder spec SHA-256 baseline is not initialized.');
  });

  it('rejects builder completion when the spec changes after the run starts', async () => {
    const { paths } = await createApprovedWorkflow();
    await prepareBuilderRun({ paths, specId: SPEC_ID });
    await writeFile(
      paths.getSpecFilePath(SPEC_ID),
      '# Changed specification\n',
      'utf8',
    );

    await expect(
      completeBuilderPass({
        paths,
        specId: SPEC_ID,
        handoff: {
          status: BUILDER_HANDOFF_STATUSES.DONE,
          summary: 'Implemented the approved change.',
          acceptanceCriteria: [],
          notes: [],
        },
      }),
    ).rejects.toThrow('Builder changed spec.md after the run starts');
  });

  it('rejects a changed spec even when the change uses the checkpoint message', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    await prepareBuilderRun({ paths, specId: SPEC_ID });
    await writeFile(
      paths.getSpecFilePath(SPEC_ID),
      '# Changed specification\n',
      'utf8',
    );
    await repository.commit('maestro workflow checkpoint');

    await expect(
      completeBuilderPass({
        paths,
        specId: SPEC_ID,
        handoff: {
          status: BUILDER_HANDOFF_STATUSES.DONE,
          summary: 'Implemented the approved change.',
          acceptanceCriteria: [],
          notes: [],
        },
      }),
    ).rejects.toThrow('Builder changed spec.md after the run starts');
  });

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
