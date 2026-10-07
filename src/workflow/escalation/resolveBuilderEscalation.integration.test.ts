import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { BUILDER_HANDOFF_STATUSES } from '#artifacts/builder-handoff/schema.ts';
import { VERIFIER_HANDOFF_VERSION } from '#artifacts/verifier-handoff/schema.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import { openBuilderEscalation } from '#workflow/escalation/openBuilderEscalation.ts';
import { resolveBuilderEscalation } from '#workflow/escalation/resolveBuilderEscalation.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { completeVerifierPass } from '#workflow/verifier/completeVerifierPass.ts';
import { prepareVerifierRun } from '#workflow/verifier/prepareVerifierRun.ts';

afterEach(cleanupBuilderWorkflows);

describe('builder escalation resolution', () => {
  it('saves the owner decision and keeps version 1.0.0 in every workflow artifact', async () => {
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
    await prepareBuilderRun({ paths, specId: SPEC_ID });

    const builder = await completeBuilderPass({
      paths,
      specId: SPEC_ID,
      handoff: {
        status: BUILDER_HANDOFF_STATUSES.DONE,
        summary: 'Implemented greeting',
        acceptanceCriteria: [],
        notes: [],
      },
    });

    await prepareVerifierRun({ paths, specId: SPEC_ID });

    const verifier = await completeVerifierPass({
      paths,
      specId: SPEC_ID,
      handoff: {
        version: VERIFIER_HANDOFF_VERSION,
        specId: SPEC_ID,
        summary: 'Checked greeting',
        acceptanceCriteria: [],
        findings: [],
        notes: [],
      },
    });

    for (const path of [
      paths.getWorkflowPath(SPEC_ID),
      opened.escalationPath,
      builder.handoffPath,
      verifier.handoffPath,
    ]) {
      expect(JSON.parse(await readFile(path, 'utf8')).version).toBe('1.0.0');
    }
  });
});
