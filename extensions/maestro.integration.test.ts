/**
 * Objective: Check main Maestro registration and the current-checkout workflow.
 * Used: In integration tests with real Pi sessions and scripted child work.
 */

import { execFile } from 'node:child_process';
import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { type AssistantMessage, createAssistantMessageEventStream } from '@earendil-works/pi-ai';
import type { ExtensionAPI, wrapRegisteredTool } from '@earendil-works/pi-coding-agent';
import { createAgentSession, SessionManager } from '@earendil-works/pi-coding-agent';
import { stripTerminalSequences } from '@earendil-works/pi-tui';
import { Type } from 'typebox';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BUILDER_HANDOFF_STATUSES, PROBE_STATUSES } from '#artifacts/builder-handoff/schema.ts';
import { readSimplifierHandoff } from '#artifacts/simplifier-handoff/readSimplifierHandoff.ts';
import { readVerifierHandoff } from '#artifacts/verifier-handoff/readVerifierHandoff.ts';
import {
  FINDING_DECISIONS,
  FINDING_SEVERITIES,
  VERIFIER_HANDOFF_VERSION,
} from '#artifacts/verifier-handoff/schema.ts';
import { loadConfiguration } from '#config/loadConfiguration.ts';
import { saveConfiguration } from '#config/saveConfiguration.ts';
import { SUPPORTED_CONFIG_VERSION, THINKING_LEVELS } from '#config/schema.ts';
import maestroExtension from '#extensions/maestro.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import { MAESTRO_STATUS_KEY } from '#maestro/status/refreshMaestroStatus.ts';
import type { MaestroPaths } from '#MaestroPaths.ts';
import type { CreatedSpec } from '#specs/create.ts';
import { executeTask, type ExecuteTaskInput } from '#src/delegation/executeTask.ts';
import { prepareSubagentEnvironment } from '#src/delegation/prepareSubagentEnvironment.ts';
import { TEST_CONFIG } from '#tests/fixtures/config/selected-agents.ts';
import { unavailableCompilerEscalation } from '#tests/fixtures/unavailable-compiler-escalation.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  doneHandoff,
  SPEC_ID,
} from '#tests/support/builder-workflow.ts';
import piTestSessions from '#tests/support/pi-session.ts';
import { createTemporaryProject } from '#tests/support/temp-repository.ts';
import { BUILDER_HANDOFF_TOOL } from '#tools/child/record-builder-handoff.ts';
import { SIMPLIFIER_HANDOFF_TOOL } from '#tools/child/record-simplifier-handoff.ts';
import { VERIFIER_HANDOFF_TOOL } from '#tools/child/record-verifier-handoff.ts';
import { CREATE_SPEC_TOOL } from '#tools/main/create-spec.ts';
import { MARK_SPEC_READY_TOOL } from '#tools/main/mark-spec-ready.ts';
import { RESOLVE_ESCALATIONS_TOOL } from '#tools/main/resolve-escalations.ts';
import { RESOLVE_FINDINGS_TOOL } from '#tools/main/resolve-findings.ts';
import { RUN_BUILDER_TOOL } from '#tools/main/run-builder.ts';
import { RUN_SIMPLIFIER_TOOL } from '#tools/main/run-simplifier.ts';
import { RUN_VERIFIER_TOOL } from '#tools/main/run-verifier.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { prepareBuilderRun } from '#workflow/builder/prepareBuilderRun.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_EVENTS, WORKFLOW_PHASES, type WorkflowState } from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';
import { transitionWorkflow } from '#workflow/transitions.ts';
import { completeVerifierPass } from '#workflow/verifier/completeVerifierPass.ts';
import { prepareVerifierRun } from '#workflow/verifier/prepareVerifierRun.ts';

vi.mock('#src/delegation/executeTask.ts', () => ({ executeTask: vi.fn<typeof executeTask>() }));

const execFileAsync = promisify(execFile);

const FOREIGN_TOOL = 'foreign_tool';

const MAIN_TOOL_NAMES = [
  CREATE_SPEC_TOOL.NAME,
  MARK_SPEC_READY_TOOL.NAME,
  RUN_BUILDER_TOOL.NAME,
  RESOLVE_ESCALATIONS_TOOL.NAME,
  RUN_VERIFIER_TOOL.NAME,
  RESOLVE_FINDINGS_TOOL.NAME,
  RUN_SIMPLIFIER_TOOL.NAME,
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

function assertToolRegistered(tool: RegisteredTool | undefined): asserts tool is RegisteredTool {
  if (tool === undefined) throw new Error('The tool is not active in Pi.');
}

const cleanupFunctions: Array<() => Promise<void>> = [];

afterEach(async () => {
  vi.mocked(executeTask).mockReset();
  vi.useRealTimers();
  await piTestSessions.cleanup();
  await cleanupBuilderWorkflows();
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
});

describe('spec restart activation', () => {
  it('given two existing specs when the owner chooses restart then both IDs are offered for selection', async () => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);
    await saveConfiguration({ cwd: repository.path, agentModelSelections: {} });
    const ids = ['20261101-100000-add-search', '20261102-100000-add-filter'];

    for (const id of ids) await mkdir(join(repository.path, '.specs', id), { recursive: true });

    const { session } = await piTestSessions.create({
      cwd: repository.path,
      extensions: [maestroExtension],
    });

    const ui = { ...session.extensionRunner.getUIContext() };

    const select = vi
      .spyOn(ui, 'select')
      .mockResolvedValueOnce('Restart spec')
      .mockResolvedValueOnce(undefined);

    session.extensionRunner.setUIContext(ui, 'tui');
    await session.prompt('/maestro');
    expect(select.mock.calls.map(([title, choices]) => [title, choices])).toEqual([
      ['Start Maestro workflow', ['New spec', 'Restart spec']],
      ['Restart spec', ids],
    ]);
    expect(maestroSessionState.isActive()).toBe(false);
  });

  it.each(Object.values(WORKFLOW_PHASES))(
    'given a saved %s spec when the owner restarts it then the same spec is active in saved drafting-spec',
    async (phase) => {
      const { paths, repository } = await createApprovedWorkflow();
      const workflowPath = paths.getWorkflowPath(SPEC_ID);
      await writeWorkflowState({
        path: workflowPath,
        state: { version: '1.0.0', specId: SPEC_ID, phase },
      });
      const directories = await readdir(paths.getSpecDirectory());

      const { session } = await piTestSessions.create({
        cwd: repository.path,
        extensions: [maestroExtension],
      });

      const ui = { ...session.extensionRunner.getUIContext() };
      vi.spyOn(ui, 'select').mockResolvedValueOnce('Restart spec').mockResolvedValueOnce(SPEC_ID);
      session.extensionRunner.setUIContext(ui, 'tui');
      await session.prompt('/maestro');
      expect(maestroSessionState.isActive()).toBe(true);
      expect(maestroSessionState.getActiveSpecId()).toBe(SPEC_ID);
      expect(await readWorkflowState(workflowPath)).toEqual({
        version: '1.0.0',
        specId: SPEC_ID,
        phase: WORKFLOW_PHASES.DRAFTING_SPEC,
      });
      expect(await readdir(paths.getSpecDirectory())).toEqual(directories);
    },
  );

  it.each(['empty', 'absent'])(
    'given an %s configured spec directory when activation is requested then Maestro activates without a choice or spec creation',
    async (directory) => {
      const repository = await createTemporaryProject();
      cleanupFunctions.push(repository.cleanup);
      await saveConfiguration({ cwd: repository.path, agentModelSelections: {} });

      if (directory === 'empty') await mkdir(join(repository.path, '.specs'));

      const { session } = await piTestSessions.create({
        cwd: repository.path,
        extensions: [maestroExtension],
      });

      const ui = { ...session.extensionRunner.getUIContext() };
      const select = vi.spyOn(ui, 'select');
      session.extensionRunner.setUIContext(ui, 'tui');
      await session.prompt('/maestro');
      expect(select).not.toHaveBeenCalled();
      expect(maestroSessionState.isActive()).toBe(true);
      expect(maestroSessionState.getActiveSpecId()).toBeNull();

      const entries = await readdir(join(repository.path, '.specs')).catch(
        (error: NodeJS.ErrnoException) => error.code,
      );

      expect(entries).toEqual(directory === 'empty' ? [] : 'ENOENT');
    },
  );
});

describe('main Maestro extension', () => {
  it('given a new Pi session when Maestro loads then its tools register once but stay inactive, with no notice, status, or added instructions', async () => {
    const { session, notify, setStatus } = await piTestSessions.create({
      extensions: [foreignExtension, maestroExtension],
    });

    expect(
      session.extensionRunner.getAllRegisteredTools().map(({ definition }) => definition.name),
    ).toEqual([FOREIGN_TOOL, ...MAIN_TOOL_NAMES]);
    expect(session.getActiveToolNames()).toEqual(BASE_TOOLS);
    expect(maestroSessionState.isActive()).toBe(false);
    expect(notify).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenLastCalledWith(MAESTRO_STATUS_KEY, undefined);

    const event = await session.extensionRunner.emitBeforeAgentStart(
      { messageType: 'user', prompt: 'Discuss the next change.' },
      {
        cwd: session.extensionRunner.createContext().cwd,
        sections: { foreign: 'Keep foreign instructions' },
      },
    );

    expect(event.systemPromptOptions.sections).toEqual({
      foreign: 'Keep foreign instructions',
    });
  });

  it('given valid activation checks when Maestro is enabled and later re-enabled then its tools, instructions, and status are available without duplicate registration, automatic model calls, or new session history', async () => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);

    const { session, notify, setStatus } = await piTestSessions.create({
      extensions: [foreignExtension, maestroExtension],
      cwd: repository.path,
    });

    await saveConfiguration({
      cwd: repository.path,
      agentModelSelections: {
        builder: TEST_CONFIG.builder,
        verifier: TEST_CONFIG.verifier,
        simplifier: TEST_CONFIG.simplifier,
      },
    });
    const entriesBeforeActivation = session.sessionManager.getEntries();
    const modelRequests = vi.spyOn(session.agent, 'streamFunction');

    await session.prompt('/maestro');
    const theme = session.extensionRunner.createContext().ui.theme;

    expect(modelRequests).not.toHaveBeenCalled();
    expect(session.sessionManager.getEntries()).toEqual(entriesBeforeActivation);
    expect(maestroSessionState.isActive()).toBe(true);
    expect(session.getActiveToolNames()).toEqual([...BASE_TOOLS, ...MAIN_TOOL_NAMES]);
    expect(setStatus).toHaveBeenLastCalledWith(
      MAESTRO_STATUS_KEY,
      theme.fg('muted', 'Maestro active · ') + theme.fg('accent', 'No active spec'),
    );
    expect(notify).toHaveBeenCalledOnce();
    expect(notify.mock.calls[0][1]).toBe('info');
    expect(stripTerminalSequences(notify.mock.calls[0][0])).toBe(
      `Maestro active\nMaestro helps the owner define a spec, then coordinates implementation and independent verification.\nAsk how Maestro works for a short explanation.\nBuilder (${TEST_CONFIG.builder.model} ${TEST_CONFIG.builder.thinking})\nVerifier (${TEST_CONFIG.verifier.model} ${TEST_CONFIG.verifier.thinking})\nSimplifier (${TEST_CONFIG.simplifier.model} ${TEST_CONFIG.simplifier.thinking})`,
    );

    const event = await session.extensionRunner.emitBeforeAgentStart(
      { messageType: 'user', prompt: 'Discuss the next change.' },
      {
        cwd: session.extensionRunner.createContext().cwd,
        sections: { foreign: 'Keep foreign instructions' },
      },
    );

    expect(event.systemPromptOptions.sections.maestro).toContain('You are Maestro');
    expect(event.systemPromptOptions.sections.maestro).toContain(
      'Always identify every skipped phase and why. Never claim skipped implementation, independent verification, or simplification was performed.',
    );
    expect(event.systemPromptOptions.sections.maestro).toContain(
      'Do not require handoffs for skipped phases.',
    );
    expect(event.systemPromptOptions.sections.foreign).toBe('Keep foreign instructions');

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
    expect(session.getActiveToolNames()).toEqual([...BASE_TOOLS, ...MAIN_TOOL_NAMES]);
    expect(
      session.extensionRunner.getAllRegisteredTools().map(({ definition }) => definition.name),
    ).toEqual([FOREIGN_TOOL, ...MAIN_TOOL_NAMES]);
    expect(notify).toHaveBeenCalledTimes(2);
    expect(session.sessionManager.getEntries()).toEqual(entriesBeforeActivation);
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

  it('given custom agent configuration when Maestro is enabled then the activation notice lists the provider, model, and thinking level for each agent', async () => {
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
        simplifier: { model: TEST_CONFIG.simplifier.model, thinking: THINKING_LEVELS.MEDIUM },
      }),
    );

    const { session, notify } = await piTestSessions.create({
      extensions: [maestroExtension],
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
        theme.fg('accent', 'Simplifier (openai-codex/gpt-6.1-sol medium)'),
      ].join('\n'),
      'info',
    );
  });

  it.each([
    {
      scenario: 'builder only',
      builder: true,
      verifier: false,
      simplifier: false,
      expectedAgents: [`Builder (${TEST_CONFIG.builder.model} ${TEST_CONFIG.builder.thinking})`],
    },
    {
      scenario: 'builder and verifier',
      builder: true,
      verifier: true,
      simplifier: false,
      expectedAgents: [
        `Builder (${TEST_CONFIG.builder.model} ${TEST_CONFIG.builder.thinking})`,
        `Verifier (${TEST_CONFIG.verifier.model} ${TEST_CONFIG.verifier.thinking})`,
      ],
    },
    {
      scenario: 'builder and simplifier',
      builder: true,
      verifier: false,
      simplifier: true,
      expectedAgents: [
        `Builder (${TEST_CONFIG.builder.model} ${TEST_CONFIG.builder.thinking})`,
        `Simplifier (${TEST_CONFIG.simplifier.model} ${TEST_CONFIG.simplifier.thinking})`,
      ],
    },
    {
      scenario: 'builder disabled despite enabled later phases',
      builder: false,
      verifier: true,
      simplifier: true,
      expectedAgents: [],
    },
  ])(
    'given $scenario when Maestro is activated then the notice lists only enabled agents',
    async ({ builder, verifier, simplifier, expectedAgents }) => {
      const repository = await createTemporaryProject();
      cleanupFunctions.push(repository.cleanup);
      await mkdir(join(repository.path, '.pi'));
      await writeFile(
        join(repository.path, '.pi/maestro.json'),
        JSON.stringify({
          version: SUPPORTED_CONFIG_VERSION,
          builder: { ...TEST_CONFIG.builder, required: builder },
          verifier: { ...TEST_CONFIG.verifier, required: verifier },
          simplifier: { ...TEST_CONFIG.simplifier, required: simplifier },
        }),
      );

      const { session, notify } = await piTestSessions.create({
        cwd: repository.path,
        extensions: [maestroExtension],
      });

      await session.prompt('/maestro');

      expect(notify).toHaveBeenCalledOnce();
      expect(notify.mock.calls[0][1]).toBe('info');
      expect(stripTerminalSequences(notify.mock.calls[0][0]).split('\n').slice(3)).toEqual(
        expectedAgents,
      );
    },
  );

  it('given an unavailable simplifier model when activation is requested then Maestro stays disabled and reports which model is unavailable', async () => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);
    await mkdir(join(repository.path, '.pi'));
    await writeFile(
      join(repository.path, '.pi/maestro.json'),
      JSON.stringify({
        ...TEST_CONFIG,
        simplifier: { model: 'openai-codex/missing' },
      }),
    );

    const { session, notify } = await piTestSessions.create({
      cwd: repository.path,
      extensions: [maestroExtension],
    });

    await session.prompt('/maestro');
    expect(maestroSessionState.isActive()).toBe(false);
    expect(notify).toHaveBeenCalledExactlyOnceWith(
      'Configured model is not available: "openai-codex/missing".',
      'error',
    );
  });

  it('given an untrusted project with valid configuration when activation is requested then Maestro activates without requiring project trust', async () => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);
    await saveConfiguration({
      cwd: repository.path,
      agentModelSelections: {
        builder: TEST_CONFIG.builder,
        verifier: TEST_CONFIG.verifier,
        simplifier: TEST_CONFIG.simplifier,
      },
    });

    const { session, notify } = await piTestSessions.create({
      extensions: [foreignExtension, maestroExtension],
      cwd: repository.path,
      projectTrusted: false,
    });

    await session.prompt('/maestro');

    expect(maestroSessionState.isActive()).toBe(true);
    expect(session.getActiveToolNames()).toEqual([...BASE_TOOLS, ...MAIN_TOOL_NAMES]);
    expect(notify).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining('Maestro active'),
      'info',
    );
  });

  it('given Maestro has an active spec when it is disabled and enabled again then saved files stay unchanged and the previous spec is no longer active', async () => {
    const { paths, repository } = await createApprovedWorkflow();

    const { session, notify, setStatus, settingsManager } = await piTestSessions.create({
      extensions: [foreignExtension, maestroExtension],
      cwd: repository.path,
    });

    const ui = { ...session.extensionRunner.getUIContext() };
    vi.spyOn(ui, 'select').mockResolvedValue('New spec');
    session.extensionRunner.setUIContext(ui, 'tui');
    await session.prompt('/maestro');
    const theme = session.extensionRunner.createContext().ui.theme;
    maestroSessionState.setActiveSpecId(SPEC_ID);
    const specPath = paths.getSpecFilePath(SPEC_ID);
    const spec = await readFile(specPath, 'utf8');
    const workflow = await readFile(paths.getWorkflowPath(SPEC_ID), 'utf8');

    const event = await session.extensionRunner.emitBeforeAgentStart(
      { messageType: 'user', prompt: 'Discuss the next change.' },
      {
        cwd: session.extensionRunner.createContext().cwd,
        sections: { foreign: 'Keep foreign instructions' },
      },
    );

    session.setActiveToolsByName(['read', FOREIGN_TOOL, ...MAIN_TOOL_NAMES]);
    settingsManager.setProjectTrusted(false);
    await session.prompt('/maestro');

    const inactivePrompt = await session.extensionRunner.emitBeforeAgentStart(
      { messageType: 'user', prompt: 'Discuss the next change.' },
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
    expect(await readFile(paths.getWorkflowPath(SPEC_ID), 'utf8')).toBe(workflow);

    settingsManager.setProjectTrusted(true);
    await session.prompt('/maestro');
    expect(maestroSessionState.isActive()).toBe(true);
    expect(maestroSessionState.getActiveSpecId()).toBeNull();
    expect(setStatus).toHaveBeenLastCalledWith(
      MAESTRO_STATUS_KEY,
      theme.fg('muted', 'Maestro active · ') + theme.fg('accent', 'No active spec'),
    );
    expect(session.getActiveToolNames()).toEqual(['read', FOREIGN_TOOL, ...MAIN_TOOL_NAMES]);
  });

  it('given a saved workflow when Pi resumes the session then Maestro stays disabled, leaves the workflow unchanged, and does not select an active spec', async () => {
    const { paths, repository } = await createApprovedWorkflow();
    const workflow = await readFile(paths.getWorkflowPath(SPEC_ID), 'utf8');

    const { session, notify, setStatus } = await piTestSessions.create({
      extensions: [foreignExtension, maestroExtension],
      cwd: repository.path,
      sessionStartEvent: { type: 'session_start', reason: 'resume' },
    });

    expect(maestroSessionState.isActive()).toBe(false);
    expect(maestroSessionState.getActiveSpecId()).toBeNull();
    expect(session.getActiveToolNames()).toEqual(BASE_TOOLS);
    expect(notify).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenLastCalledWith(MAESTRO_STATUS_KEY, undefined);
    expect(await readFile(paths.getWorkflowPath(SPEC_ID), 'utf8')).toBe(workflow);
  });

  it('given an approved proposal, nested-criteria spec, and design in Git when builder, verifier, and simplifier finish then the workflow ends at candidate-ready with saved reports and unchanged approved documents', async () => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);
    await execFileAsync('git', ['init', '-q', repository.path]);
    await saveConfiguration({
      cwd: repository.path,
      agentModelSelections: {
        builder: TEST_CONFIG.builder,
        verifier: TEST_CONFIG.verifier,
        simplifier: TEST_CONFIG.simplifier,
      },
    });

    const { session, setStatus } = await piTestSessions.create({
      extensions: [foreignExtension, maestroExtension],
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
    const { specId, specPath, proposalFilePath, specFilePath, designFilePath, workflowPath } =
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
      await readFile(new URL(import.meta.resolve('#tests/fixtures/weather-alert-spec.md')), 'utf8')
    ).replace('<id>', specId);

    const approvedProposal = (
      await readFile(
        new URL(import.meta.resolve('#tests/fixtures/weather-alert-proposal.md')),
        'utf8',
      )
    ).replace('<id>', specId);

    const approvedDesign = (
      await readFile(
        new URL(import.meta.resolve('#tests/fixtures/weather-alert-design.md')),
        'utf8',
      )
    ).replace('<id>', specId);

    await writeFile(proposalFilePath, approvedProposal);
    await writeFile(specFilePath, approvedSpec);
    await writeFile(designFilePath, approvedDesign);

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

    const acceptanceCriteria = [
      {
        id: 'AC1',
        probe: 'Read alert.txt and compare it with Weather alerts enabled\\n.',
        probeStatus: PROBE_STATUSES.PASSED,
      },
    ];

    const scriptedRuns = [
      {
        heading: '# Builder',
        runningPhase: WORKFLOW_PHASES.BUILDER_RUNNING,
        statusIcon: '🛠️',
        statusLabel: 'Builder running',
        handoffToolName: BUILDER_HANDOFF_TOOL.NAME,
        handoff: {
          specId,
          status: BUILDER_HANDOFF_STATUSES.DONE,
          summary: 'The weather alert message passed the probe.',
          acceptanceCriteria,
          escalations: [],
          notes: [],
        },
      },
      {
        heading: '# Verifier',
        runningPhase: WORKFLOW_PHASES.VERIFIER_RUNNING,
        statusIcon: '🔍',
        statusLabel: 'Verifier running',
        handoffToolName: VERIFIER_HANDOFF_TOOL.NAME,
        handoff: {
          specId,
          summary: 'The weather alert message passed the probe.',
          acceptanceCriteria,
          findings: [],
          notes: [],
        },
      },
      {
        heading: '# Simplifier',
        runningPhase: WORKFLOW_PHASES.SIMPLIFIER_RUNNING,
        statusIcon: '🧹',
        statusLabel: 'Simplifier running',
        handoffToolName: SIMPLIFIER_HANDOFF_TOOL.NAME,
        handoff: {
          specId,
          refactoredFiles: [],
          summary: 'No simplification needed.',
          notes: [],
        },
      },
    ];

    const requests: ExecuteTaskInput[] = [];

    // Script only the AI work and completion response. Pi sessions, tools, and file operations are real.
    vi.mocked(executeTask).mockImplementation(async (request) => {
      requests.push(request);

      const services = await prepareSubagentEnvironment({
        cwd: request.cwd,
        roleGuidance: request.roleGuidance,
        additionalTools: request.additionalTools,
      });

      const { session: child } = await createAgentSession({
        ...services,
        modelRuntime: session.modelRuntime,
        model: session.model,
        sessionManager: SessionManager.inMemory(request.cwd),
      });

      try {
        await child.bindExtensions({ mode: 'print' });
        expect(child.systemPrompt).toContain(request.roleGuidance);
        expect(child.systemPrompt).toContain('You are a coding assistant running inside pi');

        const scriptedRun = scriptedRuns.find(({ heading }) =>
          request.roleGuidance.startsWith(heading),
        );

        if (scriptedRun === undefined) {
          throw new Error(`Unexpected agent: ${request.roleGuidance.split('\n')[0]}`);
        }

        expect(
          child.extensionRunner
            .getAllRegisteredTools()
            .map(({ definition }) => definition.name)
            .filter((name) => name.startsWith('maestro_record_')),
        ).toEqual([scriptedRun.handoffToolName]);
        expect(
          child.getActiveToolNames().filter((name) => name.startsWith('maestro_record_')),
        ).toEqual([scriptedRun.handoffToolName]);

        await expect(readWorkflowState(workflowPath)).resolves.toMatchObject({
          phase: scriptedRun.runningPhase,
        });
        expect(setStatus).toHaveBeenLastCalledWith(
          MAESTRO_STATUS_KEY,
          theme.fg('muted', `Maestro active · ${specId.slice(0, 26)}... · `) +
            `${scriptedRun.statusIcon} ` +
            theme.fg('accent', scriptedRun.statusLabel),
        );

        const tool = child.agent.state.tools.find(
          (tool) => tool.name === scriptedRun.handoffToolName,
        );

        assertToolRegistered(tool);
        await tool.execute('scripted-handoff', scriptedRun.handoff);

        return { text: 'The scripted child work finished.' };
      } finally {
        await child.abort();
        await child.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' });
        child.dispose();
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
      phase: WORKFLOW_PHASES.SIMPLIFIER_RUNNING,
      handoff: { specId, acceptanceCriteria, findings: [] },
    });
    expect(setStatus).toHaveBeenLastCalledWith(
      MAESTRO_STATUS_KEY,
      theme.fg('muted', `Maestro active · ${specId.slice(0, 26)}... · `) +
        '🧹 ' +
        theme.fg('accent', 'Simplifier running'),
    );

    const runSimplifierTool = session.agent.state.tools.find(
      (tool) => tool.name === RUN_SIMPLIFIER_TOOL.NAME,
    );

    assertToolRegistered(runSimplifierTool);
    const simplified = await runSimplifierTool.execute('test-call', { specId });
    expect(simplified.details).toMatchObject({
      specId,
      phase: WORKFLOW_PHASES.CANDIDATE_READY,
      handoff: {
        specId,
        refactoredFiles: [],
        summary: 'No simplification needed.',
        notes: [],
      },
    });
    await session.extensionRunner.emitToolResult({
      type: 'tool_result',
      toolName: RUN_SIMPLIFIER_TOOL.NAME,
      toolCallId: 'test-call',
      input: { specId },
      ...simplified,
      isError: false,
    });
    expect(requests).toMatchObject([
      {
        roleGuidance: expect.stringContaining('# Builder'),
        cwd: repository.path,
        prompt: expect.stringContaining(specId),
      },
      {
        roleGuidance: expect.stringContaining('# Verifier'),
        cwd: repository.path,
        prompt: expect.stringContaining(specId),
      },
      {
        roleGuidance: expect.stringContaining('# Simplifier'),
        cwd: repository.path,
        prompt: expect.stringContaining(specId),
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

    const verifierHandoffPath = join(specPath, 'handoffs', 'verifier', 'V1.json');

    expect(
      await readVerifierHandoff({
        path: verifierHandoffPath,
        specId,
      }),
    ).toMatchObject({ specId });
    expect(
      await readSimplifierHandoff({
        path: join(specPath, 'handoffs', 'simplifier', 'S.json'),
        specId,
        projectRoot: repository.path,
      }),
    ).toMatchObject({
      specId,
      refactoredFiles: [],
      summary: 'No simplification needed.',
      notes: [],
    });
    expect(await readFile(proposalFilePath, 'utf8')).toBe(approvedProposal);
    expect(await readFile(specFilePath, 'utf8')).toBe(approvedSpec);
    expect(await readFile(designFilePath, 'utf8')).toBe(approvedDesign);

    const event = await session.extensionRunner.emitBeforeAgentStart(
      { messageType: 'user', prompt: 'Discuss the next change.' },
      {
        cwd: session.extensionRunner.createContext().cwd,
        sections: { foreign: 'Keep foreign instructions' },
      },
    );

    expect(event.systemPromptOptions.sections.maestro).toContain('You own the final summary.');
    expect(event.systemPromptOptions.sections.maestro).toContain('No final tool call is required.');
  });

  it.each([
    {
      scenario: 'completed simplification',
      completionEvent: WORKFLOW_EVENTS.SIMPLIFIER_DONE,
      summary: 'No simplification needed',
      stopReason: 'stop' as const,
    },
    {
      scenario: 'a streamed simplifier report',
      completionEvent: WORKFLOW_EVENTS.SIMPLIFIER_DONE,
      summary: 'Simplified counting',
      stopReason: 'stop' as const,
    },
    {
      scenario: 'skipped simplification',
      completionEvent: WORKFLOW_EVENTS.SIMPLIFIER_SKIPPED,
      summary: 'Simplifier skipped: Git repository unavailable.',
      stopReason: 'stop' as const,
    },
    {
      scenario: 'a failed final response',
      completionEvent: WORKFLOW_EVENTS.SIMPLIFIER_DONE,
      summary: 'Simplified counting',
      stopReason: 'error' as const,
    },
    {
      scenario: 'a cancelled final response',
      completionEvent: WORKFLOW_EVENTS.SIMPLIFIER_DONE,
      summary: 'Simplified counting',
      stopReason: 'aborted' as const,
    },
    {
      scenario: 'a truncated final response',
      completionEvent: WORKFLOW_EVENTS.SIMPLIFIER_DONE,
      summary: 'Simplified counting',
      stopReason: 'length' as const,
    },
  ])(
    'given $scenario when the final response finishes then Maestro exits only after successful delivery',
    async ({ completionEvent, summary, stopReason }) => {
      const { paths, repository } = await createApprovedWorkflow();
      await prepareBuilderRun({ config: TEST_CONFIG, paths, specId: SPEC_ID });
      await completeBuilderPass({
        config: TEST_CONFIG,
        paths,
        specId: SPEC_ID,
        handoff: doneHandoff(),
      });
      await prepareVerifierRun({ config: TEST_CONFIG, paths, specId: SPEC_ID });
      await completeVerifierPass({
        config: TEST_CONFIG,
        paths,
        specId: SPEC_ID,
        handoff: {
          version: VERIFIER_HANDOFF_VERSION,
          specId: SPEC_ID,
          summary: 'Verified weather alerts',
          acceptanceCriteria: doneHandoff().acceptanceCriteria,
          findings: [],
          notes: [],
        },
      });

      await writeWorkflowState({
        path: paths.getWorkflowPath(SPEC_ID),
        state: transitionWorkflow({
          config: TEST_CONFIG,
          state: await readWorkflowState(paths.getWorkflowPath(SPEC_ID)),
          event: completionEvent,
        }),
      });

      const extension = (pi: ExtensionAPI): void => {
        maestroExtension(pi);
        pi.on('before_agent_start', (event) => {
          event.systemPromptOptions.sections.foreign = 'Keep foreign instructions';
        });
      };

      const { session, setStatus } = await piTestSessions.create({
        cwd: repository.path,
        extensions: [foreignExtension, extension],
      });

      const ui = { ...session.extensionRunner.getUIContext() };
      vi.spyOn(ui, 'select').mockResolvedValue('New spec');
      session.extensionRunner.setUIContext(ui, 'tui');
      await session.prompt('/maestro');
      maestroSessionState.setActiveSpecId(SPEC_ID);
      session.setActiveToolsByName(['read', FOREIGN_TOOL, ...MAIN_TOOL_NAMES]);
      const approvedSpec = await readFile(paths.getSpecFilePath(SPEC_ID), 'utf8');

      const verified = await readFile(
        paths.getVerifierHandoffPath({ specId: SPEC_ID, handoffPassNumber: 1 }),
        'utf8',
      );

      await session.extensionRunner.emitToolResult({
        type: 'tool_result',
        toolName: RUN_SIMPLIFIER_TOOL.NAME,
        toolCallId: 'simplify',
        input: { specId: SPEC_ID },
        content: [],
        details: { specId: SPEC_ID, phase: WORKFLOW_PHASES.CANDIDATE_READY },
        isError: false,
      });

      const summaryStarted = Promise.withResolvers<void>();
      session.subscribe((event) => {
        if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
          summaryStarted.resolve();
        }
      });
      const summaryStream = createAssistantMessageEventStream();

      const finalMessage: AssistantMessage = {
        role: 'assistant',
        api: 'openai-completions',
        provider: 'openai-codex',
        model: 'gpt-6.1-sol',
        content: [
          { type: 'text', text: `Verification: weather alerts passed. Simplifier: ${summary}` },
        ],
        stopReason,
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        timestamp: 0,
      };

      vi.spyOn(session.agent, 'streamFunction').mockImplementationOnce(() => {
        summaryStream.push({ type: 'start', partial: finalMessage });
        summaryStream.push({ type: 'text_start', contentIndex: 0, partial: finalMessage });
        summaryStream.push({
          type: 'text_delta',
          contentIndex: 0,
          delta: 'Verification: weather alerts passed.',
          partial: finalMessage,
        });

        return summaryStream;
      });

      const response = session.prompt('Report the final summary.');
      await summaryStarted.promise;

      expect(maestroSessionState.isActive()).toBe(true);
      expect(maestroSessionState.getActiveSpecId()).toBe(SPEC_ID);
      expect(session.getActiveToolNames()).toEqual(['read', FOREIGN_TOOL, ...MAIN_TOOL_NAMES]);
      const savedWorkflow = await readFile(paths.getWorkflowPath(SPEC_ID), 'utf8');
      expect(await readWorkflowState(paths.getWorkflowPath(SPEC_ID))).toMatchObject({
        phase: WORKFLOW_PHASES.CANDIDATE_READY,
      });

      if (stopReason === 'error' || stopReason === 'aborted') {
        const cancellation = stopReason === 'aborted' ? session.abort() : undefined;
        summaryStream.push({ type: 'error', reason: stopReason, error: finalMessage });
        await cancellation;
      } else {
        summaryStream.push({ type: 'done', reason: stopReason, message: finalMessage });
      }

      await response;

      const maestroIsActive = stopReason !== 'stop';
      expect(maestroSessionState.isActive()).toBe(maestroIsActive);
      expect(maestroSessionState.getActiveSpecId()).toBe(maestroIsActive ? SPEC_ID : null);
      expect(session.getActiveToolNames()).toEqual(
        maestroIsActive ? ['read', FOREIGN_TOOL, ...MAIN_TOOL_NAMES] : ['read', FOREIGN_TOOL],
      );
      expect(setStatus.mock.calls.at(-1)?.[0]).toBe(MAESTRO_STATUS_KEY);
      expect(setStatus.mock.calls.at(-1)?.[1] !== undefined).toBe(maestroIsActive);

      const nextPrompt = await session.extensionRunner.emitBeforeAgentStart(
        { messageType: 'user', prompt: 'Discuss something else.' },
        {
          cwd: repository.path,
          sections: { maestro: 'Stale instructions', foreign: 'Keep foreign instructions' },
        },
      );

      expect(nextPrompt.systemPromptOptions.sections.foreign).toBe('Keep foreign instructions');
      expect(nextPrompt.systemPromptOptions.sections.maestro !== undefined).toBe(maestroIsActive);
      expect(Object.keys(nextPrompt.systemPromptOptions.sections)).toEqual(
        maestroIsActive ? ['maestro', 'foreign'] : ['foreign'],
      );

      expect(await readFile(paths.getWorkflowPath(SPEC_ID), 'utf8')).toBe(savedWorkflow);
      expect(await readFile(paths.getSpecFilePath(SPEC_ID), 'utf8')).toBe(approvedSpec);
      expect(
        await readFile(
          paths.getVerifierHandoffPath({ specId: SPEC_ID, handoffPassNumber: 1 }),
          'utf8',
        ),
      ).toBe(verified);
    },
  );

  type PrepareSpecRevisionPhaseInput = {
    paths: MaestroPaths;
    phase: WorkflowState['phase'];
  };

  const prepareSpecRevisionPhase = async ({
    paths,
    phase,
  }: PrepareSpecRevisionPhaseInput): Promise<void> => {
    await prepareBuilderRun({ config: TEST_CONFIG, paths, specId: SPEC_ID });

    if (phase === WORKFLOW_PHASES.ESCALATION_DECISIONS) {
      await completeBuilderPass({
        config: TEST_CONFIG,
        paths,
        specId: SPEC_ID,
        handoff: unavailableCompilerEscalation,
      });

      return;
    }

    // phase === WORKFLOW_PHASES.FINDING_DECISIONS
    await completeBuilderPass({
      config: TEST_CONFIG,
      paths,
      specId: SPEC_ID,
      handoff: doneHandoff(),
    });
    await prepareVerifierRun({ config: TEST_CONFIG, paths, specId: SPEC_ID });
    await completeVerifierPass({
      config: TEST_CONFIG,
      paths,
      specId: SPEC_ID,
      handoff: {
        version: VERIFIER_HANDOFF_VERSION,
        specId: SPEC_ID,
        summary: 'The compiler is unavailable.',
        acceptanceCriteria: doneHandoff().acceptanceCriteria,
        findings: [
          {
            id: 'F1',
            acceptanceCriterion: null,
            severity: FINDING_SEVERITIES.MEDIUM,
            confidence: 1,
            summary: 'The required compiler cannot run in this environment.',
            evidence: [
              {
                source: 'Compiler check',
                observation: 'The compiler is unavailable.',
              },
            ],
            decision: null,
          },
        ],
        notes: [],
      },
    });
  };

  it.each([WORKFLOW_PHASES.ESCALATION_DECISIONS, WORKFLOW_PHASES.FINDING_DECISIONS])(
    'given a workflow in %s when the owner records a decision to revise the spec and approves the revision then the same workflow returns to ready-for-builder',
    async (phase) => {
      const { paths, repository } = await createApprovedWorkflow();

      const current = await readWorkflowState(paths.getWorkflowPath(SPEC_ID));

      await prepareSpecRevisionPhase({ paths, phase });

      const { session, setStatus } = await piTestSessions.create({
        extensions: [foreignExtension, maestroExtension],
        cwd: repository.path,
      });

      const ui = { ...session.extensionRunner.getUIContext() };
      vi.spyOn(ui, 'select').mockResolvedValue('New spec');
      session.extensionRunner.setUIContext(ui, 'tui');
      await session.prompt('/maestro');
      const theme = session.extensionRunner.createContext().ui.theme;
      maestroSessionState.setActiveSpecId(SPEC_ID);

      const resolveTool = session.agent.state.tools.find(
        (tool) =>
          tool.name ===
          (phase === WORKFLOW_PHASES.ESCALATION_DECISIONS
            ? RESOLVE_ESCALATIONS_TOOL.NAME
            : RESOLVE_FINDINGS_TOOL.NAME),
      );

      assertToolRegistered(resolveTool);

      const resolution = await resolveTool.execute(
        'revision-decision',
        phase === WORKFLOW_PHASES.ESCALATION_DECISIONS
          ? {
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
            }
          : {
              specId: SPEC_ID,
              decisions: [
                {
                  findingId: 'F1',
                  decision: FINDING_DECISIONS.REVISE_SPEC,
                  reason: 'The required compiler cannot run in this environment',
                  specChange: 'Use a local check instead of the unavailable compiler',
                },
              ],
            },
      );

      expect(resolution.details).toMatchObject({
        specId: SPEC_ID,
        phase: WORKFLOW_PHASES.DRAFTING_SPEC,
      });
      await expect(readWorkflowState(paths.getWorkflowPath(SPEC_ID))).resolves.toMatchObject({
        phase: WORKFLOW_PHASES.DRAFTING_SPEC,
      });

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
      await expect(readWorkflowState(paths.getWorkflowPath(SPEC_ID))).resolves.toEqual(
        result.details,
      );
      expect(setStatus).toHaveBeenLastCalledWith(
        MAESTRO_STATUS_KEY,
        theme.fg('muted', `Maestro active · ${SPEC_ID.slice(0, 26)}... · `) +
          '🚧 ' +
          theme.fg('accent', 'Ready for builder'),
      );
    },
  );

  it('given the builder reports an unavailable compiler when its run finishes then Maestro returns the escalation and shows that an owner decision is needed', async () => {
    const { paths, repository } = await createApprovedWorkflow();

    const { session, setStatus } = await piTestSessions.create({
      extensions: [foreignExtension, maestroExtension],
      cwd: repository.path,
    });

    const ui = { ...session.extensionRunner.getUIContext() };
    vi.spyOn(ui, 'select').mockResolvedValue('New spec');
    session.extensionRunner.setUIContext(ui, 'tui');
    await session.prompt('/maestro');
    const theme = session.extensionRunner.createContext().ui.theme;
    maestroSessionState.setActiveSpecId(SPEC_ID);
    const requests: ExecuteTaskInput[] = [];
    vi.mocked(executeTask).mockImplementation(async (request) => {
      requests.push(request);

      await completeBuilderPass({
        config: TEST_CONFIG,
        paths,
        specId: SPEC_ID,
        handoff: unavailableCompilerEscalation,
      });

      return { text: 'The scripted child work finished.' };
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
      roleGuidance: expect.stringContaining('# Builder'),
    });
    expect(result.details).toMatchObject({
      outcome: BUILDER_HANDOFF_STATUSES.ESCALATION,
      phase: WORKFLOW_PHASES.ESCALATION_DECISIONS,
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
        theme.fg('warning', 'Owner decision needed: escalations'),
    );
  });

  it('given the active spec has no workflow file when Maestro prepares the next prompt then it reports the missing file, clears its status, and still adds its instructions', async () => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);

    const { session, notify, setStatus } = await piTestSessions.create({
      extensions: [foreignExtension, maestroExtension],
      cwd: repository.path,
    });

    await saveConfiguration({
      cwd: repository.path,
      agentModelSelections: {
        builder: TEST_CONFIG.builder,
        verifier: TEST_CONFIG.verifier,
        simplifier: TEST_CONFIG.simplifier,
      },
    });
    await session.prompt('/maestro');
    maestroSessionState.setActiveSpecId(SPEC_ID);

    const event = await session.extensionRunner.emitBeforeAgentStart(
      { messageType: 'user', prompt: 'Discuss the next change.' },
      {
        cwd: session.extensionRunner.createContext().cwd,
        sections: { foreign: 'Keep foreign instructions' },
      },
    );

    expect(event.systemPromptOptions.sections.maestro).toContain('You are Maestro');
    expect(setStatus).toHaveBeenLastCalledWith(MAESTRO_STATUS_KEY, undefined);
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('ENOENT'), 'error');
  });
});

const MODEL_A = TEST_CONFIG.builder.model;

const MODEL_B = TEST_CONFIG.verifier.model;

it.each([
  {
    scenario: 'builder only',
    actions: ['Select builder', 'high', 'Confirm'],
    models: [MODEL_A],
    enabledAgents: { builder: true, verifier: false, simplifier: false },
  },
  {
    scenario: 'builder and verifier',
    actions: ['Select builder', 'high', 'Select verifier', 'medium', 'Confirm'],
    models: [MODEL_A, MODEL_B],
    enabledAgents: { builder: true, verifier: true, simplifier: false },
  },
  {
    scenario: 'verifier without builder',
    actions: ['Select verifier', 'medium', 'Confirm'],
    models: [MODEL_B],
    enabledAgents: { builder: false, verifier: true, simplifier: false },
  },
  {
    scenario: 'no roles',
    actions: ['Confirm'],
    models: [],
    enabledAgents: { builder: false, verifier: false, simplifier: false },
  },
  {
    scenario: 'cancelled replacement thinking',
    actions: ['Select builder', 'high', `Builder: ${MODEL_A} (high)`, undefined, 'Confirm'],
    models: [MODEL_A, MODEL_B],
    enabledAgents: { builder: true, verifier: false, simplifier: false },
  },
  {
    scenario: 'cancelled replacement model',
    actions: ['Select builder', 'high', `Builder: ${MODEL_A} (high)`, 'Confirm'],
    models: [MODEL_A, undefined],
    enabledAgents: { builder: true, verifier: false, simplifier: false },
  },
  {
    scenario: 'cancelled new model',
    actions: ['Select verifier', 'Confirm'],
    models: [undefined],
    enabledAgents: { builder: false, verifier: false, simplifier: false },
  },
  {
    scenario: 'cancelled new thinking',
    actions: ['Select verifier', undefined, 'Confirm'],
    models: [MODEL_B],
    enabledAgents: { builder: false, verifier: false, simplifier: false },
  },
])(
  'given first-use setup with $scenario when the owner finishes the selectors then completed choices alone determine enabled agents and activation',
  async ({ actions, models, enabledAgents }) => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);

    const { session, notify } = await piTestSessions.create({
      cwd: repository.path,
      extensions: [maestroExtension],
    });

    const ui = { ...session.extensionRunner.getUIContext() };
    const select = vi.spyOn(ui, 'select');

    for (const action of actions) select.mockResolvedValueOnce(action);
    const custom = vi.spyOn(ui, 'custom');

    for (const model of models) custom.mockResolvedValueOnce(model);
    session.extensionRunner.setUIContext(ui, 'tui');
    const mainModel = session.model;

    await session.prompt('/maestro');

    expect(select.mock.calls[0]).toEqual([
      'Maestro setup',
      ['Select builder', 'Select verifier', 'Select simplifier', 'Confirm'],
      undefined,
    ]);
    expect(session.model).toBe(mainModel);
    expect(maestroSessionState.isActive()).toBe(true);

    const saved = JSON.parse(await readFile(join(repository.path, '.pi/maestro.json'), 'utf8'));
    expect(saved.specDirectory).toBe('.specs');
    expect({
      builder: saved.builder.required,
      verifier: saved.verifier.required,
      simplifier: saved.simplifier.required,
    }).toEqual(enabledAgents);

    expect(saved.builder).toEqual(
      enabledAgents.builder
        ? { required: true, model: MODEL_A, thinking: 'high' }
        : { required: false },
    );
    expect(saved.verifier).toEqual(
      enabledAgents.verifier
        ? { required: true, model: MODEL_B, thinking: 'medium' }
        : { required: false },
    );
    expect(select.mock.calls.filter(([title]) => title === 'Maestro setup').at(-1)?.[1]).toEqual([
      enabledAgents.builder ? `Builder: ${MODEL_A} (high)` : 'Select builder',
      enabledAgents.verifier ? `Verifier: ${MODEL_B} (medium)` : 'Select verifier',
      'Select simplifier',
      'Confirm',
    ]);
    expect(
      select.mock.calls
        .filter(([title]) => title === 'Select thinking')
        .map(([, choices]) => choices[0]),
    ).toEqual(select.mock.calls.filter(([title]) => title === 'Select thinking').map(() => 'off'));

    await expect(loadConfiguration(repository.path)).resolves.toMatchObject({
      builder: { required: enabledAgents.builder },
    });
    expect(notify).toHaveBeenLastCalledWith(expect.stringContaining('Maestro active'), 'info');
  },
);

it('given Pi levels beginning with minimal and a completed high selection when builder is replaced then both thinking dialogs receive Pi order and the new first choice replaces high', async () => {
  const repository = await createTemporaryProject();
  cleanupFunctions.push(repository.cleanup);

  const { session } = await piTestSessions.create({
    cwd: repository.path,
    extensions: [maestroExtension],
  });

  const registry = session.extensionRunner.createContext().modelRegistry;

  const available = registry.getAvailable().map((model) => ({
    ...model,
    thinkingLevelMap: { off: null },
  }));

  vi.spyOn(registry, 'getAvailable').mockReturnValue(available);
  const ui = { ...session.extensionRunner.getUIContext() };

  const select = vi
    .spyOn(ui, 'select')
    .mockResolvedValueOnce('Select builder')
    .mockResolvedValueOnce('high')
    .mockResolvedValueOnce(`Builder: ${MODEL_A} (high)`)
    .mockResolvedValueOnce('minimal')
    .mockResolvedValueOnce('Confirm');

  vi.spyOn(ui, 'custom').mockResolvedValueOnce(MODEL_A).mockResolvedValueOnce(MODEL_B);
  session.extensionRunner.setUIContext(ui, 'tui');

  await session.prompt('/maestro');

  expect(
    select.mock.calls
      .filter(([title]) => title === 'Select thinking')
      .map(([, choices]) => choices),
  ).toEqual([
    ['minimal', 'low', 'medium', 'high'],
    ['minimal', 'low', 'medium', 'high'],
  ]);
  expect(select.mock.calls.at(-1)?.[1][0]).toBe(`Builder: ${MODEL_B} (minimal)`);
  const saved = JSON.parse(await readFile(join(repository.path, '.pi/maestro.json'), 'utf8'));
  expect(saved.builder).toEqual({ required: true, model: MODEL_B, thinking: 'minimal' });
  expect(maestroSessionState.isActive()).toBe(true);
});

it('given unsaved builder selection when Escape closes the main screen then configuration remains absent and Maestro stays inactive', async () => {
  const repository = await createTemporaryProject();
  cleanupFunctions.push(repository.cleanup);

  const { session } = await piTestSessions.create({
    cwd: repository.path,
    extensions: [maestroExtension],
  });

  const ui = { ...session.extensionRunner.getUIContext() };
  vi.spyOn(ui, 'select')
    .mockResolvedValueOnce('Select builder')
    .mockResolvedValueOnce('high')
    .mockResolvedValueOnce(undefined);
  vi.spyOn(ui, 'custom').mockResolvedValueOnce(MODEL_A);
  session.extensionRunner.setUIContext(ui, 'tui');
  await session.prompt('/maestro');
  await expect(access(join(repository.path, '.pi/maestro.json'))).rejects.toMatchObject({
    code: 'ENOENT',
  });
  expect(maestroSessionState.isActive()).toBe(false);
});

it('given an existing configuration missing the enabled verifier model when activation is requested then the file stays unchanged and setup is not opened', async () => {
  const repository = await createTemporaryProject();
  cleanupFunctions.push(repository.cleanup);
  const input = { ...TEST_CONFIG, verifier: { required: true } };
  await mkdir(join(repository.path, '.pi'), { recursive: true });
  await writeFile(join(repository.path, '.pi/maestro.json'), JSON.stringify(input));
  const before = await readFile(join(repository.path, '.pi/maestro.json'), 'utf8');

  const { session, notify } = await piTestSessions.create({
    cwd: repository.path,
    extensions: [maestroExtension],
  });

  const ui = { ...session.extensionRunner.getUIContext() };
  const select = vi.spyOn(ui, 'select');
  const custom = vi.spyOn(ui, 'custom');
  session.extensionRunner.setUIContext(ui, 'tui');
  await session.prompt('/maestro');
  expect(maestroSessionState.isActive()).toBe(false);
  expect(notify).toHaveBeenCalledWith('Configured model is not available: "".', 'error');
  expect(select).not.toHaveBeenCalled();
  expect(custom).not.toHaveBeenCalled();
  expect(await readFile(join(repository.path, '.pi/maestro.json'), 'utf8')).toBe(before);
});

it('given builder enabled and both later phases disabled without models when activation is requested then Maestro activates using only the builder model', async () => {
  const repository = await createTemporaryProject();
  cleanupFunctions.push(repository.cleanup);
  await saveConfiguration({
    cwd: repository.path,
    agentModelSelections: { builder: TEST_CONFIG.builder },
  });

  const { session } = await piTestSessions.create({
    cwd: repository.path,
    extensions: [maestroExtension],
  });

  await session.prompt('/maestro');
  expect(maestroSessionState.isActive()).toBe(true);
});
