import {
  SUBAGENT_DELEGATION_REQUEST_EVENT,
  SUBAGENT_DELEGATION_RESPONSE_EVENT,
  type SubagentDelegationRequest,
} from 'pi-subagents/delegation';
import { Value } from 'typebox/value';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BREAKAGE_STATUSES,
  BUILDER_HANDOFF_STATUSES,
  PROBE_STATUSES,
} from '#artifacts/builder-handoff/schema.ts';
import { DEFAULT_CONFIG } from '#config/defaults.ts';
import { AGENTS } from '#config/schema.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import piTestSessions from '#test/support/pi-session.ts';
import { registerLaunchBuilderTool } from '#tools/main/launch-builder.ts';
import { DELEGATION_STATUSES } from '#tools/utils/pi-subagent-delegation.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { openBuilderEscalation } from '#workflow/escalation/openBuilderEscalation.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';

afterEach(async () => {
  await piTestSessions.cleanup();
  await cleanupBuilderWorkflows();
});

describe('launch builder tool', () => {
  it('registers a closed spec-only input schema', async () => {
    const { tool } = await piTestSessions.createRegisteredTool({
      extension: registerLaunchBuilderTool,
    });

    expect(Value.Check(tool.parameters, { specId: SPEC_ID })).toBe(true);
    expect(Value.Check(tool.parameters, {})).toBe(false);
    expect(
      Value.Check(tool.parameters, {
        specId: SPEC_ID,
        branch: 'main',
      }),
    ).toBe(false);
  });

  it('launches the builder in the current checkout and returns a committed done result', async () => {
    const { paths, repository } = await createApprovedWorkflow();

    const { tool, events, emit, on } =
      await piTestSessions.createRegisteredTool({
        cwd: repository.path,
        extension: registerLaunchBuilderTool,
      });

    events.on(SUBAGENT_DELEGATION_REQUEST_EVENT, async (payload) => {
      // JUSTIFICATION: The launch tool emits a delegation request on this channel.
      const request = payload as SubagentDelegationRequest;
      events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: 'other-request',
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: 'completed',
        result: { kind: 'text', text: 'Ignore this response.' },
      });

      await completeBuilderPass({
        paths,
        specId: SPEC_ID,
        handoff: {
          status: BUILDER_HANDOFF_STATUSES.DONE,
          summary: 'The approved change was implemented.',
          acceptanceCriteria: [
            {
              id: 'AC1',
              probe: 'npm test',
              probeStatus: PROBE_STATUSES.PASSED,
              breakageStatus: BREAKAGE_STATUSES.CONFIRMED,
            },
          ],
          notes: [],
        },
      });
      await repository.commit({ message: 'Builder done' });
      events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: request.requestId,
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: DELEGATION_STATUSES.COMPLETED,
        result: { kind: 'text', text: 'The builder finished.' },
      });
    });

    const result = await tool.execute('test-call', { specId: SPEC_ID });

    const receivedRequest = emit.mock.calls[0][1];
    expect(receivedRequest).toMatchObject({
      agent: AGENTS.BUILDER,
      context: 'fresh',
      cwd: repository.path,
      model: DEFAULT_CONFIG.builder.model,
      thinking: DEFAULT_CONFIG.builder.thinking,
      timeoutMs: DEFAULT_CONFIG.builder.timeoutMinutes * 60_000,
      task: expect.stringContaining(SPEC_ID),
      result: { kind: 'text' },
    });
    expect(receivedRequest).toMatchObject({
      task: expect.stringContaining(repository.path),
    });
    expect(receivedRequest).toMatchObject({
      task: expect.stringContaining('AGENTS.md'),
    });
    expect(on).toHaveBeenLastCalledWith(
      SUBAGENT_DELEGATION_RESPONSE_EVENT,
      expect.any(Function),
    );
    expect(on.mock.results.at(-1)?.value).toHaveBeenCalledOnce();
    expect(result.details).toMatchObject({
      outcome: 'done',
      specId: SPEC_ID,
      phase: WORKFLOW_PHASES.READY_FOR_VERIFIER,
    });
  });

  it('returns a committed failed handoff and does not relaunch it', async () => {
    const { paths, repository } = await createApprovedWorkflow();

    const { tool, events, emit } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerLaunchBuilderTool,
    });

    events.on(SUBAGENT_DELEGATION_REQUEST_EVENT, async (payload) => {
      // JUSTIFICATION: The launch tool emits a delegation request on this channel.
      const request = payload as SubagentDelegationRequest;
      await completeBuilderPass({
        paths,
        specId: SPEC_ID,
        handoff: {
          status: BUILDER_HANDOFF_STATUSES.FAILED,
          summary: 'The builder was blocked.',
          acceptanceCriteria: [
            {
              id: 'AC1',
              probe: 'npm test',
              probeStatus: PROBE_STATUSES.NOT_RUN,
              breakageStatus: BREAKAGE_STATUSES.NOT_RUN,
            },
          ],
          failure: { reason: 'The implementation was blocked.' },
          notes: [],
        },
      });
      await repository.commit({ message: 'Builder failed' });
      events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: request.requestId,
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: DELEGATION_STATUSES.COMPLETED,
        result: { kind: 'text', text: 'The builder finished.' },
      });
    });

    const result = await tool.execute('test-call', { specId: SPEC_ID });

    expect(result.details).toMatchObject({
      outcome: 'failed',
      phase: WORKFLOW_PHASES.BUILDER_FAILED,
    });

    await expect(
      tool.execute('test-call', { specId: SPEC_ID }),
    ).rejects.toThrow(
      'Builder launch is not valid from phase "builder-failed".',
    );
    expect(
      emit.mock.calls.filter(
        ([channel]) => channel === SUBAGENT_DELEGATION_REQUEST_EVENT,
      ),
    ).toHaveLength(1);
  });

  it('returns a committed escalation result', async () => {
    const { paths, repository } = await createApprovedWorkflow();

    const { tool, events } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerLaunchBuilderTool,
    });

    events.on(SUBAGENT_DELEGATION_REQUEST_EVENT, async (payload) => {
      // JUSTIFICATION: The launch tool emits a delegation request on this channel.
      const request = payload as SubagentDelegationRequest;

      const opened = await openBuilderEscalation({
        paths,
        specId: SPEC_ID,
        escalation: {
          question: 'Which behavior should the builder use?',
          context: 'The repository exposes two existing behaviors.',
          options: [
            {
              id: 'existing',
              description: 'Keep the existing behavior.',
              consequences: 'No compatibility change is needed.',
              nextStep: 'Continue with the existing behavior.',
            },
          ],
          recommendation: null,
          notes: [],
        },
      });

      expect(opened.state.phase).toBe(WORKFLOW_PHASES.ESCALATION_DECISION);
      await repository.commit({
        message: 'Builder escalation',
      });
      events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: request.requestId,
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: DELEGATION_STATUSES.COMPLETED,
        result: { kind: 'text', text: 'The builder finished.' },
      });
    });

    const result = await tool.execute('test-call', { specId: SPEC_ID });

    expect(result.details).toMatchObject({
      outcome: 'escalation',
      phase: WORKFLOW_PHASES.ESCALATION_DECISION,
      escalation: { id: 'E1' },
    });
  });

  it('returns the workflow error before delegation when the checkout is dirty', async () => {
    const { repository } = await createApprovedWorkflow({
      commitApproval: false,
    });

    const { tool, emit, on } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerLaunchBuilderTool,
    });

    await expect(
      tool.execute('test-call', { specId: SPEC_ID }),
    ).rejects.toThrow('clean current checkout');
    expect(emit).not.toHaveBeenCalled();
    expect(on).not.toHaveBeenCalled();
  });

  it('returns a delegation error without advancing the workflow', async () => {
    const { paths, repository } = await createApprovedWorkflow();

    const { tool, events, on } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerLaunchBuilderTool,
    });

    events.on(SUBAGENT_DELEGATION_REQUEST_EVENT, (payload) => {
      // JUSTIFICATION: The launch tool emits a delegation request on this channel.
      const request = payload as SubagentDelegationRequest;
      events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: request.requestId,
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: 'failed',
        error: 'The configured provider is unavailable.',
      });
    });

    await expect(
      tool.execute('test-call', { specId: SPEC_ID }),
    ).rejects.toThrow(
      'Delegation error: The configured provider is unavailable.',
    );
    await expect(
      readWorkflowState({ path: paths.getWorkflowPath(SPEC_ID) }),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.BUILDER_RUNNING });
    expect(on).toHaveBeenLastCalledWith(
      SUBAGENT_DELEGATION_RESPONSE_EVENT,
      expect.any(Function),
    );
    expect(on.mock.results.at(-1)?.value).toHaveBeenCalledOnce();
  });

  it('given request emission fails when launching then reports the error and removes the response listener', async () => {
    const { repository } = await createApprovedWorkflow();

    const { tool, emit, on } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerLaunchBuilderTool,
    });

    emit.mockImplementationOnce(() => {
      throw new Error('Request emission failed.');
    });

    await expect(
      tool.execute('test-call', { specId: SPEC_ID }),
    ).rejects.toThrow('Delegation request error: Request emission failed.');
    expect(on).toHaveBeenLastCalledWith(
      SUBAGENT_DELEGATION_RESPONSE_EVENT,
      expect.any(Function),
    );
    expect(on.mock.results.at(-1)?.value).toHaveBeenCalledOnce();
  });

  it('returns a timeout without advancing the workflow', async () => {
    const { paths, repository } = await createApprovedWorkflow();

    const { tool, events } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerLaunchBuilderTool,
    });

    events.on(SUBAGENT_DELEGATION_REQUEST_EVENT, (payload) => {
      // JUSTIFICATION: The launch tool emits a delegation request on this channel.
      const request = payload as SubagentDelegationRequest;
      events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: request.requestId,
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: 'timed_out',
        error: 'The builder exceeded its timeout.',
      });
    });

    await expect(
      tool.execute('test-call', { specId: SPEC_ID }),
    ).rejects.toThrow('Delegation timeout: The builder exceeded its timeout.');
    await expect(
      readWorkflowState({ path: paths.getWorkflowPath(SPEC_ID) }),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.BUILDER_RUNNING });
  });

  it('returns an interruption without advancing the workflow', async () => {
    const { paths, repository } = await createApprovedWorkflow();

    const { tool, events } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerLaunchBuilderTool,
    });

    events.on(SUBAGENT_DELEGATION_REQUEST_EVENT, (payload) => {
      // JUSTIFICATION: The launch tool emits a delegation request on this channel.
      const request = payload as SubagentDelegationRequest;
      events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: request.requestId,
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: 'interrupted',
        error: 'The builder was interrupted.',
      });
    });

    await expect(
      tool.execute('test-call', { specId: SPEC_ID }),
    ).rejects.toThrow('Delegation interruption: The builder was interrupted.');
    await expect(
      readWorkflowState({ path: paths.getWorkflowPath(SPEC_ID) }),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.BUILDER_RUNNING });
  });

  it('returns a protocol error without advancing the workflow', async () => {
    const { paths, repository } = await createApprovedWorkflow();

    const { tool, events } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerLaunchBuilderTool,
    });

    events.on(SUBAGENT_DELEGATION_REQUEST_EVENT, (payload) => {
      // JUSTIFICATION: The launch tool emits a delegation request on this channel.
      const request = payload as SubagentDelegationRequest;
      events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: request.requestId,
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: 'unsupported',
      });
    });

    await expect(
      tool.execute('test-call', { specId: SPEC_ID }),
    ).rejects.toThrow(
      'Protocol error: unsupported final response status "unsupported".',
    );
    await expect(
      readWorkflowState({ path: paths.getWorkflowPath(SPEC_ID) }),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.BUILDER_RUNNING });
  });
});
