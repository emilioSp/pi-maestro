import { afterEach, describe, expect, it } from 'vitest';
import {
  cleanupBuilderWorkflows,
  commitAll,
  createApprovedWorkflow,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { prepareBuilderLaunch } from '#workflow/builder/prepareBuilderLauncher.ts';
import { openBuilderEscalation } from '#workflow/escalation/openBuilderEscalation.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';

afterEach(cleanupBuilderWorkflows);

describe('builder escalation', () => {
  it('records an escalation in the current checkout', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    await prepareBuilderLaunch({ paths, specId: SPEC_ID });

    const opened = await openBuilderEscalation({
      paths,
      specId: SPEC_ID,
      escalation: {
        question: 'Which behavior should the builder use?',
        context: 'The approved contract allows two valid behaviors.',
        options: [
          {
            id: 'option-a',
            description: 'Use option A.',
            consequences: 'Keeps the implementation small.',
            nextStep: 'Implement option A.',
          },
        ],
        recommendation: null,
        notes: [],
      },
    });

    expect(opened.repositoryRoot).toBe(repository.path);
    expect(opened.state.phase).toBe(WORKFLOW_PHASES.ESCALATION_DECISION);
    await expect(
      readWorkflowState({ path: paths.getWorkflowPath(SPEC_ID) }),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.ESCALATION_DECISION });
    await commitAll({ path: repository.path, message: 'Builder escalation' });
  });
});
