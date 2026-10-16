import { writeFile } from 'node:fs/promises';
import { Value } from 'typebox/value';
import { afterEach, describe, expect, it } from 'vitest';
import {
  FINDING_DECISIONS,
  FINDING_SEVERITIES,
} from '#artifacts/verifier-handoff/schema.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  SPEC_ID,
} from '#tests/support/builder-workflow.ts';
import piTestSessions from '#tests/support/pi-session.ts';
import { registerRecordVerifierHandoffTool } from '#tools/child/record-verifier-handoff.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';

const createHandoffInput = () => ({
  specId: SPEC_ID,
  summary: 'The candidate satisfies the approved specification.',
  acceptanceCriteria: [],
  findings: [],
  notes: [],
});

afterEach(async () => {
  await piTestSessions.cleanup();
  await cleanupBuilderWorkflows();
});

describe('verifier handoff tool', () => {
  it('given verifier report inputs when the tool schema is checked then a report is accepted but unknown fields and owner decisions are rejected', async () => {
    const { tool } = await piTestSessions.createRegisteredTool({
      extension: registerRecordVerifierHandoffTool,
    });

    const input = createHandoffInput();

    expect(Value.Check(tool.parameters, input)).toBe(true);
    expect(Value.Check(tool.parameters, { ...input, branch: 'main' })).toBe(
      false,
    );
    expect(
      Value.Check(tool.parameters, {
        ...input,
        findings: [
          {
            id: 'F1',
            acceptanceCriterion: null,
            severity: FINDING_SEVERITIES.HIGH,
            confidence: 1,
            summary: 'Finding',
            evidence: [{ source: 'test', observation: 'Observed' }],
            decision: {
              decision: FINDING_DECISIONS.REJECT,
              reason: 'Rejected',
            },
          },
        ],
      }),
    ).toBe(false);
  });

  it('given a workflow in ready-for-builder when a verifier report is submitted then submission fails because the verifier is not running', async () => {
    const workflow = await createApprovedWorkflow();

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: workflow.repository.path,
      extension: registerRecordVerifierHandoffTool,
    });

    await expect(
      tool.execute('test-call', createHandoffInput()),
    ).rejects.toThrow(
      'Verifier handoff requires verifier-running state, found "ready-for-builder".',
    );
  });

  it('given the saved workflow names a different spec when a verifier report is submitted then submission fails with a spec ID mismatch error', async () => {
    const workflow = await createApprovedWorkflow();
    const statePath = workflow.paths.getWorkflowPath(SPEC_ID);
    const state = await readWorkflowState(statePath);

    await writeFile(
      statePath,
      `${JSON.stringify(
        { ...state, specId: '20260321-143052-other-spec' },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: workflow.repository.path,
      extension: registerRecordVerifierHandoffTool,
    });

    await expect(
      tool.execute('test-call', createHandoffInput()),
    ).rejects.toThrow(
      `Workflow spec ID mismatch: expected "${SPEC_ID}", found "20260321-143052-other-spec".`,
    );
  });
});
