import { writeFile } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { readEscalation } from '#artifacts/escalation/readEscalation.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import {
  builderHandoffPath,
  builderWorkflowPath,
  cleanupBuilderWorkflows,
  commitAll,
  createApprovedWorkflow,
  doneHandoff,
  getBuilderWorktreePaths,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { pathExists } from '#utils/path-exists.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderLaunch } from '#workflow/builder/prepareBuilderLauncher.ts';
import { openBuilderEscalation } from '#workflow/escalation/openBuilderEscalation.ts';
import { resolveBuilderEscalation } from '#workflow/escalation/resolveBuilderEscalation.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';

const escalationInput = (
  question = 'Which option should the builder use?',
) => ({
  question,
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
});

afterEach(cleanupBuilderWorkflows);

describe('opening builder escalations', () => {
  it('opens and persists an escalation from builder-running', async () => {
    const { paths, builderWorktreePath } = await createApprovedWorkflow();
    await prepareBuilderLaunch({ paths, specId: SPEC_ID });
    const builderPaths = await getBuilderWorktreePaths({
      worktreePath: builderWorktreePath,
    });

    const opened = await openBuilderEscalation({
      paths: builderPaths,
      specId: SPEC_ID,
      escalation: escalationInput(),
    });
    expect(opened.escalation).toMatchObject({
      id: 'E1',
      specId: SPEC_ID,
      revision: 4,
      resolution: null,
    });
    expect(opened.state).toMatchObject({
      revision: 4,
      phase: WORKFLOW_PHASES.ESCALATION_DECISION,
    });
    await expect(
      readEscalation({
        path: opened.escalationPath,
        specId: SPEC_ID,
        currentRevision: opened.state.revision,
      }),
    ).resolves.toMatchObject({ id: 'E1', resolution: null });

    await commitAll({
      path: builderWorktreePath,
      message: 'Builder opened escalation',
    });
    await expect(
      getHeadCommit({ repositoryRoot: builderWorktreePath }),
    ).resolves.toBeDefined();
  });

  it('rejects an escalation when spec.md changed after launch', async () => {
    const { paths, builderWorktreePath } = await createApprovedWorkflow();
    await prepareBuilderLaunch({ paths, specId: SPEC_ID });
    const builderPaths = await getBuilderWorktreePaths({
      worktreePath: builderWorktreePath,
    });
    await writeFile(
      builderPaths.getSpecFilePath(SPEC_ID),
      '# Changed by the builder\n',
    );

    await expect(
      openBuilderEscalation({
        paths: builderPaths,
        specId: SPEC_ID,
        escalation: escalationInput(),
      }),
    ).rejects.toThrow('Builder changed spec.md after launch');
  });

  it('rejects an escalation after the builder pass is no longer running', async () => {
    const { paths, builderWorktreePath } = await createApprovedWorkflow();
    const launch = await prepareBuilderLaunch({ paths, specId: SPEC_ID });
    const builderPaths = await getBuilderWorktreePaths({
      worktreePath: builderWorktreePath,
    });
    await completeBuilderPass({
      paths: builderPaths,
      specId: SPEC_ID,
      handoff: doneHandoff(launch.revision + 1),
    });
    await expect(
      openBuilderEscalation({
        paths: builderPaths,
        specId: SPEC_ID,
        escalation: escalationInput(),
      }),
    ).rejects.toThrow(
      'Builder escalation requires builder-running state, found "ready-for-verifier".',
    );
  });

  it('allocates the next escalation after a later builder pass', async () => {
    const { paths, builderWorktreePath } = await createApprovedWorkflow();
    await prepareBuilderLaunch({ paths, specId: SPEC_ID });
    const builderPaths = await getBuilderWorktreePaths({
      worktreePath: builderWorktreePath,
    });
    const first = await openBuilderEscalation({
      paths: builderPaths,
      specId: SPEC_ID,
      escalation: escalationInput(),
    });
    await commitAll({
      path: builderWorktreePath,
      message: 'Builder opened first escalation',
    });
    await resolveBuilderEscalation({
      paths,
      specId: SPEC_ID,
      escalationId: first.escalation.id,
      resolution: {
        selectedOptionId: 'A',
        decision: 'Use the existing adapter.',
        reason: 'The approved contract remains valid.',
      },
    });
    await prepareBuilderLaunch({ paths, specId: SPEC_ID });

    const secondBuilderPaths = await getBuilderWorktreePaths({
      worktreePath: builderWorktreePath,
    });
    const second = await openBuilderEscalation({
      paths: secondBuilderPaths,
      specId: SPEC_ID,
      escalation: escalationInput('Which option should the later pass use?'),
    });
    expect(second.escalation).toMatchObject({
      id: 'E2',
      revision: 7,
      resolution: null,
    });
    await expect(
      pathExists(
        builderHandoffPath({ paths, worktreePath: builderWorktreePath }),
      ),
    ).resolves.toBe(false);
    await expect(
      readWorkflowState({
        path: builderWorkflowPath({ paths, worktreePath: builderWorktreePath }),
      }),
    ).resolves.toMatchObject({
      revision: 7,
      phase: WORKFLOW_PHASES.ESCALATION_DECISION,
    });
  });
});
