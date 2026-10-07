import { readFile, writeFile } from 'node:fs/promises';
import { Value } from 'typebox/value';
import { afterEach, describe, expect, it } from 'vitest';
import { BUILDER_HANDOFF_STATUSES } from '#artifacts/builder-handoff/schema.ts';
import {
  FINDING_DECISIONS,
  FINDING_SEVERITIES,
} from '#artifacts/verifier-handoff/schema.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import piTestSessions from '#test/support/pi-session.ts';
import { registerRecordVerifierHandoffTool } from '#tools/child/record-verifier-handoff.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { prepareVerifierRun } from '#workflow/verifier/prepareVerifierRun.ts';

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
  it('registers a closed input schema with explicit verifier identity', async () => {
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

  it('rejects a handoff outside the verifier-running phase', async () => {
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

  it('rejects a workflow spec identity mismatch', async () => {
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

  it('given restored temporary product changes when the verifier records its handoff then the tool records only protocol files', async () => {
    const workflow = await createApprovedWorkflow();
    await prepareBuilderRun({
      paths: workflow.paths,
      specId: SPEC_ID,
    });

    await completeBuilderPass({
      paths: workflow.paths,
      specId: SPEC_ID,
      handoff: {
        status: BUILDER_HANDOFF_STATUSES.DONE,
        summary: 'Implemented the approved change.',
        acceptanceCriteria: [],
        notes: [],
      },
    });

    await prepareVerifierRun({
      paths: workflow.paths,
      specId: SPEC_ID,
    });

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: workflow.repository.path,
      extension: registerRecordVerifierHandoffTool,
    });

    const productPath = `${workflow.repository.path}/README.md`;
    const originalProduct = await readFile(productPath, 'utf8');
    await writeFile(productPath, '# Temporary verification change\n', 'utf8');
    await writeFile(productPath, originalProduct, 'utf8');

    const result = await tool.execute('test-call', createHandoffInput());

    expect(result.details).toMatchObject({
      phase: WORKFLOW_PHASES.CANDIDATE_READY,
      specId: SPEC_ID,
    });
    await expect(
      readWorkflowState(workflow.paths.getWorkflowPath(SPEC_ID)),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.CANDIDATE_READY });
  });
});
