/**
 * Objective: Verify tool and instruction availability when Maestro is toggled or Pi resumes.
 * Used: In integration tests with real offline Pi sessions.
 */

import { readFile } from 'node:fs/promises';

import { createAssistantMessageEventStream } from '@earendil-works/pi-ai';
import { stripTerminalSequences } from '@earendil-works/pi-tui';
import { afterEach, expect, it, vi, onTestFinished } from 'vitest';

import { saveConfiguration } from '#config/saveConfiguration.ts';
import maestroExtension from '#extensions/maestro.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import { MAESTRO_STATUS_KEY } from '#maestro/status/refreshMaestroStatus.ts';
import { TEST_CONFIG } from '#tests/fixtures/config/selected-agents.ts';
import { createApprovedWorkflow, SPEC_ID } from '#tests/support/builder-workflow.ts';
import {
  BASE_TOOLS,
  FOREIGN_TOOL,
  MAIN_TOOL_NAMES,
  chooseNewSpec,
  foreignExtension,
} from '#tests/support/maestro-extension.ts';
import * as piTestSessions from '#tests/support/pi-session.ts';
import { createTemporaryProject } from '#tests/support/temp-repository.ts';

afterEach(() => {
  maestroSessionState.deactivate();
});

it('GIVEN a new Pi session WHEN Maestro loads THEN its tools register once but stay inactive, with no notice, status, or added instructions', async () => {
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

it('GIVEN valid activation checks WHEN Maestro is enabled and later re-enabled THEN its tools, instructions, and status are available without duplicate registration, automatic model calls, or new session history', async () => {
  const repository = await createTemporaryProject();
  onTestFinished(repository.cleanup);

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

  chooseNewSpec(session);
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

it('GIVEN Maestro has an active spec WHEN it is disabled and enabled again THEN saved files stay unchanged and the previous spec is no longer active', async () => {
  const { paths, repository } = await createApprovedWorkflow();

  const { session, notify, setStatus, settingsManager } = await piTestSessions.create({
    extensions: [foreignExtension, maestroExtension],
    cwd: repository.path,
  });

  chooseNewSpec(session);
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
    maestro_status: expect.stringContaining('Maestro is off.'),
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

it('GIVEN a session has sent Maestro instructions WHEN the owner toggles Maestro off and back on THEN the model receives the off notice and its removal', async () => {
  const repository = await createTemporaryProject();
  onTestFinished(repository.cleanup);
  await saveConfiguration({ cwd: repository.path, agentModelSelections: {} });

  const { session } = await piTestSessions.create({
    cwd: repository.path,
    extensions: [
      maestroExtension,
      (pi) => {
        pi.on('before_agent_start', (event) => {
          event.systemPromptOptions.sections.foreign = 'Keep foreign instructions';
        });
      },
    ],
  });

  chooseNewSpec(session);

  const modelRequests = vi.spyOn(session.agent, 'streamFunction').mockImplementation((model) => {
    const stream = createAssistantMessageEventStream();
    stream.push({
      type: 'done',
      reason: 'stop',
      message: {
        role: 'assistant',
        api: model.api,
        provider: model.provider,
        model: model.id,
        content: [{ type: 'text', text: 'Ready.' }],
        stopReason: 'stop',
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        timestamp: Temporal.Now.instant().epochMilliseconds,
      },
    });

    return stream;
  });

  const outgoingSystemSections = () =>
    modelRequests.mock.lastCall?.[1].messages
      .filter((message) => message.role === 'system')
      .map((message) => message.sections);

  await session.prompt('/maestro');
  await session.prompt('Discuss the change.');
  expect(outgoingSystemSections()).toContainEqual(
    expect.objectContaining({ maestro: expect.stringContaining('You are Maestro') }),
  );

  await session.prompt('/maestro');
  await session.prompt('Discuss something else.');
  expect(modelRequests).toHaveBeenCalledTimes(2);
  expect(outgoingSystemSections()?.at(-1)).toEqual({
    maestro: null,
    maestro_status:
      '<maestro_status>\nIMPORTANT: Maestro is off. Ignore earlier Maestro instructions.\n</maestro_status>',
  });
  expect(outgoingSystemSections()).toContainEqual(
    expect.objectContaining({
      foreign: expect.stringContaining('Keep foreign instructions'),
      maestro: expect.stringContaining('You are Maestro'),
    }),
  );

  await session.prompt('/maestro');
  await session.prompt('Return to the change.');
  expect(modelRequests).toHaveBeenCalledTimes(3);
  expect(outgoingSystemSections()?.at(-1)).toEqual({
    maestro: expect.stringContaining('You are Maestro'),
    maestro_status: null,
  });
});

it('GIVEN a saved workflow WHEN Pi resumes the session THEN Maestro stays disabled, leaves the workflow unchanged, and does not select an active spec', async () => {
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
