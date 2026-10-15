/**
 * Objective: Check main Maestro registration and the current-checkout workflow.
 * Used: In integration tests with real Pi sessions and scripted child work.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  ExtensionAPI,
  wrapRegisteredTool,
} from '@earendil-works/pi-coding-agent';
import { getAgentDir } from '@earendil-works/pi-coding-agent';
import { stripTerminalSequences } from '@earendil-works/pi-tui';
import {
  SUBAGENT_DELEGATION_REQUEST_EVENT,
  SUBAGENT_DELEGATION_RESPONSE_EVENT,
  type SubagentDelegationRequest,
} from 'pi-subagents/delegation';
import { Type } from 'typebox';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BUILDER_HANDOFF_STATUSES,
  PROBE_STATUSES,
} from '#artifacts/builder-handoff/schema.ts';
import { readVerifierHandoff } from '#artifacts/verifier-handoff/readVerifierHandoff.ts';
import { DEFAULT_CONFIG } from '#config/defaults.ts';
import {
  AGENTS,
  SUPPORTED_CONFIG_VERSION,
  THINKING_LEVELS,
} from '#config/schema.ts';
import maestroExtension from '#extensions/maestro.ts';
import maestroSubagentExtension from '#extensions/maestro-subagent.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import { SUBAGENT_PING } from '#maestro/checks/assertEnvironment.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import { MAESTRO_STATUS_KEY } from '#maestro/status/refreshMaestroStatus.ts';
import type { CreatedSpec } from '#specs/create.ts';
import { unavailableCompilerEscalation } from '#tests/fixtures/unavailable-compiler-escalation.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  SPEC_ID,
} from '#tests/support/builder-workflow.ts';
import piTestSessions from '#tests/support/pi-session.ts';
import { createTemporaryProject } from '#tests/support/temp-repository.ts';
import { BUILDER_HANDOFF_TOOL } from '#tools/child/record-builder-handoff.ts';
import { VERIFIER_HANDOFF_TOOL } from '#tools/child/record-verifier-handoff.ts';
import { CREATE_SPEC_TOOL } from '#tools/main/create-spec.ts';
import { MARK_SPEC_READY_TOOL } from '#tools/main/mark-spec-ready.ts';
import { RESOLVE_ESCALATIONS_TOOL } from '#tools/main/resolve-escalations.ts';
import { RESOLVE_FINDINGS_TOOL } from '#tools/main/resolve-findings.ts';
import { RUN_BUILDER_TOOL } from '#tools/main/run-builder.ts';
import { RUN_VERIFIER_TOOL } from '#tools/main/run-verifier.ts';
import { DELEGATION_STATUSES } from '#tools/utils/pi-subagent-delegation.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES, type WorkflowState } from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';

const successfulPingExtension = (pi: ExtensionAPI): void => {
  pi.events.on(SUBAGENT_PING.REQUEST_EVENT, (payload) => {
    // JUSTIFICATION: Maestro emits this version 1 ping request.
    const request = payload as { requestId: string };
    pi.events.emit(`${SUBAGENT_PING.REPLY_EVENT_PREFIX}${request.requestId}`, {
      version: SUBAGENT_PING.VERSION,
      requestId: request.requestId,
      method: SUBAGENT_PING.METHOD,
      success: true,
      data: { version: SUBAGENT_PING.VERSION },
    });
  });
};

const FOREIGN_TOOL = 'foreign_tool';

const MAIN_TOOL_NAMES = [
  CREATE_SPEC_TOOL.NAME,
  MARK_SPEC_READY_TOOL.NAME,
  RUN_BUILDER_TOOL.NAME,
  RESOLVE_ESCALATIONS_TOOL.NAME,
  RUN_VERIFIER_TOOL.NAME,
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

type RegisteredTool = ReturnType<typeof wrapRegisteredTool>;

function assertToolRegistered(
  tool: RegisteredTool | undefined,
): asserts tool is RegisteredTool {
  if (tool === undefined) throw new Error('The tool is not active in Pi.');
}

const cleanupFunctions: Array<() => Promise<void>> = [];

afterEach(async () => {
  vi.useRealTimers();
  await piTestSessions.cleanup();
  await cleanupBuilderWorkflows();
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
});

describe('main Maestro extension', () => {
  it('given startup when the extension loads then only main tools register once and Maestro stays silent and off', async () => {
    const { session, notify, setStatus } = await piTestSessions.create({
      extensions: [foreignExtension, maestroExtension, successfulPingExtension],
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

    const event = await session.extensionRunner.emitBeforeAgentStart(
      'Discuss the next change.',
      undefined,
      {
        cwd: session.extensionRunner.createContext().cwd,
        sections: { foreign: 'Keep foreign instructions' },
      },
    );

    expect(event.systemPromptOptions.sections).toEqual({
      foreign: 'Keep foreign instructions',
    });
  });

  it('given valid checks when Maestro activates then tools instructions and status become available', async () => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);

    const { session, notify, setStatus } = await piTestSessions.create({
      extensions: [foreignExtension, maestroExtension, successfulPingExtension],
      cwd: repository.path,
    });

    const entriesBeforeActivation = session.sessionManager.getEntries();
    const modelRequests = vi.spyOn(session.agent, 'streamFunction');

    await session.prompt('/maestro');
    const theme = session.extensionRunner.createContext().ui.theme;

    expect(modelRequests).not.toHaveBeenCalled();
    expect(session.sessionManager.getEntries()).toEqual(
      entriesBeforeActivation,
    );
    expect(maestroSessionState.isActive()).toBe(true);
    expect(session.getActiveToolNames()).toEqual([
      ...BASE_TOOLS,
      ...MAIN_TOOL_NAMES,
    ]);
    expect(setStatus).toHaveBeenLastCalledWith(
      MAESTRO_STATUS_KEY,
      theme.fg('muted', 'Maestro active · ') +
        theme.fg('accent', 'No active spec'),
    );
    expect(notify).toHaveBeenCalledOnce();
    expect(notify.mock.calls[0][1]).toBe('info');
    expect(stripTerminalSequences(notify.mock.calls[0][0])).toBe(
      `Maestro active\nMaestro helps the owner define a spec, then coordinates implementation and independent verification.\nAsk how Maestro works for a short explanation.\nBuilder (${DEFAULT_CONFIG.builder.model} ${DEFAULT_CONFIG.builder.thinking})\nVerifier (${DEFAULT_CONFIG.verifier.model} ${DEFAULT_CONFIG.verifier.thinking})`,
    );

    const event = await session.extensionRunner.emitBeforeAgentStart(
      'Discuss the next change.',
      undefined,
      {
        cwd: session.extensionRunner.createContext().cwd,
        sections: { foreign: 'Keep foreign instructions' },
      },
    );

    expect(event.systemPromptOptions.sections.maestro).toContain(
      'You are Maestro',
    );
    expect(event.systemPromptOptions.sections.foreign).toBe(
      'Keep foreign instructions',
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
    expect(notify).toHaveBeenCalledOnce();
    expect(setStatus).toHaveBeenLastCalledWith(MAESTRO_STATUS_KEY, undefined);
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
    expect(notify).toHaveBeenCalledTimes(2);
    expect(session.sessionManager.getEntries()).toEqual(
      entriesBeforeActivation,
    );
    expect(modelRequests).not.toHaveBeenCalled();

    modelRequests.mockImplementation(() => {
      throw new Error('Offline model context inspection.');
    });
    await session.prompt('Summarize the project');
    expect(modelRequests).toHaveBeenCalledOnce();
    const modelContext = JSON.stringify(modelRequests.mock.calls[0][1]);
    expect(modelContext).not.toContain('Builder (');
    expect(modelContext).not.toContain('Verifier (');
  });

  it('given explicit agent settings when Maestro activates then its notice shows the configured providers models and thinking levels', async () => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);
    await mkdir(join(repository.path, '.pi'));
    await writeFile(
      join(repository.path, '.pi', 'maestro.json'),
      JSON.stringify({
        version: SUPPORTED_CONFIG_VERSION,
        builder: {
          model: 'openai-codex/gpt-6.1-sol',
          thinking: THINKING_LEVELS.XHIGH,
        },
        verifier: {
          model: 'openai-codex/gpt-6.1-sol',
          thinking: THINKING_LEVELS.HIGH,
        },
      }),
    );

    const { session, notify } = await piTestSessions.create({
      extensions: [maestroExtension, successfulPingExtension],
      cwd: repository.path,
    });

    await session.prompt('/maestro');
    const theme = session.extensionRunner.createContext().ui.theme;

    expect(notify).toHaveBeenCalledExactlyOnceWith(
      [
        theme.fg('muted', 'Maestro active'),
        'Maestro helps the owner define a spec, then coordinates implementation and independent verification.',
        'Ask how Maestro works for a short explanation.',
        theme.fg('accent', 'Builder (openai-codex/gpt-6.1-sol xhigh)'),
        theme.fg('accent', 'Verifier (openai-codex/gpt-6.1-sol high)'),
      ].join('\n'),
      'info',
    );
  });

  it('given active Maestro when its agents become unavailable then turning off succeeds and the next activation fails', async () => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);

    const { session, events, notify } = await piTestSessions.create({
      extensions: [foreignExtension, maestroExtension],
      cwd: repository.path,
    });

    // simulate the ping response from pi-subagents
    const removeResponder = events.on(
      SUBAGENT_PING.REQUEST_EVENT,
      (payload) => {
        // JUSTIFICATION: Maestro emits this version 1 ping request.
        const request = payload as { requestId: string };
        events.emit(`${SUBAGENT_PING.REPLY_EVENT_PREFIX}${request.requestId}`, {
          version: SUBAGENT_PING.VERSION,
          requestId: request.requestId,
          method: SUBAGENT_PING.METHOD,
          success: true,
          data: { version: SUBAGENT_PING.VERSION },
        });
      },
    );

    await session.prompt('/maestro');
    expect(maestroSessionState.isActive()).toBe(true);
    removeResponder();
    const emit = vi.spyOn(events, 'emit');

    await writeFile(
      join(getAgentDir(), 'settings.json'),
      JSON.stringify({ packages: [] }),
    );
    await session.prompt('/maestro');
    expect(maestroSessionState.isActive()).toBe(false);
    expect(notify).toHaveBeenCalledOnce();
    expect(emit).not.toHaveBeenCalled();

    await session.prompt('/maestro');
    expect(maestroSessionState.isActive()).toBe(false);
    expect(session.getActiveToolNames()).toEqual(BASE_TOOLS);
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenLastCalledWith(
      expect.stringContaining(`Unknown agent: ${AGENTS.BUILDER}`),
      'error',
    );
  });

  it.each([
    {
      label: 'unsuccessful',
      reply: { success: false, error: { message: 'Unavailable' } },
    },
    { label: 'null', reply: null },
    { label: 'wrong envelope version', reply: { version: 2 } },
    { label: 'wrong method', reply: { method: 'status' } },
    { label: 'missing data', reply: { data: undefined } },
    { label: 'wrong data version', reply: { data: { version: 2 } } },
    { label: 'missing request ID', reply: { requestId: undefined } },
  ])(
    'given a $label matching reply when Maestro activates then it stays off with the installation error',
    async ({ reply }) => {
      const { session, events, notify } = await piTestSessions.create({
        extensions: [maestroExtension],
      });

      events.on(SUBAGENT_PING.REQUEST_EVENT, (payload) => {
        // JUSTIFICATION: Maestro emits this version 1 ping request.
        const request = payload as { requestId: string };
        events.emit(
          `${SUBAGENT_PING.REPLY_EVENT_PREFIX}${request.requestId}`,
          reply === null
            ? null
            : {
                version: SUBAGENT_PING.VERSION,
                requestId: request.requestId,
                method: SUBAGENT_PING.METHOD,
                success: true,
                data: { version: SUBAGENT_PING.VERSION },
                ...reply,
              },
        );
      });

      await session.prompt('/maestro');

      expect(maestroSessionState.isActive()).toBe(false);
      expect(notify).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining(SUBAGENT_PING.INSTALLATION_ERROR),
        'error',
      );
    },
  );

  it('given an emission error when Maestro sends its ping then activation stays off with the installation error', async () => {
    const { session, events, notify } = await piTestSessions.create({
      extensions: [maestroExtension],
    });

    const emit = events.emit.bind(events);
    vi.spyOn(events, 'emit').mockImplementation((channel, payload) => {
      if (channel === SUBAGENT_PING.REQUEST_EVENT) {
        throw new Error('Bus unavailable');
      }

      emit(channel, payload);
    });

    await session.prompt('/maestro');

    expect(maestroSessionState.isActive()).toBe(false);
    expect(notify).toHaveBeenCalledExactlyOnceWith(
      `${SUBAGENT_PING.INSTALLATION_ERROR} Bus unavailable`,
      'error',
    );
  });

  it('given a failed check when activation is retried then Maestro stays off and reports each error', async () => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);

    const { session, notify, setStatus, settingsManager } =
      await piTestSessions.create({
        extensions: [
          foreignExtension,
          maestroExtension,
          successfulPingExtension,
        ],
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
    expect(notify).toHaveBeenCalledTimes(3);
  });

  it('given an active spec when Maestro turns off then live state clears and files remain unchanged', async () => {
    const { paths, repository } = await createApprovedWorkflow();

    const { session, notify, setStatus, settingsManager } =
      await piTestSessions.create({
        extensions: [
          foreignExtension,
          maestroExtension,
          successfulPingExtension,
        ],
        cwd: repository.path,
      });

    await session.prompt('/maestro');
    const theme = session.extensionRunner.createContext().ui.theme;
    maestroSessionState.setActiveSpecId(SPEC_ID);
    const specPath = paths.getSpecFilePath(SPEC_ID);
    const spec = await readFile(specPath, 'utf8');
    const workflow = await readFile(paths.getWorkflowPath(SPEC_ID), 'utf8');

    const event = await session.extensionRunner.emitBeforeAgentStart(
      'Discuss the next change.',
      undefined,
      {
        cwd: session.extensionRunner.createContext().cwd,
        sections: { foreign: 'Keep foreign instructions' },
      },
    );

    session.setActiveToolsByName(['read', FOREIGN_TOOL, ...MAIN_TOOL_NAMES]);
    settingsManager.setProjectTrusted(false);
    await session.prompt('/maestro');

    const inactivePrompt = await session.extensionRunner.emitBeforeAgentStart(
      'Discuss the next change.',
      undefined,
      event.systemPromptOptions,
    );

    expect(maestroSessionState.isActive()).toBe(false);
    expect(maestroSessionState.getActiveSpecId()).toBeNull();
    expect(session.getActiveToolNames()).toEqual(['read', FOREIGN_TOOL]);
    expect(inactivePrompt.systemPromptOptions.sections).toEqual({
      foreign: 'Keep foreign instructions',
    });
    expect(setStatus).toHaveBeenLastCalledWith(MAESTRO_STATUS_KEY, undefined);
    expect(notify).toHaveBeenCalledOnce();
    expect(await readFile(specPath, 'utf8')).toBe(spec);
    expect(await readFile(paths.getWorkflowPath(SPEC_ID), 'utf8')).toBe(
      workflow,
    );

    settingsManager.setProjectTrusted(true);
    await session.prompt('/maestro');
    expect(maestroSessionState.isActive()).toBe(true);
    expect(maestroSessionState.getActiveSpecId()).toBeNull();
    expect(setStatus).toHaveBeenLastCalledWith(
      MAESTRO_STATUS_KEY,
      theme.fg('muted', 'Maestro active · ') +
        theme.fg('accent', 'No active spec'),
    );
    expect(session.getActiveToolNames()).toEqual([
      'read',
      FOREIGN_TOOL,
      ...MAIN_TOOL_NAMES,
    ]);
  });

  it('given an active workflow when a session resumes then Maestro stays off without recovering the workflow', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    const workflow = await readFile(paths.getWorkflowPath(SPEC_ID), 'utf8');

    const { session, notify, setStatus } = await piTestSessions.create({
      extensions: [foreignExtension, maestroExtension, successfulPingExtension],
      cwd: repository.path,
      sessionStartEvent: { type: 'session_start', reason: 'resume' },
      maestroAgentsAvailable: false,
    });

    expect(maestroSessionState.isActive()).toBe(false);
    expect(maestroSessionState.getActiveSpecId()).toBeNull();
    expect(session.getActiveToolNames()).toEqual(BASE_TOOLS);
    expect(notify).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenLastCalledWith(MAESTRO_STATUS_KEY, undefined);
    expect(await readFile(paths.getWorkflowPath(SPEC_ID), 'utf8')).toBe(
      workflow,
    );
  });

  it('given an approved spec when builder and verifier run then status follows running and completed phases without a final transition', async () => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);

    const { session, events, setStatus } = await piTestSessions.create({
      extensions: [foreignExtension, maestroExtension, successfulPingExtension],
      cwd: repository.path,
    });

    await session.prompt('/maestro');
    const theme = session.extensionRunner.createContext().ui.theme;

    const createSpecTool = session.agent.state.tools.find(
      (tool) => tool.name === CREATE_SPEC_TOOL.NAME,
    );

    assertToolRegistered(createSpecTool);

    const created = await createSpecTool.execute('test-call', {
      title: 'Add Weather Alerts',
    });

    await session.extensionRunner.emitToolResult({
      type: 'tool_result',
      toolName: CREATE_SPEC_TOOL.NAME,
      toolCallId: 'test-call',
      input: { title: 'Add Weather Alerts' },
      ...created,
      isError: false,
    });

    // JUSTIFICATION: The registered create-spec tool returns CreatedSpec details.
    const { specId, specPath, specFilePath, workflowPath } =
      created.details as CreatedSpec;

    expect(maestroSessionState.getActiveSpecId()).toBe(specId);
    expect(specPath).toBe(join(repository.path, '.specs', specId));
    expect(await readWorkflowState(workflowPath)).toMatchObject({ specId });
    expect(setStatus).toHaveBeenLastCalledWith(
      MAESTRO_STATUS_KEY,
      theme.fg('muted', `Maestro active · ${specId.slice(0, 26)}... · `) +
        '📝 ' +
        theme.fg('accent', 'Preparing specification'),
    );

    const approvedSpec = (
      await readFile(
        new URL(import.meta.resolve('#tests/fixtures/weather-alert-spec.md')),
        'utf8',
      )
    ).replace('<id>', specId);

    await writeFile(specFilePath, approvedSpec);

    const markSpecReadyTool = session.agent.state.tools.find(
      (tool) => tool.name === MARK_SPEC_READY_TOOL.NAME,
    );

    assertToolRegistered(markSpecReadyTool);
    const approved = await markSpecReadyTool.execute('test-call', { specId });
    await session.extensionRunner.emitToolResult({
      type: 'tool_result',
      toolName: MARK_SPEC_READY_TOOL.NAME,
      toolCallId: 'test-call',
      input: { specId },
      ...approved,
      isError: false,
    });

    expect(approved.details).toMatchObject({
      phase: WORKFLOW_PHASES.READY_FOR_BUILDER,
    });
    expect(setStatus).toHaveBeenLastCalledWith(
      MAESTRO_STATUS_KEY,
      theme.fg('muted', `Maestro active · ${specId.slice(0, 26)}... · `) +
        '🚧 ' +
        theme.fg('accent', 'Ready for builder'),
    );

    const productPath = join(repository.path, 'alert.txt');
    const productContents = 'Weather alerts enabled\n';

    const acceptanceCriteria = [
      {
        id: 'AC1',
        probe: 'Read alert.txt and compare it with Weather alerts enabled\\n.',
        probeStatus: PROBE_STATUSES.PASSED,
      },
    ];

    const requests: SubagentDelegationRequest[] = [];

    // Script only the AI work and completion response. Pi sessions, tools, and file operations are real.
    events.on(SUBAGENT_DELEGATION_REQUEST_EVENT, async (payload) => {
      // JUSTIFICATION: The registered run tools emit delegation requests on this channel.
      const request = payload as SubagentDelegationRequest;
      requests.push(request);

      try {
        const runningPhase =
          request.agent === AGENTS.BUILDER
            ? WORKFLOW_PHASES.BUILDER_RUNNING
            : WORKFLOW_PHASES.VERIFIER_RUNNING;

        const runningIcon = request.agent === AGENTS.BUILDER ? '🛠️' : '🔍';

        const runningLabel =
          request.agent === AGENTS.BUILDER
            ? 'Builder running'
            : 'Verifier running';

        await expect(readWorkflowState(workflowPath)).resolves.toMatchObject({
          phase: runningPhase,
        });
        expect(setStatus).toHaveBeenLastCalledWith(
          MAESTRO_STATUS_KEY,
          theme.fg('muted', `Maestro active · ${specId.slice(0, 26)}... · `) +
            `${runningIcon} ` +
            theme.fg('accent', runningLabel),
        );

        const { session: child } = await piTestSessions.create({
          cwd: request.cwd,
          extensions: [maestroSubagentExtension],
        });

        expect([AGENTS.BUILDER, AGENTS.VERIFIER]).toContain(request.agent);

        if (request.agent === AGENTS.BUILDER) {
          await writeFile(productPath, productContents);
        }

        const toolName =
          request.agent === AGENTS.BUILDER
            ? BUILDER_HANDOFF_TOOL.NAME
            : VERIFIER_HANDOFF_TOOL.NAME;

        const tool = child.agent.state.tools.find(
          (tool) => tool.name === toolName,
        );

        assertToolRegistered(tool);

        const handoffResult = await tool.execute(request.requestId, {
          specId,
          summary: 'The weather alert message passed the probe.',
          acceptanceCriteria,
          notes: [],
          ...(request.agent === AGENTS.BUILDER
            ? { status: BUILDER_HANDOFF_STATUSES.DONE, escalations: [] }
            : { findings: [] }),
        });

        expect(handoffResult.details).toMatchObject({
          specId,
          phase:
            request.agent === AGENTS.BUILDER
              ? WORKFLOW_PHASES.READY_FOR_VERIFIER
              : WORKFLOW_PHASES.CANDIDATE_READY,
        });

        events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
          requestId: request.requestId,
          ownerRunId: request.ownerRunId,
          nodeId: request.nodeId,
          status: DELEGATION_STATUSES.COMPLETED,
          result: { kind: 'text', text: 'The scripted child work finished.' },
        });
      } catch (error) {
        events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
          requestId: request.requestId,
          ownerRunId: request.ownerRunId,
          nodeId: request.nodeId,
          status: DELEGATION_STATUSES.FAILED,
          error: String(error),
        });
      }
    });

    const runBuilderTool = session.agent.state.tools.find(
      (tool) => tool.name === RUN_BUILDER_TOOL.NAME,
    );

    assertToolRegistered(runBuilderTool);
    const built = await runBuilderTool.execute('test-call', { specId });
    await session.extensionRunner.emitToolResult({
      type: 'tool_result',
      toolName: RUN_BUILDER_TOOL.NAME,
      toolCallId: 'test-call',
      input: { specId },
      ...built,
      isError: false,
    });

    expect(built.details).toMatchObject({
      specId,
      phase: WORKFLOW_PHASES.READY_FOR_VERIFIER,
      handoff: {
        specId,
        acceptanceCriteria,
        status: BUILDER_HANDOFF_STATUSES.DONE,
        escalations: [],
      },
    });
    expect(setStatus).toHaveBeenLastCalledWith(
      MAESTRO_STATUS_KEY,
      theme.fg('muted', `Maestro active · ${specId.slice(0, 26)}... · `) +
        '📋 ' +
        theme.fg('accent', 'Ready for verifier'),
    );

    const runVerifierTool = session.agent.state.tools.find(
      (tool) => tool.name === RUN_VERIFIER_TOOL.NAME,
    );

    assertToolRegistered(runVerifierTool);
    const verified = await runVerifierTool.execute('test-call', { specId });
    await session.extensionRunner.emitToolResult({
      type: 'tool_result',
      toolName: RUN_VERIFIER_TOOL.NAME,
      toolCallId: 'test-call',
      input: { specId },
      ...verified,
      isError: false,
    });

    expect(verified.details).toMatchObject({
      specId,
      phase: WORKFLOW_PHASES.CANDIDATE_READY,
      handoff: { specId, acceptanceCriteria, findings: [] },
    });
    expect(requests).toMatchObject([
      {
        agent: AGENTS.BUILDER,
        cwd: repository.path,
        context: 'fresh',
        task: expect.stringContaining(specId),
      },
      {
        agent: AGENTS.VERIFIER,
        cwd: repository.path,
        context: 'fresh',
        task: expect.stringContaining(specId),
      },
    ]);
    expect(setStatus).toHaveBeenLastCalledWith(
      MAESTRO_STATUS_KEY,
      theme.fg('muted', `Maestro active · ${specId.slice(0, 26)}... · `) +
        '✅ ' +
        theme.fg('success', 'Completed'),
    );

    const state = await readWorkflowState(workflowPath);
    expect(state).toMatchObject({
      specId,
      phase: WORKFLOW_PHASES.CANDIDATE_READY,
    });

    const verifierHandoffPath = join(
      specPath,
      'handoffs',
      'verifier',
      'V1.json',
    );

    expect(
      await readVerifierHandoff({
        path: verifierHandoffPath,
        specId,
      }),
    ).toMatchObject({ specId });
    expect(await readFile(specFilePath, 'utf8')).toBe(approvedSpec);
    expect(await readFile(productPath, 'utf8')).toBe(productContents);

    const event = await session.extensionRunner.emitBeforeAgentStart(
      'Discuss the next change.',
      undefined,
      {
        cwd: session.extensionRunner.createContext().cwd,
        sections: { foreign: 'Keep foreign instructions' },
      },
    );

    expect(event.systemPromptOptions.sections.maestro).toContain(
      'You own the final summary.',
    );
    expect(event.systemPromptOptions.sections.maestro).toContain(
      'No final tool call is required.',
    );
  });

  type PrepareSpecRevisionPhaseInput = {
    paths: MaestroPaths;
    current: WorkflowState;
    phase: WorkflowState['phase'];
  };

  const prepareSpecRevisionPhase = async ({
    paths,
    current,
    phase,
  }: PrepareSpecRevisionPhaseInput): Promise<void> => {
    if (phase === WORKFLOW_PHASES.ESCALATION_DECISION) {
      await prepareBuilderRun({ paths, specId: SPEC_ID });
      await completeBuilderPass({
        paths,
        specId: SPEC_ID,
        handoff: unavailableCompilerEscalation,
      });

      return;
    }

    // phase === WORKFLOW_PHASES.FINDINGS_DECISION
    await writeWorkflowState({
      path: paths.getWorkflowPath(SPEC_ID),
      state: { ...current, phase },
    });
  };

  it.each([
    WORKFLOW_PHASES.ESCALATION_DECISION,
    WORKFLOW_PHASES.FINDINGS_DECISION,
  ])(
    'given %s when the owner follows the revision route and approves then the registered tools return ready-for-builder on the same project',
    async (phase) => {
      const { paths, repository } = await createApprovedWorkflow();

      const current = await readWorkflowState(paths.getWorkflowPath(SPEC_ID));

      await prepareSpecRevisionPhase({ paths, current, phase });

      const { session, setStatus } = await piTestSessions.create({
        extensions: [
          foreignExtension,
          maestroExtension,
          successfulPingExtension,
        ],
        cwd: repository.path,
      });

      await session.prompt('/maestro');
      const theme = session.extensionRunner.createContext().ui.theme;
      maestroSessionState.setActiveSpecId(SPEC_ID);

      if (phase === WORKFLOW_PHASES.ESCALATION_DECISION) {
        const resolveTool = session.agent.state.tools.find(
          (tool) => tool.name === RESOLVE_ESCALATIONS_TOOL.NAME,
        );

        assertToolRegistered(resolveTool);

        const resolution = await resolveTool.execute('revision-decision', {
          specId: SPEC_ID,
          specChangeRequired: true,
          decisions: [
            {
              escalationId: 'E1',
              selectedOptionId: null,
              decision:
                'Revise the spec to use a local check instead of the unavailable compiler',
              reason: 'The required compiler cannot run in this environment',
            },
          ],
        });

        expect(resolution.details).toMatchObject({
          specId: SPEC_ID,
          phase: WORKFLOW_PHASES.DRAFTING_SPEC,
        });
        await expect(
          readWorkflowState(paths.getWorkflowPath(SPEC_ID)),
        ).resolves.toMatchObject({ phase: WORKFLOW_PHASES.DRAFTING_SPEC });
      }

      await writeFile(
        paths.getSpecFilePath(SPEC_ID),
        '# Owner-approved revised contract\nUse a local check instead of the unavailable compiler.\n',
        'utf8',
      );

      const markSpecReadyTool = session.agent.state.tools.find(
        (tool) => tool.name === MARK_SPEC_READY_TOOL.NAME,
      );

      assertToolRegistered(markSpecReadyTool);

      const result = await markSpecReadyTool.execute('test-call', {
        specId: SPEC_ID,
      });

      await session.extensionRunner.emitToolResult({
        type: 'tool_result',
        toolName: MARK_SPEC_READY_TOOL.NAME,
        toolCallId: 'test-call',
        input: { specId: SPEC_ID },
        ...result,
        isError: false,
      });

      expect(result.details).toEqual({
        ...current,
        phase: WORKFLOW_PHASES.READY_FOR_BUILDER,
      });
      await expect(
        readWorkflowState(paths.getWorkflowPath(SPEC_ID)),
      ).resolves.toEqual(result.details);
      expect(setStatus).toHaveBeenLastCalledWith(
        MAESTRO_STATUS_KEY,
        theme.fg('muted', `Maestro active · ${SPEC_ID.slice(0, 26)}... · `) +
          '🚧 ' +
          theme.fg('accent', 'Ready for builder'),
      );
    },
  );

  it('given a saved technical-problem escalation when the registered run tool returns then the owner receives the problem and status updates', async () => {
    const { paths, repository } = await createApprovedWorkflow();

    const { session, events, setStatus } = await piTestSessions.create({
      extensions: [foreignExtension, maestroExtension, successfulPingExtension],
      cwd: repository.path,
    });

    await session.prompt('/maestro');
    const theme = session.extensionRunner.createContext().ui.theme;
    maestroSessionState.setActiveSpecId(SPEC_ID);
    const requests: SubagentDelegationRequest[] = [];
    events.on(SUBAGENT_DELEGATION_REQUEST_EVENT, async (payload) => {
      // JUSTIFICATION: This listener receives the request emitted by the registered run tool.
      const request = payload as SubagentDelegationRequest;
      requests.push(request);

      try {
        await completeBuilderPass({
          paths,
          specId: SPEC_ID,
          handoff: unavailableCompilerEscalation,
        });

        events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
          requestId: request.requestId,
          ownerRunId: request.ownerRunId,
          nodeId: request.nodeId,
          status: DELEGATION_STATUSES.COMPLETED,
          result: {
            kind: 'text',
            text: 'The builder escalated the compiler problem.',
          },
        });
      } catch (error) {
        events.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
          requestId: request.requestId,
          ownerRunId: request.ownerRunId,
          nodeId: request.nodeId,
          status: DELEGATION_STATUSES.FAILED,
          error: String(error),
        });
      }
    });

    const runBuilderTool = session.agent.state.tools.find(
      (tool) => tool.name === RUN_BUILDER_TOOL.NAME,
    );

    assertToolRegistered(runBuilderTool);

    const result = await runBuilderTool.execute('test-call', {
      specId: SPEC_ID,
    });

    await session.extensionRunner.emitToolResult({
      type: 'tool_result',
      toolName: RUN_BUILDER_TOOL.NAME,
      toolCallId: 'test-call',
      input: { specId: SPEC_ID },
      ...result,
      isError: false,
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      cwd: repository.path,
      context: 'fresh',
    });
    expect(result.details).toMatchObject({
      outcome: BUILDER_HANDOFF_STATUSES.ESCALATION,
      phase: WORKFLOW_PHASES.ESCALATION_DECISION,
      handoff: {
        ...unavailableCompilerEscalation,
        version: '1.0.0',
        specId: SPEC_ID,
      },
    });
    expect(result.content).toEqual([
      {
        type: 'text',
        text: expect.stringContaining('waiting for an owner decision'),
      },
    ]);
    expect(setStatus).toHaveBeenLastCalledWith(
      MAESTRO_STATUS_KEY,
      theme.fg('muted', `Maestro active · ${SPEC_ID.slice(0, 26)}... · `) +
        '✋ ' +
        theme.fg('warning', 'Owner decision needed: escalation'),
    );
  });

  it('given a missing active workflow when status refreshes then it reports an error without blocking instructions', async () => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);

    const { session, notify, setStatus } = await piTestSessions.create({
      extensions: [foreignExtension, maestroExtension, successfulPingExtension],
      cwd: repository.path,
    });

    await session.prompt('/maestro');
    maestroSessionState.setActiveSpecId(SPEC_ID);

    const event = await session.extensionRunner.emitBeforeAgentStart(
      'Discuss the next change.',
      undefined,
      {
        cwd: session.extensionRunner.createContext().cwd,
        sections: { foreign: 'Keep foreign instructions' },
      },
    );

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
