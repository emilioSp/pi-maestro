/**
 * Objective: Check verifier delegation, saved results, and execution errors.
 * Used: In integration tests for the registered verifier run tool.
 */

import { access } from 'node:fs/promises';

import {
  SUBAGENT_DELEGATION_REQUEST_EVENT,
  SUBAGENT_DELEGATION_RESPONSE_EVENT,
  type SubagentDelegationRequest,
} from 'pi-subagents/delegation';
import { Value } from 'typebox/value';
import { afterEach, describe, expect, it } from 'vitest';

import { BUILDER_HANDOFF_STATUSES, PROBE_STATUSES } from '#artifacts/builder-handoff/schema.ts';
import {
  FINDING_SEVERITIES,
  VERIFIER_HANDOFF_VERSION,
} from '#artifacts/verifier-handoff/schema.ts';
import { DEFAULT_CONFIG } from '#config/defaults.ts';
import { AGENTS } from '#config/schema.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  SPEC_ID,
} from '#tests/support/builder-workflow.ts';
import piTestSessions from '#tests/support/pi-session.ts';
import { registerRunVerifierTool } from '#tools/main/run-verifier.ts';
import { DELEGATION_STATUSES } from '#tools/utils/pi-subagent-delegation.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { completeVerifierPass } from '#workflow/verifier/completeVerifierPass.ts';

const createReadyForVerifierWorkflow = async () => {
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
      escalations: [],
      summary: 'The approved change was implemented.',
      acceptanceCriteria: [
        {
          id: 'AC1',
          probe: 'Acceptance check',
          probeStatus: PROBE_STATUSES.PASSED,
        },
      ],
      notes: [],
    },
  });

  return workflow;
};

type RecordVerifierHandoffInput = {
  paths: MaestroPaths;
  findings?: readonly unknown[];
};

const recordVerifierHandoff = async ({
  paths,
  findings = [],
}: RecordVerifierHandoffInput): Promise<void> => {
  await completeVerifierPass({
    paths,
    specId: SPEC_ID,
    handoff: {
      version: VERIFIER_HANDOFF_VERSION,
      specId: SPEC_ID,
      summary: 'The candidate was independently verified.',
      acceptanceCriteria: [
        {
          id: 'AC1',
          probe: 'Acceptance check',
          probeStatus: PROBE_STATUSES.PASSED,
        },
      ],
      findings,
      notes: [],
    },
  });
};

afterEach(async () => {
  await piTestSessions.cleanup();
  await cleanupBuilderWorkflows();
});

describe('run verifier tool', () => {
  it('given verifier run inputs when the tool schema is checked then a spec ID is required and extra fields are rejected', async () => {
    const { tool } = await piTestSessions.createRegisteredTool({
      extension: registerRunVerifierTool,
    });

    expect(Value.Check(tool.parameters, { specId: SPEC_ID })).toBe(true);
    expect(Value.Check(tool.parameters, {})).toBe(false);
    expect(
      Value.Check(tool.parameters, {
        specId: SPEC_ID,
        branch: 'main',
        worktree: '/tmp/worktree',
        verifierPass: 1,
      }),
    ).toBe(false);
  });

  it('given a ready-for-verifier workflow when verification finishes without findings then the verifier uses the configured agent and project, saves its report, and requests simplification', async () => {
    const workflow = await createReadyForVerifierWorkflow();

    const { tool, events, emit, on } = await piTestSessions.createRegisteredTool({
      cwd: workflow.repository.path,
      extension: registerRunVerifierTool,
    });

    events.on(SUBAGENT_DELEGATION_REQUEST_EVENT, async (payload) => {
      // JUSTIFICATION: The run tool emits a delegation request on this channel.
      const request = payload as SubagentDelegationRequest;
      events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: 'other-request',
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: DELEGATION_STATUSES.COMPLETED,
        result: { kind: 'text', text: 'Ignore this response.' },
      });

      await recordVerifierHandoff({
        paths: workflow.paths,
      });
      events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: request.requestId,
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: DELEGATION_STATUSES.COMPLETED,
        result: { kind: 'text', text: 'The verifier finished.' },
      });
    });

    const result = await tool.execute('test-call', { specId: SPEC_ID });

    const receivedRequest = emit.mock.calls[0][1];
    expect(receivedRequest).toMatchObject({
      agent: AGENTS.VERIFIER,
      nodeId: 'verifier',
      context: 'fresh',
      cwd: workflow.repository.path,
      model: DEFAULT_CONFIG.verifier.model,
      thinking: DEFAULT_CONFIG.verifier.thinking,
      timeoutMs: DEFAULT_CONFIG.verifier.timeoutMinutes * 60_000,
      task: expect.stringContaining(SPEC_ID),
      result: { kind: 'text' },
    });
    expect(receivedRequest).toMatchObject({
      task: expect.stringContaining(workflow.repository.path),
    });
    expect(on).toHaveBeenLastCalledWith(SUBAGENT_DELEGATION_RESPONSE_EVENT, expect.any(Function));
    expect(on.mock.results.at(-1)?.value).toHaveBeenCalledOnce();
    expect(result.details).toMatchObject({
      outcome: WORKFLOW_PHASES.SIMPLIFIER_RUNNING,
      specId: SPEC_ID,
      phase: WORKFLOW_PHASES.SIMPLIFIER_RUNNING,
    });

    expect(result.content).toEqual([
      {
        type: 'text',
        text: expect.stringContaining(
          'Call maestro_run_simplifier next with this specId, without another approval or verifier pass.',
        ),
      },
    ]);

    await expect(access(workflow.paths.getVerifierHandoffsPath(SPEC_ID))).resolves.toBeUndefined();
    await expect(
      access(
        workflow.paths.getVerifierHandoffPath({
          specId: SPEC_ID,
          handoffPassNumber: 1,
        }),
      ),
    ).resolves.toBeUndefined();
  });

  it('given the verifier saves a report with findings when its run finishes then the tool returns those findings in finding-decisions and removes its response listener', async () => {
    const workflow = await createReadyForVerifierWorkflow();

    const { tool, events, on } = await piTestSessions.createRegisteredTool({
      cwd: workflow.repository.path,
      extension: registerRunVerifierTool,
    });

    events.on(SUBAGENT_DELEGATION_REQUEST_EVENT, async (payload) => {
      // JUSTIFICATION: The run tool emits a delegation request on this channel.
      const request = payload as SubagentDelegationRequest;
      await recordVerifierHandoff({
        paths: workflow.paths,
        findings: [
          {
            id: 'F1',
            acceptanceCriterion: null,
            severity: FINDING_SEVERITIES.MEDIUM,
            confidence: 1,
            summary: 'The verifier found a problem.',
            evidence: [{ source: 'test', observation: 'The problem was observed.' }],
            decision: null,
          },
        ],
      });
      events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: request.requestId,
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: DELEGATION_STATUSES.COMPLETED,
        result: { kind: 'text', text: 'The verifier finished.' },
      });
    });

    const result = await tool.execute('test-call', { specId: SPEC_ID });

    expect(result.details).toMatchObject({
      outcome: WORKFLOW_PHASES.FINDING_DECISIONS,
      phase: WORKFLOW_PHASES.FINDING_DECISIONS,
      handoff: { findings: [{ id: 'F1' }] },
    });
    expect(on).toHaveBeenLastCalledWith(SUBAGENT_DELEGATION_RESPONSE_EVENT, expect.any(Function));
    expect(on.mock.results.at(-1)?.value).toHaveBeenCalledOnce();
  });

  it('given a workflow in ready-for-builder when a verifier run is requested then it fails before sending a request or adding a response listener', async () => {
    const workflow = await createApprovedWorkflow();

    const { tool, emit, on } = await piTestSessions.createRegisteredTool({
      cwd: workflow.repository.path,
      extension: registerRunVerifierTool,
    });

    await expect(tool.execute('test-call', { specId: SPEC_ID })).rejects.toThrow(
      'Verifier run requires ready-for-verifier state, found "ready-for-builder".',
    );
    expect(emit).not.toHaveBeenCalled();
    expect(on).not.toHaveBeenCalled();
  });

  it('given the verifier provider is unavailable when the failed run response arrives then the tool reports the provider error, removes its listener, and leaves verifier-running unchanged', async () => {
    const workflow = await createReadyForVerifierWorkflow();

    const { tool, events, on } = await piTestSessions.createRegisteredTool({
      cwd: workflow.repository.path,
      extension: registerRunVerifierTool,
    });

    events.on(SUBAGENT_DELEGATION_REQUEST_EVENT, (payload) => {
      // JUSTIFICATION: The run tool emits a delegation request on this channel.
      const request = payload as SubagentDelegationRequest;
      events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: request.requestId,
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: DELEGATION_STATUSES.FAILED,
        error: 'The configured provider is unavailable.',
      });
    });

    await expect(tool.execute('test-call', { specId: SPEC_ID })).rejects.toThrow(
      'Delegation error: The configured provider is unavailable.',
    );
    await expect(readWorkflowState(workflow.paths.getWorkflowPath(SPEC_ID))).resolves.toMatchObject(
      { phase: WORKFLOW_PHASES.VERIFIER_RUNNING },
    );
    expect(on).toHaveBeenLastCalledWith(SUBAGENT_DELEGATION_RESPONSE_EVENT, expect.any(Function));
    expect(on.mock.results.at(-1)?.value).toHaveBeenCalledOnce();
  });

  it.each([
    {
      failure: 'a timeout',
      status: DELEGATION_STATUSES.TIMED_OUT,
      error: 'The verifier exceeded its timeout.',
      expectedMessage: 'Delegation timeout: The verifier exceeded its timeout.',
    },
    {
      failure: 'an interruption',
      status: DELEGATION_STATUSES.INTERRUPTED,
      error: 'The verifier was interrupted.',
      expectedMessage: 'Delegation interruption: The verifier was interrupted.',
    },
  ])(
    'given the verifier reports $failure when the final response arrives then the run fails with the matching error message',
    async ({ status, error, expectedMessage }) => {
      const workflow = await createReadyForVerifierWorkflow();

      const { tool, events } = await piTestSessions.createRegisteredTool({
        cwd: workflow.repository.path,
        extension: registerRunVerifierTool,
      });

      events.on(SUBAGENT_DELEGATION_REQUEST_EVENT, (payload) => {
        // JUSTIFICATION: The run tool emits a delegation request on this channel.
        const request = payload as SubagentDelegationRequest;
        events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
          requestId: request.requestId,
          ownerRunId: request.ownerRunId,
          nodeId: request.nodeId,
          status,
          error,
        });
      });

      await expect(tool.execute('test-call', { specId: SPEC_ID })).rejects.toThrow(expectedMessage);
    },
  );

  it('given the verifier reports completion without saving its report when the run tool receives the response then a protocol error is raised and the response listener is removed', async () => {
    const workflow = await createReadyForVerifierWorkflow();

    const { tool, events, on } = await piTestSessions.createRegisteredTool({
      cwd: workflow.repository.path,
      extension: registerRunVerifierTool,
    });

    events.on(SUBAGENT_DELEGATION_REQUEST_EVENT, (payload) => {
      // JUSTIFICATION: The run tool emits a delegation request on this channel.
      const request = payload as SubagentDelegationRequest;
      events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: request.requestId,
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: DELEGATION_STATUSES.COMPLETED,
        result: { kind: 'text', text: 'The verifier finished.' },
      });
    });

    await expect(tool.execute('test-call', { specId: SPEC_ID })).rejects.toThrow(
      'Verifier protocol error: The verifier returned without recording a valid terminal handoff.',
    );
    expect(on).toHaveBeenLastCalledWith(SUBAGENT_DELEGATION_RESPONSE_EVENT, expect.any(Function));
    expect(on.mock.results.at(-1)?.value).toHaveBeenCalledOnce();
    await expect(
      access(
        workflow.paths.getVerifierHandoffPath({
          specId: SPEC_ID,
          handoffPassNumber: 1,
        }),
      ),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
