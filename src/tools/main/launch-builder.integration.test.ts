import type {
  EventBus,
  ExtensionAPI,
  ExtensionContext,
  ToolDefinition,
} from '@earendil-works/pi-coding-agent';
import {
  SUBAGENT_DELEGATION_REQUEST_EVENT,
  SUBAGENT_DELEGATION_RESPONSE_EVENT,
  type SubagentDelegationRequest,
} from 'pi-subagents/delegation';
import type { TSchema } from 'typebox';
import { Value } from 'typebox/value';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BREAKAGE_STATUSES,
  BUILDER_HANDOFF_STATUSES,
  PROBE_STATUSES,
} from '#artifacts/builder-handoff/schema.ts';
import { AGENTS } from '#config/schema.ts';
import {
  cleanupBuilderWorkflows,
  commitAll,
  createApprovedWorkflow,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { registerLaunchBuilderTool } from '#tools/main/launch-builder.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { openBuilderEscalation } from '#workflow/escalation/openBuilderEscalation.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';

type RegisteredTool = ToolDefinition<TSchema, unknown, unknown>;

type EventHandler = (payload: unknown) => void;

type RequestHandler = (request: SubagentDelegationRequest) => void;

class FakeEventBus implements EventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private requestHandler: RequestHandler | undefined;
  private readonly requests: unknown[] = [];

  public setRequestHandler(handler: RequestHandler): void {
    this.requestHandler = handler;
  }

  public getRequests(): readonly unknown[] {
    return this.requests;
  }

  public getListenerCount(channel: string): number {
    return this.handlers.get(channel)?.size ?? 0;
  }

  public on(channel: string, handler: EventHandler): () => void {
    const handlers = this.handlers.get(channel) ?? new Set<EventHandler>();
    handlers.add(handler);
    this.handlers.set(channel, handlers);

    return () => {
      handlers.delete(handler);
    };
  }

  public emit(channel: string, data: unknown): void {
    if (channel === SUBAGENT_DELEGATION_REQUEST_EVENT) {
      this.requests.push(data);
      // JUSTIFICATION: This fake emits only the delegation request shape to the configured request handler.
      const request = data as SubagentDelegationRequest;
      this.requestHandler?.(request);
    }

    for (const handler of this.handlers.get(channel) ?? []) {
      handler(data);
    }
  }
}

type RegisteredLaunchBuilderTool = {
  tool: RegisteredTool;
  events: FakeEventBus;
};

const createRegisteredTool = (): RegisteredLaunchBuilderTool => {
  let tool: RegisteredTool | undefined;
  const events = new FakeEventBus();

  // JUSTIFICATION: The fake implements only tool registration and the event bus used by this adapter.
  // JUSTIFICATION: The fake implements only the registration method used by this test.
  const pi = {
    registerTool: (registeredTool: RegisteredTool): void => {
      tool = registeredTool;
    },
  } as ExtensionAPI;

  Object.assign(pi, { events });
  registerLaunchBuilderTool(pi);

  if (tool === undefined) {
    throw new Error('Launch builder tool was not registered.');
  }

  return { tool, events };
};

type ExecuteToolInput = {
  tool: RegisteredTool;
  repositoryRoot: string;
  specId: string;
};

const executeTool = async ({
  tool,
  repositoryRoot,
  specId,
}: ExecuteToolInput) => {
  // JUSTIFICATION: The adapter only reads cwd from the extension context in this test.
  const context = { cwd: repositoryRoot } as ExtensionContext;

  return tool.execute('test-call', { specId }, undefined, undefined, context);
};

const emitCompletedResponse = ({
  events,
  request,
}: {
  events: FakeEventBus;
  request: SubagentDelegationRequest;
}): void => {
  events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
    requestId: request.requestId,
    ownerRunId: request.ownerRunId,
    nodeId: request.nodeId,
    status: 'completed',
    result: { kind: 'text', text: 'The builder finished.' },
  });
};

afterEach(cleanupBuilderWorkflows);

describe('launch builder tool', () => {
  it('registers a closed spec-only input schema', () => {
    const { tool } = createRegisteredTool();

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
    const { tool, events } = createRegisteredTool();
    let receivedRequest: SubagentDelegationRequest | undefined;

    events.setRequestHandler((request) => {
      receivedRequest = request;

      events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: 'other-request',
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: 'completed',
        result: { kind: 'text', text: 'Ignore this response.' },
      });

      void (async () => {
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
        await commitAll({ path: repository.path, message: 'Builder done' });
        emitCompletedResponse({ events, request });
      })();
    });

    const result = await executeTool({
      tool,
      repositoryRoot: repository.path,
      specId: SPEC_ID,
    });

    expect(receivedRequest).toMatchObject({
      agent: AGENTS.BUILDER,
      context: 'fresh',
      cwd: repository.path,
      model: 'openai-codex/gpt-6-luna',
      thinking: 'high',
      timeoutMs: 60 * 60 * 1000,
      task: expect.stringContaining(SPEC_ID),
      result: { kind: 'text' },
    });
    expect(receivedRequest?.task).toContain(repository.path);
    expect(receivedRequest?.task).toContain('AGENTS.md');
    expect(events.getListenerCount(SUBAGENT_DELEGATION_RESPONSE_EVENT)).toBe(0);
    expect(result.details).toMatchObject({
      outcome: 'done',
      specId: SPEC_ID,
      phase: WORKFLOW_PHASES.READY_FOR_VERIFIER,
    });
  });

  it('returns a committed failed handoff and does not relaunch it', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    const { tool, events } = createRegisteredTool();
    let requestCount = 0;

    events.setRequestHandler((request) => {
      requestCount += 1;

      void (async () => {
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
        await commitAll({ path: repository.path, message: 'Builder failed' });
        emitCompletedResponse({ events, request });
      })();
    });

    const result = await executeTool({
      tool,
      repositoryRoot: repository.path,
      specId: SPEC_ID,
    });

    expect(result.details).toMatchObject({
      outcome: 'failed',
      phase: WORKFLOW_PHASES.BUILDER_FAILED,
    });

    await expect(
      executeTool({ tool, repositoryRoot: repository.path, specId: SPEC_ID }),
    ).rejects.toThrow(
      'Builder launch is not valid from phase "builder-failed".',
    );
    expect(requestCount).toBe(1);
  });

  it('returns a committed escalation result', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    const { tool, events } = createRegisteredTool();

    events.setRequestHandler((request) => {
      void (async () => {
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
        await commitAll({
          path: repository.path,
          message: 'Builder escalation',
        });
        emitCompletedResponse({ events, request });
      })();
    });

    const result = await executeTool({
      tool,
      repositoryRoot: repository.path,
      specId: SPEC_ID,
    });

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

    const { tool, events } = createRegisteredTool();

    await expect(
      executeTool({ tool, repositoryRoot: repository.path, specId: SPEC_ID }),
    ).rejects.toThrow('clean current checkout');
    expect(events.getRequests()).toHaveLength(0);
    expect(events.getListenerCount(SUBAGENT_DELEGATION_RESPONSE_EVENT)).toBe(0);
  });

  it('returns a delegation error without advancing the workflow', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    const { tool, events } = createRegisteredTool();

    events.setRequestHandler((request) => {
      events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: request.requestId,
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: 'failed',
        error: 'The configured provider is unavailable.',
      });
    });

    await expect(
      executeTool({ tool, repositoryRoot: repository.path, specId: SPEC_ID }),
    ).rejects.toThrow(
      'Delegation error: The configured provider is unavailable.',
    );
    await expect(
      readWorkflowState({ path: paths.getWorkflowPath(SPEC_ID) }),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.BUILDER_RUNNING });
    expect(events.getListenerCount(SUBAGENT_DELEGATION_RESPONSE_EVENT)).toBe(0);
  });

  it('returns a timeout without advancing the workflow', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    const { tool, events } = createRegisteredTool();

    events.setRequestHandler((request) => {
      events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: request.requestId,
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: 'timed_out',
        error: 'The builder exceeded its timeout.',
      });
    });

    await expect(
      executeTool({ tool, repositoryRoot: repository.path, specId: SPEC_ID }),
    ).rejects.toThrow('Delegation timeout: The builder exceeded its timeout.');
    await expect(
      readWorkflowState({ path: paths.getWorkflowPath(SPEC_ID) }),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.BUILDER_RUNNING });
  });

  it('returns an interruption without advancing the workflow', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    const { tool, events } = createRegisteredTool();

    events.setRequestHandler((request) => {
      events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: request.requestId,
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: 'interrupted',
        error: 'The builder was interrupted.',
      });
    });

    await expect(
      executeTool({ tool, repositoryRoot: repository.path, specId: SPEC_ID }),
    ).rejects.toThrow('Delegation interruption: The builder was interrupted.');
    await expect(
      readWorkflowState({ path: paths.getWorkflowPath(SPEC_ID) }),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.BUILDER_RUNNING });
  });

  it('returns a protocol error without advancing the workflow', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    const { tool, events } = createRegisteredTool();

    events.setRequestHandler((request) => {
      events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: request.requestId,
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: 'unsupported',
      });
    });

    await expect(
      executeTool({ tool, repositoryRoot: repository.path, specId: SPEC_ID }),
    ).rejects.toThrow(
      'Protocol error: unsupported final response status "unsupported".',
    );
    await expect(
      readWorkflowState({ path: paths.getWorkflowPath(SPEC_ID) }),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.BUILDER_RUNNING });
  });
});
