import { afterEach, describe, expect, it } from 'vitest';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import { openBuilderEscalation } from '#workflow/escalation/openBuilderEscalation.ts';
import { resolveBuilderEscalation } from '#workflow/escalation/resolveBuilderEscalation.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';

afterEach(cleanupBuilderWorkflows);

describe('builder escalation resolution', () => {
  it('saves the owner decision', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    await prepareBuilderRun({ paths, specId: SPEC_ID });

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

    const resolved = await resolveBuilderEscalation({
      paths,
      specId: SPEC_ID,
      escalationId: opened.escalation.id,
      resolution: {
        selectedOptionId: 'option-a',
        decision: 'Use option A.',
        reason: 'It matches the owner decision.',
      },
    });

    expect(resolved.projectRoot).toBe(repository.path);
    expect(resolved.state.phase).toBe(WORKFLOW_PHASES.READY_FOR_BUILDER);
  });
});
