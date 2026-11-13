/**
 * Objective: Verify SDK task results, native progress, persistence, and cleanup.
 * Used: With offline sessions and scripted provider responses.
 */

import { readFile } from 'node:fs/promises';

import { createAssistantMessageEventStream, type AssistantMessage } from '@earendil-works/pi-ai';
import {
  AgentSession,
  type AgentToolUpdateCallback,
  createAgentSessionServices,
  SessionManager,
  ToolExecutionComponent,
} from '@earendil-works/pi-coding-agent';
import { ProcessTerminal, TuiMainScreen } from '@earendil-works/pi-tui';
import { afterEach, describe, expect, it, vi } from 'vitest';

import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import { executeRoleTask } from '#src/delegation/executeRoleTask.ts';
import { executeTask, type ExecuteTaskInput } from '#src/delegation/executeTask.ts';
import { prepareSubagentEnvironment } from '#src/delegation/prepareSubagentEnvironment.ts';
import { TaskExecutionError } from '#src/delegation/TaskExecutionError.ts';
import { createApprovedWorkflow, SPEC_ID } from '#tests/support/builder-workflow.ts';
import piTestSessions from '#tests/support/pi-session.ts';
import { BUILDER_HANDOFF_TOOL } from '#tools/child/record-builder-handoff.ts';
import { registerRunBuilderTool, RUN_BUILDER_TOOL } from '#tools/main/run-builder.ts';
import { WORKFLOW_ROLES } from '#workflow/roles.ts';

vi.mock('#src/delegation/prepareSubagentEnvironment.ts', () => ({
  prepareSubagentEnvironment: vi.fn<typeof prepareSubagentEnvironment>(),
}));

type OfflineProgressMessageInput = Pick<
  AssistantMessage,
  'stopReason' | 'content' | 'errorMessage'
>;

const createOfflineProgressMessage = (input: OfflineProgressMessageInput): AssistantMessage => ({
  role: 'assistant',
  api: 'openai-completions',
  provider: 'activity-test',
  model: 'child',
  timestamp: 0,
  usage: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
  ...input,
});

type CreateObservedProgressSessionInput = {
  streamSimple: NonNullable<
    Parameters<AgentSession['modelRuntime']['registerProvider']>[1]['streamSimple']
  >;
};

const createObservedProgressSession = async ({
  streamSimple,
}: CreateObservedProgressSessionInput) => {
  const { session, settingsManager } = await piTestSessions.create({ extensions: [] });
  session.modelRuntime.registerProvider('activity-test', {
    api: 'openai-completions',
    apiKey: 'offline-key',
    baseUrl: 'http://127.0.0.1:1',
    models: [
      {
        id: 'child',
        name: 'Offline child',
        reasoning: true,
        input: ['text'],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 32000,
        maxTokens: 1024,
      },
    ],
    streamSimple,
  });
  await session.modelRuntime.refresh({ allowNetwork: false });
  vi.mocked(prepareSubagentEnvironment).mockImplementationOnce(({ cwd, additionalTools }) =>
    createAgentSessionServices({
      cwd,
      modelRuntime: session.modelRuntime,
      settingsManager,
      resourceLoaderOptions: {
        extensionFactories: [
          (pi) => {
            for (const tool of additionalTools) pi.registerTool(tool);
          },
        ],
        noExtensions: true,
        noSkills: true,
        noPromptTemplates: true,
        noThemes: true,
        noContextFiles: true,
      },
    }),
  );
  const unsubscribes: Array<ReturnType<typeof vi.fn<() => void>>> = [];
  const listeners: Array<Parameters<AgentSession['subscribe']>[0]> = [];
  const subscribe = AgentSession.prototype.subscribe;
  vi.spyOn(AgentSession.prototype, 'subscribe').mockImplementation(function (
    this: AgentSession,
    listener,
  ) {
    const unsubscribe = vi.fn<() => void>(subscribe.call(this, listener));
    unsubscribes.push(unsubscribe);
    listeners.push(listener);

    return unsubscribe;
  });

  return { session, unsubscribes, listeners };
};

describe('execute task', () => {
  afterEach(async () => {
    vi.useRealTimers();
    await piTestSessions.cleanup();
    maestroSessionState.deactivate();
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  it('GIVEN a successful child session WHEN a task is executed THEN its final text and saved path are returned and the child is closed', async () => {
    const { session, settingsManager } = await piTestSessions.create({ extensions: [] });
    vi.mocked(prepareSubagentEnvironment).mockImplementationOnce(({ cwd, additionalTools }) =>
      createAgentSessionServices({
        cwd,
        modelRuntime: session.modelRuntime,
        settingsManager,
        resourceLoaderOptions: {
          extensionFactories: [
            (pi) => {
              for (const tool of additionalTools) pi.registerTool(tool);
            },
          ],
          noExtensions: true,
          noSkills: true,
          noPromptTemplates: true,
          noThemes: true,
          noContextFiles: true,
        },
      }),
    );

    const nativePrompt = AgentSession.prototype.prompt;

    const prompt = vi.spyOn(AgentSession.prototype, 'prompt').mockImplementation(async function (
      this: AgentSession,
      ...args
    ) {
      this.agent.streamFunction = () => {
        const stream = createAssistantMessageEventStream();

        const message: AssistantMessage = {
          role: 'assistant',
          api: 'openai-completions',
          provider: 'openai-codex',
          model: 'offline',
          timestamp: 0,
          stopReason: 'stop',
          content: [
            { type: 'text', text: 'First line' },
            { type: 'thinking', thinking: 'Internal reasoning' },
            { type: 'text', text: 'Second line' },
          ],
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
        };

        stream.push({ type: 'start', partial: { ...message, content: [] } });
        stream.push({ type: 'done', reason: 'stop', message });

        return stream;
      };

      await nativePrompt.apply(this, args);
    });

    const dispose = vi.spyOn(AgentSession.prototype, 'dispose');

    const input: ExecuteTaskInput = {
      cwd: session.sessionManager.getCwd(),
      prompt: 'Return two lines.',
      roleGuidance: 'Do not delegate.',
      model: `${session.model!.provider}/${session.model!.id}`,
      thinkingLevel: 'high',
      additionalTools: [],
    };

    const result = await executeTask(input);

    expect(result.text).toBe('First line\nSecond line');
    expect(result.sessionFile).toContain('/subagents/');
    expect(await readFile(result.sessionFile!, 'utf8')).toContain('Second line');
    expect(prompt).toHaveBeenCalledExactlyOnceWith('Return two lines.', {
      expandPromptTemplates: false,
    });
    expect(dispose).toHaveBeenCalledOnce();
    expect(prompt.mock.invocationCallOrder[0]).toBeLessThan(dispose.mock.invocationCallOrder[0]);
  });

  it('GIVEN a native child with long progress WHEN the parent runs the builder THEN one native row expands the full text, the saved child retains it, and subsequent parent context contains only the handoff', async () => {
    maestroSessionState.activate();
    maestroSessionState.setActiveSpecId(SPEC_ID);

    const { repository } = await createApprovedWorkflow({
      agents: { builder: { model: 'activity-test/child' } },
    });

    const { session, settingsManager, notify } = await piTestSessions.create({
      cwd: repository.path,
      extensions: [registerRunBuilderTool],
    });

    const builderTool = session.extensionRunner.getAllRegisteredTools()[0].definition;
    expect(builderTool.renderCall).toBeUndefined();
    expect(builderTool.renderResult).toBeUndefined();

    const row = new ToolExecutionComponent(
      RUN_BUILDER_TOOL.NAME,
      'parent-builder',
      { specId: SPEC_ID },
      {},
      builderTool,
      new TuiMainScreen(new ProcessTerminal()),
      repository.path,
    );

    const longText =
      'PROGRESS_ONLY_789\n' +
      Array.from({ length: 30 }, (_, index) => `Line ${index + 1}`).join('\n');

    const reply: AssistantMessage = {
      role: 'assistant',
      api: 'openai-completions',
      provider: 'activity-test',
      model: 'child',
      timestamp: 0,
      stopReason: 'stop',
      content: [],
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
    };

    const handoff = {
      specId: SPEC_ID,
      status: 'done',
      summary: 'Implemented the approved task.',
      acceptanceCriteria: [{ id: 'AC1', probe: 'Offline scenario', probeStatus: 'passed' }],
      notes: [],
      escalations: [],
    };

    let childRequests = 0;
    session.modelRuntime.registerProvider('activity-test', {
      api: 'openai-completions',
      apiKey: 'offline-key',
      baseUrl: 'http://127.0.0.1:1',
      models: [
        {
          id: 'child',
          name: 'Offline child',
          reasoning: true,
          input: ['text'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 32000,
          maxTokens: 1024,
        },
      ],
      streamSimple: () => {
        childRequests += 1;
        const stream = createAssistantMessageEventStream();

        const text =
          childRequests === 1 ? 'Checking files.' : childRequests === 2 ? longText : 'Done.';

        const content: AssistantMessage['content'] =
          childRequests === 1
            ? [
                { type: 'text', text },
                { type: 'thinking', thinking: 'PRIVATE_REASONING_123' },
                {
                  type: 'toolCall',
                  id: 'child-bash',
                  name: 'bash',
                  arguments: { command: 'printf RAW_OUTPUT_456' },
                },
              ]
            : childRequests === 2
              ? [
                  { type: 'text', text },
                  {
                    type: 'toolCall',
                    id: 'child-handoff',
                    name: BUILDER_HANDOFF_TOOL.NAME,
                    arguments: handoff,
                  },
                ]
              : [{ type: 'text', text }];

        const reason = childRequests < 3 ? 'toolUse' : 'stop';
        const message: AssistantMessage = { ...reply, content, stopReason: reason };

        stream.push({ type: 'start', partial: { ...reply, content: [] } });
        stream.push({
          type: 'text_delta',
          contentIndex: 0,
          delta: text,
          partial: { ...reply, content: [{ type: 'text', text }] },
        });
        stream.push({ type: 'done', reason, message });

        return stream;
      },
    });
    await session.modelRuntime.refresh({ allowNetwork: false });
    vi.mocked(prepareSubagentEnvironment).mockImplementationOnce(({ cwd, additionalTools }) =>
      createAgentSessionServices({
        cwd,
        modelRuntime: session.modelRuntime,
        settingsManager,
        resourceLoaderOptions: {
          extensionFactories: [
            (pi) => {
              for (const tool of additionalTools) pi.registerTool(tool);
            },
          ],
          noExtensions: true,
          noSkills: true,
          noPromptTemplates: true,
          noThemes: true,
          noContextFiles: true,
        },
      }),
    );
    const progress: string[] = [];
    const collapsed: string[] = [];
    const expanded: string[] = [];
    session.subscribe((event) => {
      if (event.type !== 'tool_execution_update' || event.toolCallId !== 'parent-builder') return;
      const text = event.partialResult.content[0].text;
      progress.push(text);
      row.updateResult({ ...event.partialResult, isError: false }, true);

      if (text.includes(longText)) {
        collapsed.push(row.render(100).join('\n'));
        row.setExpanded(true);
        expanded.push(row.render(100).join('\n'));
        row.setExpanded(false);
      }
    });
    let parentRequests = 0;
    const parentContexts: string[] = [];
    session.agent.streamFunction = (_model, context) => {
      parentRequests += 1;
      parentContexts.push(JSON.stringify(context));
      const stream = createAssistantMessageEventStream();

      const message: AssistantMessage =
        parentRequests === 1
          ? {
              ...reply,
              content: [
                {
                  type: 'toolCall',
                  id: 'parent-builder',
                  name: RUN_BUILDER_TOOL.NAME,
                  arguments: { specId: SPEC_ID },
                },
              ],
              stopReason: 'toolUse',
            }
          : { ...reply, content: [{ type: 'text', text: 'Builder finished.' }] };

      stream.push({ type: 'start', partial: { ...reply, content: [] } });
      stream.push({ type: 'done', reason: parentRequests === 1 ? 'toolUse' : 'stop', message });

      return stream;
    };

    await session.prompt('Run the approved builder task.');
    expect(parentRequests).toBe(2);
    expect(childRequests).toBe(3);
    expect(progress.some((text) => text.includes('Checking files.'))).toBe(true);
    expect(
      progress.some((text) => text.includes(longText) && !text.includes('Checking files.')),
    ).toBe(true);
    expect(JSON.stringify(progress)).not.toMatch(/PRIVATE_REASONING_123|RAW_OUTPUT_456/);
    expect(collapsed.length).toBeGreaterThan(0);
    expect(collapsed.every((text) => !text.includes('Line 30'))).toBe(true);
    expect(expanded.every((text) => text.includes('Line 30'))).toBe(true);
    expect(parentContexts[1]).toContain(handoff.summary);
    expect(parentContexts[1]).not.toMatch(
      /PROGRESS_ONLY_789|Line 30|PRIVATE_REASONING_123|RAW_OUTPUT_456/,
    );
    const result = session.messages.find((message) => message.role === 'toolResult');
    expect(JSON.stringify(result)).toContain(handoff.summary);
    expect(JSON.stringify(result)).not.toContain('PROGRESS_ONLY_789');

    const savedNotice = notify.mock.calls.find(([message]) =>
      message.startsWith('Saved child session: '),
    );

    expect(savedNotice).toBeDefined();
    const sessionFile = String(savedNotice?.[0]).replace('Saved child session: ', '');
    const entries = SessionManager.open(sessionFile).getEntries();
    expect(
      entries.some(
        (entry) =>
          entry.type === 'message' &&
          entry.message.role === 'assistant' &&
          entry.message.content.some((block) => block.type === 'text' && block.text === longText),
      ),
    ).toBe(true);
    expect(await readFile(sessionFile, 'utf8')).toContain('Line 30');
  });

  it('GIVEN a native child streaming progress WHEN execution completes THEN its subscription and timer are released and late events are ignored', async () => {
    const message = createOfflineProgressMessage({
      stopReason: 'stop',
      content: [{ type: 'text', text: 'Waiting at 40 seconds.' }],
    });

    const updates = vi.fn<AgentToolUpdateCallback>();

    const streamSimple = vi.fn<CreateObservedProgressSessionInput['streamSimple']>(() => {
      vi.advanceTimersByTime(40_000);
      const stream = createAssistantMessageEventStream();
      stream.push({ type: 'start', partial: { ...message, content: [] } });
      stream.push({
        type: 'text_delta',
        contentIndex: 0,
        delta: 'Waiting at 40 seconds.',
        partial: message,
      });
      stream.push({ type: 'done', reason: 'stop', message });

      return stream;
    });

    const { session, unsubscribes, listeners } = await createObservedProgressSession({
      streamSimple,
    });

    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });

    await expect(
      executeRoleTask({
        role: WORKFLOW_ROLES.BUILDER,
        cwd: session.sessionManager.getCwd(),
        model: 'activity-test/child',
        thinkingLevel: 'off',
        prompt: 'Run the offline task.',
        ui: session.extensionRunner.createContext().ui,
        onUpdate: updates,
      }),
    ).resolves.toBeUndefined();

    expect(streamSimple).toHaveBeenCalledOnce();
    expect(unsubscribes).toHaveLength(1);
    expect(unsubscribes[0]).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    const updateCount = updates.mock.calls.length;
    vi.advanceTimersByTime(25_000);
    listeners.forEach((listener) => listener({ type: 'message_end', message }));
    expect(updates).toHaveBeenCalledTimes(updateCount);
  });

  it('GIVEN a native child with allocated progress WHEN extension startup fails THEN the error is reported, its subscription and timer are released, and late events are ignored', async () => {
    const message = createOfflineProgressMessage({ stopReason: 'stop', content: [] });
    const updates = vi.fn<AgentToolUpdateCallback>();

    const streamSimple = vi.fn<CreateObservedProgressSessionInput['streamSimple']>(() => {
      throw new Error('The provider must not be called after startup fails.');
    });

    const { session, unsubscribes, listeners } = await createObservedProgressSession({
      streamSimple,
    });

    vi.spyOn(AgentSession.prototype, 'bindExtensions').mockRejectedValueOnce(
      new Error('Startup failed after subscription.'),
    );
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });

    const execution = executeRoleTask({
      role: WORKFLOW_ROLES.BUILDER,
      cwd: session.sessionManager.getCwd(),
      model: 'activity-test/child',
      thinkingLevel: 'off',
      prompt: 'Run the offline task.',
      ui: session.extensionRunner.createContext().ui,
      onUpdate: updates,
    });

    await expect(execution).rejects.toBeInstanceOf(TaskExecutionError);
    await expect(execution).rejects.toThrow('Startup failed after subscription.');

    expect(streamSimple).not.toHaveBeenCalled();
    expect(unsubscribes).toHaveLength(1);
    expect(unsubscribes[0]).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    const updateCount = updates.mock.calls.length;
    vi.advanceTimersByTime(25_000);
    listeners.forEach((listener) => listener({ type: 'message_end', message }));
    expect(updates).toHaveBeenCalledTimes(updateCount);
  });

  it('GIVEN a native child streaming progress WHEN its provider fails THEN the error is reported, its subscription and timer are released, and late events are ignored', async () => {
    const message = createOfflineProgressMessage({
      stopReason: 'error',
      content: [{ type: 'text', text: 'Waiting at 40 seconds.' }],
      errorMessage: 'Provider unavailable.',
    });

    const updates = vi.fn<AgentToolUpdateCallback>();

    const streamSimple = vi.fn<CreateObservedProgressSessionInput['streamSimple']>(() => {
      vi.advanceTimersByTime(40_000);
      const stream = createAssistantMessageEventStream();
      stream.push({ type: 'start', partial: { ...message, content: [] } });
      stream.push({
        type: 'text_delta',
        contentIndex: 0,
        delta: 'Waiting at 40 seconds.',
        partial: message,
      });
      stream.push({ type: 'error', reason: 'error', error: message });

      return stream;
    });

    const { session, unsubscribes, listeners } = await createObservedProgressSession({
      streamSimple,
    });

    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });

    const execution = executeRoleTask({
      role: WORKFLOW_ROLES.BUILDER,
      cwd: session.sessionManager.getCwd(),
      model: 'activity-test/child',
      thinkingLevel: 'off',
      prompt: 'Run the offline task.',
      ui: session.extensionRunner.createContext().ui,
      onUpdate: updates,
    });

    await expect(execution).rejects.toBeInstanceOf(TaskExecutionError);
    await expect(execution).rejects.toThrow('Provider unavailable.');

    expect(streamSimple).toHaveBeenCalledOnce();
    expect(unsubscribes).toHaveLength(1);
    expect(unsubscribes[0]).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    const updateCount = updates.mock.calls.length;
    vi.advanceTimersByTime(25_000);
    listeners.forEach((listener) => listener({ type: 'message_end', message }));
    expect(updates).toHaveBeenCalledTimes(updateCount);
  });

  it('GIVEN a native child streaming progress WHEN its controller aborts THEN interruption is reported, its subscription and timer are released, and late events are ignored', async () => {
    const message = createOfflineProgressMessage({
      stopReason: 'stop',
      content: [{ type: 'text', text: 'Waiting at 40 seconds.' }],
    });

    const controller = new AbortController();
    const updates = vi.fn<AgentToolUpdateCallback>();

    const streamSimple = vi.fn<CreateObservedProgressSessionInput['streamSimple']>(
      (_model, _context, options) => {
        vi.advanceTimersByTime(40_000);
        const stream = createAssistantMessageEventStream();
        options?.signal?.addEventListener(
          'abort',
          () => {
            stream.push({
              type: 'error',
              reason: 'aborted',
              error: { ...message, stopReason: 'aborted', errorMessage: 'Task interrupted.' },
            });
          },
          { once: true },
        );
        stream.push({ type: 'start', partial: { ...message, content: [] } });
        stream.push({
          type: 'text_delta',
          contentIndex: 0,
          delta: 'Waiting at 40 seconds.',
          partial: message,
        });

        return stream;
      },
    );

    const { session, unsubscribes, listeners } = await createObservedProgressSession({
      streamSimple,
    });

    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });

    const execution = executeRoleTask({
      role: WORKFLOW_ROLES.BUILDER,
      cwd: session.sessionManager.getCwd(),
      model: 'activity-test/child',
      thinkingLevel: 'off',
      prompt: 'Run the offline task.',
      signal: controller.signal,
      ui: session.extensionRunner.createContext().ui,
      onUpdate: (result) => {
        updates(result);

        if (
          result.content.some(
            (block) => block.type === 'text' && block.text.includes('Waiting at 40 seconds.'),
          )
        ) {
          controller.abort();
        }
      },
    });

    await expect(execution).rejects.toBeInstanceOf(TaskExecutionError);
    await expect(execution).rejects.toThrow(/abort|interrupt/i);

    expect(streamSimple).toHaveBeenCalledOnce();
    expect(unsubscribes).toHaveLength(1);
    expect(unsubscribes[0]).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    const updateCount = updates.mock.calls.length;
    vi.advanceTimersByTime(25_000);
    listeners.forEach((listener) => listener({ type: 'message_end', message }));
    expect(updates).toHaveBeenCalledTimes(updateCount);
  });

  it('GIVEN resource discovery fails WHEN a task is prepared THEN its diagnostic cause reaches the caller without a saved path', async () => {
    const cause = new Error('Resource discovery failed.');
    vi.mocked(prepareSubagentEnvironment).mockRejectedValueOnce(cause);

    const execution = executeTask({
      cwd: process.cwd(),
      prompt: 'Do not submit this task.',
      roleGuidance: 'Do not delegate.',
      model: 'unused/model',
      thinkingLevel: 'high',
      additionalTools: [],
    });

    await expect(execution).rejects.toBeInstanceOf(TaskExecutionError);
    await expect(execution).rejects.toMatchObject({
      message: 'Resource discovery failed.',
      cause,
      sessionFile: undefined,
    });
  });
});
