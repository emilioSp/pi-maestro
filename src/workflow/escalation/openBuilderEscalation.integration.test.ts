import { afterEach, describe, expect, it } from 'vitest';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import { openBuilderEscalation } from '#workflow/escalation/openBuilderEscalation.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';

afterEach(cleanupBuilderWorkflows);

describe('builder escalation', () => {
  it('given no parent session state when the builder escalates then the workflow records an owner decision request', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    await prepareBuilderRun({ paths, specId: SPEC_ID });
    maestroSessionState.deactivate();

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

    expect(opened.projectRoot).toBe(repository.path);
    expect(opened.state.phase).toBe(WORKFLOW_PHASES.ESCALATION_DECISION);
    await expect(
      readWorkflowState(paths.getWorkflowPath(SPEC_ID)),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.ESCALATION_DECISION });
  });
});
