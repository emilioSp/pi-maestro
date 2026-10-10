import { access } from 'node:fs/promises';
import { join } from 'node:path';
import {
  SUBAGENT_DELEGATION_REQUEST_EVENT,
  SUBAGENT_DELEGATION_RESPONSE_EVENT,
  type SubagentDelegationRequest,
} from 'pi-subagents/delegation';
import { Value } from 'typebox/value';
import { afterEach, describe, expect, it } from 'vitest';
import { BUILDER_HANDOFF_STATUSES } from '#artifacts/builder-handoff/schema.ts';
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
} from '#test/support/builder-workflow.ts';
import piTestSessions from '#test/support/pi-session.ts';
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
      acceptanceCriteria: [],
      notes: [],
    },
  });

  return workflow;
};

type VerifierHandoffInput = {
  findings?: readonly unknown[];
};

const createVerifierHandoff = ({ findings = [] }: VerifierHandoffInput) => ({
  version: VERIFIER_HANDOFF_VERSION,
  specId: SPEC_ID,
  summary: 'The candidate was independently verified.',
  acceptanceCriteria: [],
  findings,
  notes: [],
});

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
    handoff: createVerifierHandoff({
      findings,
    }),
  });
};

const fileExists = async (path: string) => {
  try {
    await access(path);

    return true;
  } catch {
    return false;
  }
};

afterEach(async () => {
  await piTestSessions.cleanup();
  await cleanupBuilderWorkflows();
});

describe('run verifier tool', () => {
  it('given the verifier run tool when registered then its closed schema accepts only a spec ID', async () => {
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

  it('given a ready-for-verifier workflow when the verifier runs then it uses the current project and explicit spec identity', async () => {
    const workflow = await createReadyForVerifierWorkflow();

    const { tool, events, emit, on } =
      await piTestSessions.createRegisteredTool({
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
    expect(on).toHaveBeenLastCalledWith(
      SUBAGENT_DELEGATION_RESPONSE_EVENT,
      expect.any(Function),
    );
    expect(on.mock.results.at(-1)?.value).toHaveBeenCalledOnce();
    expect(result.details).toMatchObject({
      outcome: WORKFLOW_PHASES.CANDIDATE_READY,
      specId: SPEC_ID,
      phase: WORKFLOW_PHASES.CANDIDATE_READY,
    });

    await expect(
      fileExists(
        join(workflow.repository.path, `.specs/${SPEC_ID}/handoffs/verifier`),
      ),
    ).resolves.toBe(true);

    await expect(
      fileExists(
        join(
          workflow.repository.path,
          `.specs/${SPEC_ID}/handoffs/verifier/V1.json`,
        ),
      ),
    ).resolves.toBe(true);
  });

  it('given a verifier handoff with findings when delegation completes then findings are returned and the response listener is cleaned', async () => {
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
            evidence: [
              { source: 'test', observation: 'The problem was observed.' },
            ],
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
      outcome: WORKFLOW_PHASES.FINDINGS_DECISION,
      phase: WORKFLOW_PHASES.FINDINGS_DECISION,
      handoff: { findings: [{ id: 'F1' }] },
    });
    expect(on).toHaveBeenLastCalledWith(
      SUBAGENT_DELEGATION_RESPONSE_EVENT,
      expect.any(Function),
    );
    expect(on.mock.results.at(-1)?.value).toHaveBeenCalledOnce();
  });

  it('given a workflow outside ready-for-verifier when the verifier run is requested then a workflow error is returned before delegation', async () => {
    const workflow = await createApprovedWorkflow();

    const { tool, emit, on } = await piTestSessions.createRegisteredTool({
      cwd: workflow.repository.path,
      extension: registerRunVerifierTool,
    });

    await expect(
      tool.execute('test-call', { specId: SPEC_ID }),
    ).rejects.toThrow(
      'Verifier run requires ready-for-verifier state, found "ready-for-builder".',
    );
    expect(emit).not.toHaveBeenCalled();
    expect(on).not.toHaveBeenCalled();
  });

  it('given a verifier delegation failure when the response is received then an error is returned without advancing the workflow', async () => {
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

    await expect(
      tool.execute('test-call', { specId: SPEC_ID }),
    ).rejects.toThrow(
      'Delegation error: The configured provider is unavailable.',
    );
    await expect(
      readWorkflowState(workflow.paths.getWorkflowPath(SPEC_ID)),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.VERIFIER_RUNNING });
    expect(on).toHaveBeenLastCalledWith(
      SUBAGENT_DELEGATION_RESPONSE_EVENT,
      expect.any(Function),
    );
    expect(on.mock.results.at(-1)?.value).toHaveBeenCalledOnce();
  });

  it('given verifier delegation timeouts and interruptions when responses are received then distinct errors are returned', async () => {
    const timeoutWorkflow = await createReadyForVerifierWorkflow();

    const timeoutTool = await piTestSessions.createRegisteredTool({
      cwd: timeoutWorkflow.repository.path,
      extension: registerRunVerifierTool,
    });

    timeoutTool.events.on(SUBAGENT_DELEGATION_REQUEST_EVENT, (payload) => {
      // JUSTIFICATION: The run tool emits a delegation request on this channel.
      const request = payload as SubagentDelegationRequest;
      timeoutTool.events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: request.requestId,
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: DELEGATION_STATUSES.TIMED_OUT,
        error: 'The verifier exceeded its timeout.',
      });
    });

    await expect(
      timeoutTool.tool.execute('test-call', { specId: SPEC_ID }),
    ).rejects.toThrow('Delegation timeout: The verifier exceeded its timeout.');

    const interruptionWorkflow = await createReadyForVerifierWorkflow();

    const interruptionTool = await piTestSessions.createRegisteredTool({
      cwd: interruptionWorkflow.repository.path,
      extension: registerRunVerifierTool,
    });

    interruptionTool.events.on(SUBAGENT_DELEGATION_REQUEST_EVENT, (payload) => {
      // JUSTIFICATION: The run tool emits a delegation request on this channel.
      const request = payload as SubagentDelegationRequest;
      interruptionTool.events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: request.requestId,
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: DELEGATION_STATUSES.INTERRUPTED,
        error: 'The verifier was interrupted.',
      });
    });

    await expect(
      interruptionTool.tool.execute('test-call', { specId: SPEC_ID }),
    ).rejects.toThrow('Delegation interruption: The verifier was interrupted.');
  });

  it('given a completed verifier response without a handoff when processed then a protocol error is returned', async () => {
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

    await expect(
      tool.execute('test-call', { specId: SPEC_ID }),
    ).rejects.toThrow(
      'Verifier protocol error: The verifier returned without recording a valid terminal handoff.',
    );
    expect(on).toHaveBeenLastCalledWith(
      SUBAGENT_DELEGATION_RESPONSE_EVENT,
      expect.any(Function),
    );
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
