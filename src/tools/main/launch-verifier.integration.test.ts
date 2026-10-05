import { access, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
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
import { VERIFIER_HANDOFF_VERSION } from '#artifacts/verifier-handoff/schema.ts';
import { AGENTS } from '#config/schema.ts';
import { createWorkflowCheckpointCommit } from '#git/commits/createWorkflowCheckpointCommit.ts';
import { getParentCommit } from '#git/history/getParentCommit.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import {
  cleanupBuilderWorkflows,
  commitAll,
  createApprovedWorkflow,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import { registerLaunchVerifierTool } from '#tools/main/launch-verifier.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderLaunch } from '#workflow/builder/prepareBuilderLauncher.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import {
  completeVerifierPass,
  VERIFIER_PASS_ERRORS,
} from '#workflow/verifier/completeVerifierPass.ts';

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
      // JUSTIFICATION: The fake emits only the delegation request shape to the configured request handler.
      const request = data as SubagentDelegationRequest;
      this.requestHandler?.(request);
    }

    for (const handler of this.handlers.get(channel) ?? []) {
      handler(data);
    }
  }
}

type RegisteredLaunchVerifierTool = {
  tool: RegisteredTool;
  events: FakeEventBus;
};

const createRegisteredTool = (): RegisteredLaunchVerifierTool => {
  let tool: RegisteredTool | undefined;
  const events = new FakeEventBus();

  // JUSTIFICATION: The fake implements only tool registration and the event bus used by this adapter.
  const pi = {
    registerTool: (registeredTool: RegisteredTool): void => {
      tool = registeredTool;
    },
  } as ExtensionAPI;

  Object.assign(pi, { events });
  registerLaunchVerifierTool(pi);

  if (tool === undefined) {
    throw new Error('Launch verifier tool was not registered.');
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

const createReadyForVerifierWorkflow = async () => {
  const workflow = await createApprovedWorkflow();

  const builderLaunch = await prepareBuilderLaunch({
    paths: workflow.paths,
    specId: SPEC_ID,
  });

  await completeBuilderPass({
    paths: workflow.paths,
    specId: SPEC_ID,
    handoff: {
      status: 'done',
      summary: 'The approved change was implemented.',
      acceptanceCriteria: [],
      notes: [],
    },
  });
  await commitAll({
    path: workflow.repository.path,
    message: `Builder completed at revision ${builderLaunch.revision + 1}`,
  });

  return workflow;
};

const getCurrentCandidate = async (repositoryRoot: string): Promise<string> =>
  getParentCommit({
    repositoryRoot,
    commit: await getHeadCommit({ repositoryRoot }),
  });

type VerifierHandoffInput = {
  revision: number;
  findings?: readonly unknown[];
};

const createVerifierHandoff = ({
  revision,
  findings = [],
}: VerifierHandoffInput) => ({
  version: VERIFIER_HANDOFF_VERSION,
  specId: SPEC_ID,
  revision,
  summary: 'The candidate was independently verified.',
  acceptanceCriteria: [],
  findings,
  notes: [],
});

const recordVerifierHandoff = async ({
  repositoryRoot,
  paths,
  findings = [],
}: {
  repositoryRoot: string;
  paths: MaestroPaths;
  findings?: readonly unknown[];
}): Promise<void> => {
  const state = await readWorkflowState({
    path: paths.getWorkflowPath(SPEC_ID),
  });

  const completed = await completeVerifierPass({
    paths,
    specId: SPEC_ID,
    candidateCommit: await getCurrentCandidate(repositoryRoot),
    handoff: createVerifierHandoff({
      revision: state.revision + 1,
      findings,
    }),
  });

  if ('error' in completed) {
    throw new Error(completed.message);
  }

  await createWorkflowCheckpointCommit({
    repositoryRoot,
    expectedPaths: [
      paths.getWorkflowPath(SPEC_ID),
      paths.getVerifierHandoffPath(SPEC_ID),
    ],
  });
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
    result: { kind: 'text', text: 'The verifier finished.' },
  });
};

afterEach(cleanupBuilderWorkflows);

describe('launch verifier tool', () => {
  it('registers a closed spec-only input schema', () => {
    const { tool } = createRegisteredTool();

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

  it('launches the verifier in the current checkout with explicit spec identity', async () => {
    const workflow = await createReadyForVerifierWorkflow();
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
        await recordVerifierHandoff({
          repositoryRoot: workflow.repository.path,
          paths: workflow.paths,
        });
        emitCompletedResponse({ events, request });
      })();
    });

    const result = await executeTool({
      tool,
      repositoryRoot: workflow.repository.path,
      specId: SPEC_ID,
    });

    expect(receivedRequest).toMatchObject({
      agent: AGENTS.VERIFIER,
      nodeId: 'verifier',
      context: 'fresh',
      cwd: workflow.repository.path,
      model: 'openai-codex/gpt-6-sol',
      thinking: 'medium',
      timeoutMs: 60 * 60 * 1000,
      task: expect.stringContaining(SPEC_ID),
      result: { kind: 'text' },
    });
    expect(receivedRequest?.task).toContain(workflow.repository.path);
    expect(receivedRequest?.task).toContain('AGENTS.md');
    expect(events.getListenerCount(SUBAGENT_DELEGATION_RESPONSE_EVENT)).toBe(0);
    expect(result.details).toMatchObject({
      outcome: WORKFLOW_PHASES.CANDIDATE_READY,
      specId: SPEC_ID,
      phase: WORKFLOW_PHASES.CANDIDATE_READY,
    });
  });

  it('returns findings and cleans the response listener', async () => {
    const workflow = await createReadyForVerifierWorkflow();
    const { tool, events } = createRegisteredTool();

    events.setRequestHandler((request) => {
      void (async () => {
        await recordVerifierHandoff({
          repositoryRoot: workflow.repository.path,
          paths: workflow.paths,
          findings: [
            {
              id: 'F1',
              acceptanceCriterion: null,
              severity: 'medium',
              confidence: 1,
              summary: 'The verifier found a problem.',
              evidence: [
                { source: 'test', observation: 'The problem was observed.' },
              ],
              rejection: null,
            },
          ],
        });
        emitCompletedResponse({ events, request });
      })();
    });

    const result = await executeTool({
      tool,
      repositoryRoot: workflow.repository.path,
      specId: SPEC_ID,
    });

    expect(result.details).toMatchObject({
      outcome: WORKFLOW_PHASES.FINDINGS_DECISION,
      phase: WORKFLOW_PHASES.FINDINGS_DECISION,
      handoff: { findings: [{ id: 'F1' }] },
    });
    expect(events.getListenerCount(SUBAGENT_DELEGATION_RESPONSE_EVENT)).toBe(0);
  });

  it('returns product changes without advancing the workflow', async () => {
    const workflow = await createReadyForVerifierWorkflow();
    const { tool, events } = createRegisteredTool();

    events.setRequestHandler((request) => {
      void (async () => {
        await writeFile(
          join(workflow.repository.path, 'README.md'),
          '# Changed\n',
        );

        const state = await readWorkflowState({
          path: workflow.paths.getWorkflowPath(SPEC_ID),
        });

        const completed = await completeVerifierPass({
          paths: workflow.paths,
          specId: SPEC_ID,
          candidateCommit: await getCurrentCandidate(workflow.repository.path),
          handoff: createVerifierHandoff({ revision: state.revision + 1 }),
        });

        expect(completed).toMatchObject({
          error: VERIFIER_PASS_ERRORS.PRODUCT_FILES_MODIFIED,
        });
        emitCompletedResponse({ events, request });
      })();
    });

    const result = await executeTool({
      tool,
      repositoryRoot: workflow.repository.path,
      specId: SPEC_ID,
    });

    expect(result.details).toMatchObject({
      outcome: VERIFIER_PASS_ERRORS.PRODUCT_FILES_MODIFIED,
      error: VERIFIER_PASS_ERRORS.PRODUCT_FILES_MODIFIED,
      phase: WORKFLOW_PHASES.VERIFIER_RUNNING,
    });
    await expect(
      readWorkflowState({ path: workflow.paths.getWorkflowPath(SPEC_ID) }),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.VERIFIER_RUNNING });
    expect(events.getListenerCount(SUBAGENT_DELEGATION_RESPONSE_EVENT)).toBe(0);
  });

  it('returns a workflow error before delegation', async () => {
    const workflow = await createApprovedWorkflow();
    const { tool, events } = createRegisteredTool();

    await expect(
      executeTool({
        tool,
        repositoryRoot: workflow.repository.path,
        specId: SPEC_ID,
      }),
    ).rejects.toThrow(
      'Verifier launch requires ready-for-verifier state, found "ready-for-builder".',
    );
    expect(events.getRequests()).toHaveLength(0);
    expect(events.getListenerCount(SUBAGENT_DELEGATION_RESPONSE_EVENT)).toBe(0);
  });

  it('returns a delegation error without advancing the workflow', async () => {
    const workflow = await createReadyForVerifierWorkflow();
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
      executeTool({
        tool,
        repositoryRoot: workflow.repository.path,
        specId: SPEC_ID,
      }),
    ).rejects.toThrow(
      'Delegation error: The configured provider is unavailable.',
    );
    await expect(
      readWorkflowState({ path: workflow.paths.getWorkflowPath(SPEC_ID) }),
    ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.VERIFIER_RUNNING });
    expect(events.getListenerCount(SUBAGENT_DELEGATION_RESPONSE_EVENT)).toBe(0);
  });

  it('returns timeout and interruption errors distinctly', async () => {
    const timeoutWorkflow = await createReadyForVerifierWorkflow();
    const timeoutTool = createRegisteredTool();
    timeoutTool.events.setRequestHandler((request) => {
      timeoutTool.events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: request.requestId,
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: 'timed_out',
        error: 'The verifier exceeded its timeout.',
      });
    });

    await expect(
      executeTool({
        tool: timeoutTool.tool,
        repositoryRoot: timeoutWorkflow.repository.path,
        specId: SPEC_ID,
      }),
    ).rejects.toThrow('Delegation timeout: The verifier exceeded its timeout.');

    const interruptionWorkflow = await createReadyForVerifierWorkflow();
    const interruptionTool = createRegisteredTool();
    interruptionTool.events.setRequestHandler((request) => {
      interruptionTool.events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
        requestId: request.requestId,
        ownerRunId: request.ownerRunId,
        nodeId: request.nodeId,
        status: 'interrupted',
        error: 'The verifier was interrupted.',
      });
    });

    await expect(
      executeTool({
        tool: interruptionTool.tool,
        repositoryRoot: interruptionWorkflow.repository.path,
        specId: SPEC_ID,
      }),
    ).rejects.toThrow('Delegation interruption: The verifier was interrupted.');
  });

  it('returns a protocol error when a completed response has no handoff', async () => {
    const workflow = await createReadyForVerifierWorkflow();
    const { tool, events } = createRegisteredTool();

    events.setRequestHandler((request) => {
      emitCompletedResponse({ events, request });
    });

    await expect(
      executeTool({
        tool,
        repositoryRoot: workflow.repository.path,
        specId: SPEC_ID,
      }),
    ).rejects.toThrow(
      'Verifier protocol error: The verifier returned without recording a valid terminal handoff.',
    );
    expect(events.getListenerCount(SUBAGENT_DELEGATION_RESPONSE_EVENT)).toBe(0);
    await expect(
      access(workflow.paths.getVerifierHandoffPath(SPEC_ID)),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
