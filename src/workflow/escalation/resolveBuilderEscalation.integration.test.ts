import { afterEach, describe, expect, it } from 'vitest';
import { readEscalation } from '#artifacts/escalation/readEscalation.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import {
  builderWorkflowPath,
  cleanupBuilderWorkflows,
  commitAll,
  createApprovedWorkflow,
  getBuilderWorktreePaths,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { prepareBuilderLaunch } from '#workflow/builder/prepareBuilderLauncher.ts';
import { openBuilderEscalation } from '#workflow/escalation/openBuilderEscalation.ts';
import { resolveBuilderEscalation } from '#workflow/escalation/resolveBuilderEscalation.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';

const escalationInput = {
  question: 'Which option should the builder use?',
  context: 'The approved contract allows two implementation approaches.',
  options: [
    {
      id: 'A',
      description: 'Use the existing adapter.',
      consequences: 'The current lifecycle remains unchanged.',
      nextStep: 'Extend the existing adapter.',
    },
    {
      id: 'B',
      description: 'Add a new adapter.',
      consequences: 'The implementation gains a separate lifecycle.',
      nextStep: 'Create the new adapter.',
    },
  ],
  recommendation: {
    optionId: 'A',
    reason: 'It follows the current architecture.',
  },
  notes: [],
};

const openEscalation = async () => {
  const workflow = await createApprovedWorkflow();
  await prepareBuilderLaunch({ paths: workflow.paths, specId: SPEC_ID });
  const opened = await openBuilderEscalation({
    paths: await getBuilderWorktreePaths({
      worktreePath: workflow.builderWorktreePath,
    }),
    specId: SPEC_ID,
    escalation: escalationInput,
  });
  await commitAll({
    path: workflow.builderWorktreePath,
    message: 'Builder opened escalation',
  });
  return { ...workflow, opened };
};

afterEach(cleanupBuilderWorkflows);

describe('resolving builder escalations', () => {
  it('resolves the current escalation, checkpoints ready-for-builder, and does not launch a builder', async () => {
    const { paths, builderWorktreePath, opened } = await openEscalation();

    const resolved = await resolveBuilderEscalation({
      paths,
      specId: SPEC_ID,
      escalationId: opened.escalation.id,
      resolution: {
        selectedOptionId: 'A',
        decision: 'Use the existing adapter.',
        reason: 'The approved contract remains valid.',
      },
    });

    expect(resolved.escalation).toMatchObject({
      id: 'E1',
      revision: 5,
      resolution: {
        selectedOptionId: 'A',
        decision: 'Use the existing adapter.',
        reason: 'The approved contract remains valid.',
      },
    });
    expect(resolved.state).toMatchObject({
      revision: 5,
      phase: WORKFLOW_PHASES.READY_FOR_BUILDER,
    });
    await expect(
      getHeadCommit({ repositoryRoot: builderWorktreePath }),
    ).resolves.toBe(resolved.checkpointCommit);
    await expect(
      readWorkflowState({
        path: builderWorkflowPath({ paths, worktreePath: builderWorktreePath }),
      }),
    ).resolves.toMatchObject({
      revision: 5,
      phase: WORKFLOW_PHASES.READY_FOR_BUILDER,
    });
    await expect(
      readEscalation({
        path: opened.escalationPath,
        specId: SPEC_ID,
        currentRevision: resolved.state.revision,
      }),
    ).resolves.toMatchObject({
      revision: 5,
      resolution: { selectedOptionId: 'A' },
    });
  });

  it('rejects an invalid option without resolving the escalation', async () => {
    const { paths, builderWorktreePath, opened } = await openEscalation();

    await expect(
      resolveBuilderEscalation({
        paths,
        specId: SPEC_ID,
        escalationId: opened.escalation.id,
        resolution: {
          selectedOptionId: 'unknown',
          decision: 'Use the unknown option.',
          reason: 'This option does not exist.',
        },
      }),
    ).rejects.toThrow('unknown option');
    await expect(
      readWorkflowState({
        path: builderWorkflowPath({ paths, worktreePath: builderWorktreePath }),
      }),
    ).resolves.toMatchObject({
      revision: 4,
      phase: WORKFLOW_PHASES.ESCALATION_DECISION,
    });
    await expect(
      readEscalation({
        path: opened.escalationPath,
        specId: SPEC_ID,
        currentRevision: opened.state.revision,
      }),
    ).resolves.toMatchObject({ revision: 4, resolution: null });
  });

  it('rejects a duplicate resolution', async () => {
    const { paths, opened } = await openEscalation();
    const resolution = {
      selectedOptionId: 'A',
      decision: 'Use the existing adapter.',
      reason: 'The approved contract remains valid.',
    };

    await resolveBuilderEscalation({
      paths,
      specId: SPEC_ID,
      escalationId: opened.escalation.id,
      resolution,
    });

    await expect(
      resolveBuilderEscalation({
        paths,
        specId: SPEC_ID,
        escalationId: opened.escalation.id,
        resolution,
      }),
    ).rejects.toThrow('escalation-decision state');
  });
});
