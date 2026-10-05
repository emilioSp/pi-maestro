import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  AgentSession,
  BuildSystemPromptOptions,
  ExtensionAPI,
  SessionStartEvent,
  wrapRegisteredTool,
} from '@earendil-works/pi-coding-agent';
import { getAgentDir } from '@earendil-works/pi-coding-agent';
import {
  SUBAGENT_DELEGATION_REQUEST_EVENT,
  SUBAGENT_DELEGATION_RESPONSE_EVENT,
  type SubagentDelegationRequest,
} from 'pi-subagents/delegation';
import { Type } from 'typebox';
import { afterEach, describe, expect, it } from 'vitest';
import { AGENTS } from '#config/schema.ts';
import maestroExtension from '#extensions/maestro.ts';
import { runGitCommand } from '#git/command.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import { MAESTRO_STATUS_KEY } from '#maestro/status/refreshMaestroStatus.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  failedHandoff,
  SPEC_ID,
} from '#test/support/builder-workflow.ts';
import piTestSessions from '#test/support/pi-session.ts';
import { createTemporaryRepository } from '#test/support/temp-repository.ts';
import { CREATE_SPEC_TOOL } from '#tools/main/create-spec.ts';
import { LAUNCH_BUILDER_TOOL } from '#tools/main/launch-builder.ts';
import { LAUNCH_VERIFIER_TOOL } from '#tools/main/launch-verifier.ts';
import { MARK_SPEC_READY_TOOL } from '#tools/main/mark-spec-ready.ts';
import { RESOLVE_ESCALATION_TOOL } from '#tools/main/resolve-escalation.ts';
import { RESOLVE_FINDINGS_TOOL } from '#tools/main/resolve-findings.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';

const FOREIGN_TOOL = 'foreign_tool';

const MAIN_TOOL_NAMES = [
  CREATE_SPEC_TOOL.NAME,
  MARK_SPEC_READY_TOOL.NAME,
  LAUNCH_BUILDER_TOOL.NAME,
  RESOLVE_ESCALATION_TOOL.NAME,
  LAUNCH_VERIFIER_TOOL.NAME,
  RESOLVE_FINDINGS_TOOL.NAME,
];

const BASE_TOOLS = ['read', 'bash', 'edit', 'write', FOREIGN_TOOL];

const foreignExtension = (pi: ExtensionAPI): void => {
  pi.registerTool({
    name: FOREIGN_TOOL,
    label: 'Foreign tool',
    description: 'A tool owned by another extension.',
    parameters: Type.Object({}),
    execute: async () => ({ content: [], details: undefined }),
  });
};

type CreateMainSessionInput = {
  cwd?: string;
  projectTrusted?: boolean;
  maestroAgentsAvailable?: boolean;
  sessionStartEvent?: SessionStartEvent;
};

const createMainSession = (input: CreateMainSessionInput = {}) =>
  piTestSessions.create({
    ...input,
    extensions: [foreignExtension, maestroExtension],
  });

type EmitPromptInput = {
  session: AgentSession;
  options?: BuildSystemPromptOptions;
};

const emitPrompt = ({ session, options }: EmitPromptInput) =>
  session.extensionRunner.emitBeforeAgentStart(
    'Discuss the next change.',
    undefined,
    options ?? {
      cwd: session.extensionRunner.createContext().cwd,
      sections: { foreign: 'Keep foreign instructions' },
    },
  );

type RegisteredTool = ReturnType<typeof wrapRegisteredTool>;

function assertToolRegistered(
  tool: RegisteredTool | undefined,
): asserts tool is RegisteredTool {
  if (tool === undefined) throw new Error('The tool is not active in Pi.');
}

type ExecuteMainToolInput = {
  session: AgentSession;
  name: string;
  input: Record<string, unknown>;
};

// Exercise Pi's active tool and result handlers without a model call.
const executeMainTool = async ({
  session,
  name,
  input,
}: ExecuteMainToolInput) => {
  const tool = session.agent.state.tools.find((tool) => tool.name === name);
  assertToolRegistered(tool);
  const result = await tool.execute('test-call', input);
  await session.extensionRunner.emitToolResult({
    type: 'tool_result',
    toolName: name,
    toolCallId: 'test-call',
    input,
    ...result,
    isError: false,
  });

  return result;
};

const cleanupFunctions: Array<() => Promise<void>> = [];

afterEach(async () => {
  await piTestSessions.cleanup();
  await cleanupBuilderWorkflows();
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
});

describe('main Maestro extension', () => {
  it('given startup when the extension loads then only main tools register once and Maestro stays silent and off', async () => {
    const { session, notify, setStatus } = await createMainSession({
      maestroAgentsAvailable: false,
    });

    expect(
      session.extensionRunner
        .getAllRegisteredTools()
        .map(({ definition }) => definition.name),
    ).toEqual([FOREIGN_TOOL, ...MAIN_TOOL_NAMES]);
    expect(session.getActiveToolNames()).toEqual(BASE_TOOLS);
    expect(maestroSessionState.isActive()).toBe(false);
    expect(notify).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenLastCalledWith(MAESTRO_STATUS_KEY, undefined);
    const event = await emitPrompt({ session });
    expect(event.systemPromptOptions.sections).toEqual({
      foreign: 'Keep foreign instructions',
    });
  });

  it('given valid checks when Maestro activates then tools instructions and status become available', async () => {
    const repository = await createTemporaryRepository();
    cleanupFunctions.push(repository.cleanup);

    const { session, notify, setStatus } = await createMainSession({
      cwd: repository.path,
    });

    await session.prompt('/maestro');

    expect(maestroSessionState.isActive()).toBe(true);
    expect(session.getActiveToolNames()).toEqual([
      ...BASE_TOOLS,
      ...MAIN_TOOL_NAMES,
    ]);
    expect(setStatus).toHaveBeenLastCalledWith(
      MAESTRO_STATUS_KEY,
      'Maestro active · No active spec',
    );
    expect(notify).not.toHaveBeenCalled();
    const event = await emitPrompt({ session });
    expect(event.systemPromptOptions.sections.maestro).toContain(
      'You are Maestro',
    );
    expect(event.systemPromptOptions.sections.foreign).toBe(
      'Keep foreign instructions',
    );
    expect(event.systemPromptOptions.sections.maestro).toContain(
      'there is no retry or spec revision from builder-failed',
    );

    setStatus.mockClear();
    await session.extensionRunner.emitToolResult({
      type: 'tool_result',
      toolName: FOREIGN_TOOL,
      toolCallId: 'foreign-call',
      input: {},
      content: [],
      details: undefined,
      isError: false,
    });
    expect(setStatus).not.toHaveBeenCalled();

    await session.prompt('/maestro');
    await session.prompt('/maestro');
    expect(maestroSessionState.isActive()).toBe(true);
    expect(session.getActiveToolNames()).toEqual([
      ...BASE_TOOLS,
      ...MAIN_TOOL_NAMES,
    ]);
    expect(
      session.extensionRunner
        .getAllRegisteredTools()
        .map(({ definition }) => definition.name),
    ).toEqual([FOREIGN_TOOL, ...MAIN_TOOL_NAMES]);
    expect(notify).not.toHaveBeenCalled();
  });

  it('given active Maestro when its agents become unavailable then turning off succeeds and the next activation fails', async () => {
    const repository = await createTemporaryRepository();
    cleanupFunctions.push(repository.cleanup);

    const { session, notify } = await createMainSession({
      cwd: repository.path,
    });

    await session.prompt('/maestro');
    expect(maestroSessionState.isActive()).toBe(true);

    await writeFile(
      join(getAgentDir(), 'settings.json'),
      JSON.stringify({ packages: [] }),
    );
    await session.prompt('/maestro');
    expect(maestroSessionState.isActive()).toBe(false);
    expect(notify).not.toHaveBeenCalled();

    await session.prompt('/maestro');
    expect(maestroSessionState.isActive()).toBe(false);
    expect(session.getActiveToolNames()).toEqual(BASE_TOOLS);
    expect(notify).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenLastCalledWith(
      expect.stringContaining(`Unknown agent: ${AGENTS.BUILDER}`),
      'error',
    );
  });

  it('given a failed check when activation is retried then Maestro stays off and reports each error', async () => {
    const repository = await createTemporaryRepository();
    cleanupFunctions.push(repository.cleanup);

    const { session, notify, setStatus, settingsManager } =
      await createMainSession({
        cwd: repository.path,
        projectTrusted: false,
      });

    await session.prompt('/maestro');
    await session.prompt('/maestro');

    expect(maestroSessionState.isActive()).toBe(false);
    expect(session.getActiveToolNames()).toEqual(BASE_TOOLS);
    expect(setStatus).toHaveBeenLastCalledWith(MAESTRO_STATUS_KEY, undefined);
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenLastCalledWith(
      expect.stringContaining('Project is not trusted'),
      'error',
    );

    settingsManager.setProjectTrusted(true);
    await session.prompt('/maestro');
    expect(maestroSessionState.isActive()).toBe(true);
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it('given an active spec when Maestro turns off then live state clears and current branch and files remain unchanged', async () => {
    const { paths, repository } = await createApprovedWorkflow();

    const { session, notify, setStatus, settingsManager } =
      await createMainSession({
        cwd: repository.path,
      });

    await session.prompt('/maestro');
    maestroSessionState.setActiveSpecId(SPEC_ID);
    const specPath = paths.getSpecFilePath(SPEC_ID);
    await maestroSessionState.setSpecSha256({ specPath });
    const spec = await readFile(specPath, 'utf8');
    const workflow = await readFile(paths.getWorkflowPath(SPEC_ID), 'utf8');
    await runGitCommand({
      arguments: ['switch', '-c', 'owner-selected'],
      cwd: repository.path,
    });

    const head = await runGitCommand({
      arguments: ['rev-parse', 'HEAD'],
      cwd: repository.path,
    });

    const worktrees = await runGitCommand({
      arguments: ['worktree', 'list', '--porcelain'],
      cwd: repository.path,
    });

    const event = await emitPrompt({ session });
    expect(maestroSessionState.getSpecSha256()).not.toBeNull();

    session.setActiveToolsByName(['read', FOREIGN_TOOL, ...MAIN_TOOL_NAMES]);
    settingsManager.setProjectTrusted(false);
    await session.prompt('/maestro');

    const inactivePrompt = await emitPrompt({
      session,
      options: event.systemPromptOptions,
    });

    expect(maestroSessionState.isActive()).toBe(false);
    expect(maestroSessionState.getActiveSpecId()).toBeNull();
    expect(maestroSessionState.getSpecSha256()).toBeNull();
    expect(session.getActiveToolNames()).toEqual(['read', FOREIGN_TOOL]);
    expect(inactivePrompt.systemPromptOptions.sections).toEqual({
      foreign: 'Keep foreign instructions',
    });
    expect(setStatus).toHaveBeenLastCalledWith(MAESTRO_STATUS_KEY, undefined);
    expect(notify).not.toHaveBeenCalled();
    expect(await readFile(specPath, 'utf8')).toBe(spec);
    expect(await readFile(paths.getWorkflowPath(SPEC_ID), 'utf8')).toBe(
      workflow,
    );
    expect(
      await runGitCommand({
        arguments: ['branch', '--show-current'],
        cwd: repository.path,
      }),
    ).toMatchObject({ stdout: 'owner-selected\n' });
    expect(
      await runGitCommand({
        arguments: ['rev-parse', 'HEAD'],
        cwd: repository.path,
      }),
    ).toEqual(head);
    expect(
      await runGitCommand({
        arguments: ['worktree', 'list', '--porcelain'],
        cwd: repository.path,
      }),
    ).toEqual(worktrees);

    settingsManager.setProjectTrusted(true);
    await session.prompt('/maestro');
    expect(maestroSessionState.isActive()).toBe(true);
    expect(maestroSessionState.getActiveSpecId()).toBeNull();
    expect(setStatus).toHaveBeenLastCalledWith(
      MAESTRO_STATUS_KEY,
      'Maestro active · No active spec',
    );
    expect(session.getActiveToolNames()).toEqual([
      'read',
      FOREIGN_TOOL,
      ...MAIN_TOOL_NAMES,
    ]);
  });

  it('given an active workflow when a session resumes then Maestro stays off without recovering the workflow', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    await maestroSessionState.setSpecSha256({
      specPath: paths.getSpecFilePath(SPEC_ID),
    });
    const workflow = await readFile(paths.getWorkflowPath(SPEC_ID), 'utf8');

    const { session, notify, setStatus } = await createMainSession({
      cwd: repository.path,
      sessionStartEvent: { type: 'session_start', reason: 'resume' },
      maestroAgentsAvailable: false,
    });

    expect(maestroSessionState.isActive()).toBe(false);
    expect(maestroSessionState.getActiveSpecId()).toBeNull();
    expect(maestroSessionState.getSpecSha256()).toBeNull();
    expect(session.getActiveToolNames()).toEqual(BASE_TOOLS);
    expect(notify).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenLastCalledWith(MAESTRO_STATUS_KEY, undefined);
    expect(await readFile(paths.getWorkflowPath(SPEC_ID), 'utf8')).toBe(
      workflow,
    );
  });

  it('given Maestro on when a spec is created and approved then the registered tools refresh the current workflow status', async () => {
    const repository = await createTemporaryRepository();
    cleanupFunctions.push(repository.cleanup);

    const { session, setStatus } = await createMainSession({
      cwd: repository.path,
    });

    await session.prompt('/maestro');
    await executeMainTool({
      session,
      name: CREATE_SPEC_TOOL.NAME,
      input: { title: 'Add Weather Alerts' },
    });
    const specId = maestroSessionState.getActiveSpecId();
    expect(specId).not.toBeNull();
    expect(setStatus).toHaveBeenLastCalledWith(
      MAESTRO_STATUS_KEY,
      `Maestro active · ${specId} · Preparing specification`,
    );

    const result = await executeMainTool({
      session,
      name: MARK_SPEC_READY_TOOL.NAME,
      input: { specId },
    });

    expect(result.details).toMatchObject({
      phase: WORKFLOW_PHASES.READY_FOR_BUILDER,
    });
    expect(setStatus).toHaveBeenLastCalledWith(
      MAESTRO_STATUS_KEY,
      `Maestro active · ${specId} · Ready for builder`,
    );
  });

  it.each([
    WORKFLOW_PHASES.ESCALATION_DECISION,
    WORKFLOW_PHASES.FINDINGS_DECISION,
  ])(
    'given %s when the owner approves a spec revision then the registered tool returns ready-for-builder on the same branch',
    async (phase) => {
      const { paths, repository } = await createApprovedWorkflow();

      const current = await readWorkflowState({
        path: paths.getWorkflowPath(SPEC_ID),
      });

      await writeWorkflowState({
        path: paths.getWorkflowPath(SPEC_ID),
        state: { ...current, revision: current.revision + 1, phase },
        currentRevision: current.revision,
      });
      await writeFile(
        paths.getSpecFilePath(SPEC_ID),
        '# Owner-approved revised contract\n',
        'utf8',
      );

      const { session, setStatus } = await createMainSession({
        cwd: repository.path,
      });

      await session.prompt('/maestro');
      maestroSessionState.setActiveSpecId(SPEC_ID);

      const result = await executeMainTool({
        session,
        name: MARK_SPEC_READY_TOOL.NAME,
        input: { specId: SPEC_ID },
      });

      expect(result.details).toMatchObject({
        specId: SPEC_ID,
        phase: WORKFLOW_PHASES.READY_FOR_BUILDER,
        revision: current.revision + 2,
      });
      expect(setStatus).toHaveBeenLastCalledWith(
        MAESTRO_STATUS_KEY,
        `Maestro active · ${SPEC_ID} · Ready for builder`,
      );
      expect(
        await runGitCommand({
          arguments: ['branch', '--show-current'],
          cwd: repository.path,
        }),
      ).toMatchObject({ stdout: 'main\n' });
    },
  );

  it('given a committed builder failure when the registered launch tool returns then the owner receives the failure and status updates', async () => {
    const { paths, repository } = await createApprovedWorkflow();

    const { session, events, setStatus } = await createMainSession({
      cwd: repository.path,
    });

    await session.prompt('/maestro');
    maestroSessionState.setActiveSpecId(SPEC_ID);
    const requests: SubagentDelegationRequest[] = [];
    events.on(SUBAGENT_DELEGATION_REQUEST_EVENT, async (payload) => {
      // JUSTIFICATION: This listener receives the request emitted by the registered launch tool.
      const request = payload as SubagentDelegationRequest;
      requests.push(request);

      try {
        await completeBuilderPass({
          paths,
          specId: SPEC_ID,
          handoff: failedHandoff(3),
        });
        await repository.commit({ message: 'Builder failure handoff' });
        events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
          requestId: request.requestId,
          ownerRunId: request.ownerRunId,
          nodeId: request.nodeId,
          status: 'completed',
          result: { kind: 'text', text: 'The builder failed.' },
        });
      } catch (error) {
        events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
          requestId: request.requestId,
          ownerRunId: request.ownerRunId,
          nodeId: request.nodeId,
          status: 'failed',
          error: String(error),
        });
      }
    });

    const result = await executeMainTool({
      session,
      name: LAUNCH_BUILDER_TOOL.NAME,
      input: { specId: SPEC_ID },
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      cwd: repository.path,
      context: 'fresh',
    });
    expect(result.details).toMatchObject({
      phase: WORKFLOW_PHASES.BUILDER_FAILED,
      handoff: { failure: { reason: 'The implementation was blocked.' } },
    });
    expect(result.content).toEqual([
      { type: 'text', text: expect.stringContaining('cannot be retried') },
    ]);
    expect(setStatus).toHaveBeenLastCalledWith(
      MAESTRO_STATUS_KEY,
      `Maestro active · ${SPEC_ID} · Builder failed`,
    );
  });

  it('given a missing active workflow when status refreshes then it reports an error without blocking instructions', async () => {
    const repository = await createTemporaryRepository();
    cleanupFunctions.push(repository.cleanup);

    const { session, notify, setStatus } = await createMainSession({
      cwd: repository.path,
    });

    await session.prompt('/maestro');
    maestroSessionState.setActiveSpecId(SPEC_ID);
    const event = await emitPrompt({ session });

    expect(event.systemPromptOptions.sections.maestro).toContain(
      'You are Maestro',
    );
    expect(setStatus).toHaveBeenLastCalledWith(MAESTRO_STATUS_KEY, undefined);
    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining('ENOENT'),
      'error',
    );
  });
});
