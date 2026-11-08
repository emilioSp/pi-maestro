/**
 * Objective: Verify builder SDK inputs, saved outcomes, and failure boundaries.
 * Used: With offline Pi tools and scripted SDK executions.
 */

import { access, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { AssistantMessage } from '@earendil-works/pi-ai';
import type { AgentToolUpdateCallback } from '@earendil-works/pi-coding-agent';
import { Value } from 'typebox/value';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readBuilderHandoff } from '#artifacts/builder-handoff/readBuilderHandoff.ts';
import { BUILDER_HANDOFF_STATUSES, PROBE_STATUSES } from '#artifacts/builder-handoff/schema.ts';
import { executeRoleTask } from '#src/delegation/executeRoleTask.ts';
import { executeTask } from '#src/delegation/executeTask.ts';
import { TaskExecutionError } from '#src/delegation/TaskExecutionError.ts';
import { TEST_CONFIG } from '#tests/fixtures/config/selected-agents.ts';
import { csvExportEscalation } from '#tests/fixtures/csv-export-escalation.ts';
import {
  cleanupBuilderWorkflows,
  createApprovedWorkflow,
  doneHandoff,
  SPEC_ID,
} from '#tests/support/builder-workflow.ts';
import piTestSessions from '#tests/support/pi-session.ts';
import {
  BUILDER_HANDOFF_TOOL,
  recordBuilderHandoffTool,
} from '#tools/child/record-builder-handoff.ts';
import { registerRunBuilderTool } from '#tools/main/run-builder.ts';
import { completeBuilderPass } from '#workflow/builder/completeBuilderPass.ts';
import { WORKFLOW_ROLES } from '#workflow/roles.ts';
import { readWorkflowState } from '#workflow/state/readWorkflowState.ts';
import { WORKFLOW_PHASES } from '#workflow/state/schema.ts';
import { writeWorkflowState } from '#workflow/state/writeWorkflowState.ts';

vi.mock('#src/delegation/executeTask.ts', () => ({ executeTask: vi.fn<typeof executeTask>() }));

afterEach(async () => {
  vi.useRealTimers();
  vi.mocked(executeTask).mockReset();
  await piTestSessions.cleanup();
  await cleanupBuilderWorkflows();
});

const normalAssistantMessage: AssistantMessage = {
  role: 'assistant',
  api: 'openai-completions',
  provider: 'openai-codex',
  model: 'offline-test',
  content: [{ type: 'text', text: 'Running the tests.' }],
  stopReason: 'stop',
  timestamp: 0,
  usage: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
};

describe('native run activity', () => {
  it.each(Object.values(WORKFLOW_ROLES))(
    'given an executing %s when text and bash arrive at 134 seconds then progress shows duration and recent text',
    async (role) => {
      const { session } = await piTestSessions.create({ extensions: [] });
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
      const onUpdate = vi.fn<AgentToolUpdateCallback>();
      vi.mocked(executeTask).mockImplementationOnce(async ({ onEvent }) => {
        vi.advanceTimersByTime(134_000);
        onEvent?.({ type: 'message_end', message: normalAssistantMessage });
        onEvent?.({
          type: 'tool_execution_start',
          toolCallId: 'bash-1',
          toolName: 'bash',
          args: {},
        });
        expect(onUpdate).toHaveBeenLastCalledWith({
          content: [{ type: 'text', text: 'Elapsed: 2m 14s\n\nRunning the tests.' }],
          details: undefined,
        });

        return { text: 'Done' };
      });
      await executeRoleTask({
        role,
        cwd: session.sessionManager.getCwd(),
        model: 'unused/model',
        thinkingLevel: 'off',
        prompt: 'Implement the approved task.',
        ui: session.extensionRunner.createContext().ui,
        onUpdate,
      });
    },
  );

  it('given an open assistant message when another fragment arrives then accumulated text replaces the previous progress before completion', async () => {
    const { session } = await piTestSessions.create({ extensions: [] });
    const onUpdate = vi.fn<AgentToolUpdateCallback>();
    vi.mocked(executeTask).mockImplementationOnce(async ({ onEvent }) => {
      const partial = {
        ...normalAssistantMessage,
        content: [{ type: 'text' as const, text: 'Checking ' }],
      };

      onEvent?.({
        type: 'message_update',
        message: partial,
        assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: 'Checking ', partial },
      });
      expect(onUpdate.mock.lastCall?.[0].content).toEqual([
        { type: 'text', text: expect.stringContaining('Checking ') },
      ]);

      const accumulated = {
        ...normalAssistantMessage,
        content: [{ type: 'text' as const, text: 'Checking validation.' }],
      };

      onEvent?.({
        type: 'message_update',
        message: accumulated,
        assistantMessageEvent: {
          type: 'text_delta',
          contentIndex: 0,
          delta: 'validation.',
          partial: accumulated,
        },
      });
      expect(onUpdate.mock.lastCall?.[0].content).toEqual([
        { type: 'text', text: expect.stringContaining('Checking validation.') },
      ]);

      return { text: 'Done' };
    });
    await executeRoleTask({
      role: WORKFLOW_ROLES.BUILDER,
      cwd: session.sessionManager.getCwd(),
      model: 'unused/model',
      thinkingLevel: 'off',
      prompt: 'Implement the task.',
      ui: session.extensionRunner.createContext().ui,
      onUpdate,
    });
  });

  it('given silent bash at 134 seconds when 25 seconds pass without child events then elapsed advances to 159 seconds and recent text stays visible', async () => {
    const { session } = await piTestSessions.create({ extensions: [] });
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
    const onUpdate = vi.fn<AgentToolUpdateCallback>();
    vi.mocked(executeTask).mockImplementationOnce(async ({ onEvent }) => {
      onEvent?.({ type: 'message_end', message: normalAssistantMessage });
      onEvent?.({ type: 'tool_execution_start', toolCallId: 'bash-1', toolName: 'bash', args: {} });
      vi.advanceTimersByTime(134_000);
      expect(onUpdate.mock.lastCall?.[0].content).toEqual([
        { type: 'text', text: 'Elapsed: 2m 14s\n\nRunning the tests.' },
      ]);
      vi.advanceTimersByTime(25_000);
      expect(onUpdate.mock.lastCall?.[0].content).toEqual([
        { type: 'text', text: 'Elapsed: 2m 39s\n\nRunning the tests.' },
      ]);

      return { text: 'Done' };
    });
    await executeRoleTask({
      role: WORKFLOW_ROLES.BUILDER,
      cwd: session.sessionManager.getCwd(),
      model: 'unused/model',
      thinkingLevel: 'off',
      prompt: 'Implement the task.',
      ui: session.extensionRunner.createContext().ui,
      onUpdate,
    });
  });

  it('given bash starts and finishes without new assistant text when no periodic refresh is due then neither tool event publishes progress', async () => {
    const { session } = await piTestSessions.create({ extensions: [] });
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
    const onUpdate = vi.fn<AgentToolUpdateCallback>();
    vi.mocked(executeTask).mockImplementationOnce(async ({ onEvent }) => {
      onEvent?.({ type: 'message_end', message: normalAssistantMessage });
      vi.advanceTimersByTime(134_000);
      expect(onUpdate).toHaveBeenLastCalledWith({
        content: [{ type: 'text', text: 'Elapsed: 2m 14s\n\nRunning the tests.' }],
        details: undefined,
      });
      const updatesBeforeTools = onUpdate.mock.calls.length;
      onEvent?.({ type: 'tool_execution_start', toolCallId: 'bash-1', toolName: 'bash', args: {} });
      onEvent?.({
        type: 'tool_execution_end',
        toolCallId: 'bash-1',
        toolName: 'bash',
        result: {},
        isError: false,
      });
      expect(onUpdate).toHaveBeenCalledTimes(updatesBeforeTools);
      expect(onUpdate).toHaveBeenLastCalledWith({
        content: [{ type: 'text', text: 'Elapsed: 2m 14s\n\nRunning the tests.' }],
        details: undefined,
      });
      vi.advanceTimersByTime(25_000);
      expect(onUpdate).toHaveBeenLastCalledWith({
        content: [{ type: 'text', text: 'Elapsed: 2m 39s\n\nRunning the tests.' }],
        details: undefined,
      });

      return { text: 'Done' };
    });
    await executeRoleTask({
      role: WORKFLOW_ROLES.BUILDER,
      cwd: session.sessionManager.getCwd(),
      model: 'unused/model',
      thinkingLevel: 'off',
      prompt: 'Implement the task.',
      ui: session.extensionRunner.createContext().ui,
      onUpdate,
    });
  });

  it('given a completed 180-second builder when a verifier starts then its initial progress has zero elapsed time and no inherited text', async () => {
    const { session } = await piTestSessions.create({ extensions: [] });
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
    const onUpdate = vi.fn<AgentToolUpdateCallback>();
    vi.mocked(executeTask).mockImplementationOnce(async ({ onEvent }) => {
      vi.advanceTimersByTime(180_000);
      onEvent?.({
        type: 'message_end',
        message: {
          ...normalAssistantMessage,
          content: [{ type: 'text', text: 'Build complete.' }],
        },
      });
      onEvent?.({ type: 'tool_execution_start', toolCallId: 'bash-1', toolName: 'bash', args: {} });

      return { text: 'Done' };
    });
    await executeRoleTask({
      role: WORKFLOW_ROLES.BUILDER,
      cwd: session.sessionManager.getCwd(),
      model: 'unused/model',
      thinkingLevel: 'off',
      prompt: 'Implement the task.',
      ui: session.extensionRunner.createContext().ui,
      onUpdate,
    });
    onUpdate.mockClear();
    vi.mocked(executeTask).mockResolvedValueOnce({ text: 'Done' });
    await executeRoleTask({
      role: WORKFLOW_ROLES.VERIFIER,
      cwd: session.sessionManager.getCwd(),
      model: 'unused/model',
      thinkingLevel: 'off',
      prompt: 'Verify the task.',
      ui: session.extensionRunner.createContext().ui,
      onUpdate,
    });
    expect(onUpdate).toHaveBeenCalledExactlyOnceWith({
      content: [{ type: 'text', text: 'Elapsed: 0m 0s' }],
      details: undefined,
    });
  });

  it('given normal text, thinking, and tool output when child events arrive then progress excludes private reasoning and raw results', async () => {
    const { session } = await piTestSessions.create({ extensions: [] });
    const onUpdate = vi.fn<AgentToolUpdateCallback>();
    vi.mocked(executeTask).mockImplementationOnce(async ({ onEvent }) => {
      onEvent?.({
        type: 'message_end',
        message: {
          ...normalAssistantMessage,
          content: [
            { type: 'text', text: 'Running checks.' },
            { type: 'thinking', thinking: 'PRIVATE_REASONING_123' },
          ],
        },
      });
      onEvent?.({ type: 'tool_execution_start', toolCallId: 'bash-1', toolName: 'bash', args: {} });
      onEvent?.({
        type: 'tool_execution_update',
        toolCallId: 'bash-1',
        toolName: 'bash',
        args: {},
        partialResult: { content: [{ type: 'text', text: 'RAW_OUTPUT_456' }] },
      });
      onEvent?.({
        type: 'message_end',
        message: {
          role: 'toolResult',
          toolCallId: 'bash-1',
          toolName: 'bash',
          content: [{ type: 'text', text: 'RAW_OUTPUT_456' }],
          isError: false,
          timestamp: 0,
        },
      });
      onEvent?.({
        type: 'tool_execution_end',
        toolCallId: 'bash-1',
        toolName: 'bash',
        result: { content: [{ type: 'text', text: 'RAW_OUTPUT_456' }] },
        isError: false,
      });
      expect(JSON.stringify(onUpdate.mock.calls)).toContain('Running checks.');
      expect(JSON.stringify(onUpdate.mock.calls)).not.toMatch(
        /PRIVATE_REASONING_123|RAW_OUTPUT_456/,
      );

      return { text: 'Done' };
    });
    await executeRoleTask({
      role: WORKFLOW_ROLES.BUILDER,
      cwd: session.sessionManager.getCwd(),
      model: 'unused/model',
      thinkingLevel: 'off',
      prompt: 'Implement the task.',
      ui: session.extensionRunner.createContext().ui,
      onUpdate,
    });
  });
});

describe('run builder tool', () => {
  it('given a ready-for-verifier workflow whose builder report still contains escalations when the builder reports completion then the run fails because the report status and phase disagree', async () => {
    const { paths, repository } = await createApprovedWorkflow();

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerRunBuilderTool,
    });

    vi.mocked(executeTask).mockImplementationOnce(async () => {
      await completeBuilderPass({
        config: TEST_CONFIG,
        paths,
        specId: SPEC_ID,
        handoff: csvExportEscalation,
      });
      const state = await readWorkflowState(paths.getWorkflowPath(SPEC_ID));
      await writeWorkflowState({
        path: paths.getWorkflowPath(SPEC_ID),
        state: { ...state, phase: WORKFLOW_PHASES.READY_FOR_VERIFIER },
      });

      return { text: 'Completed successfully' };
    });
    await expect(tool.execute('test-call', { specId: SPEC_ID })).rejects.toThrow(
      'Builder protocol error: Builder handoff status does not match workflow phase "ready-for-verifier".',
    );
  });

  it.each([
    {
      scenario: 'missing',
      description: 'no saved escalation report',
    },
    {
      scenario: 'wrong-status',
      description: 'a done report in escalation-decisions',
    },
    {
      scenario: 'resolved-question',
      description: 'an answered escalation question',
    },
  ])(
    'given $description when the builder reports completion then the run fails with a protocol error',
    async ({ scenario }) => {
      const { paths, repository } = await createApprovedWorkflow();

      const { tool } = await piTestSessions.createRegisteredTool({
        cwd: repository.path,
        extension: registerRunBuilderTool,
      });

      vi.mocked(executeTask).mockImplementationOnce(async () => {
        const completed = await completeBuilderPass({
          config: TEST_CONFIG,
          paths,
          specId: SPEC_ID,
          handoff: csvExportEscalation,
        });

        const handoff = JSON.parse(await readFile(completed.handoffPath, 'utf8'));

        if (scenario === 'missing') await rm(completed.handoffPath);

        if (scenario === 'wrong-status') {
          handoff.status = BUILDER_HANDOFF_STATUSES.DONE;
          handoff.escalations = [];
          handoff.acceptanceCriteria = [];
        }

        if (scenario === 'resolved-question')
          handoff.escalations[0].resolution = {
            selectedOptionId: 'exclude',
            decision: 'Exclude archived rows',
            reason: 'Keep exports current',
          };

        if (scenario !== 'missing') await writeFile(completed.handoffPath, JSON.stringify(handoff));

        return { text: 'Completed successfully' };
      });
      await expect(tool.execute('test-call', { specId: SPEC_ID })).rejects.toThrow(
        'Builder protocol error:',
      );
    },
  );

  it('given builder run inputs when the tool schema is checked then a spec ID is required and extra fields are rejected', async () => {
    const { tool } = await piTestSessions.createRegisteredTool({
      extension: registerRunBuilderTool,
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

  it('given an approved workflow when the builder saves a done report then the run uses the configured SDK inputs and current project and returns that report in ready-for-verifier', async () => {
    const { paths, repository } = await createApprovedWorkflow({
      agents: { builder: { model: 'openai-codex/gpt-6.1-sol', thinking: 'high' } },
    });

    const { tool, notify } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerRunBuilderTool,
    });

    const sessionFile = join(repository.path, 'child.jsonl');
    await writeFile(sessionFile, '{}\n');
    const controller = new AbortController();
    vi.mocked(executeTask).mockImplementationOnce(async () => {
      await completeBuilderPass({
        config: TEST_CONFIG,
        paths,
        specId: SPEC_ID,
        handoff: {
          status: BUILDER_HANDOFF_STATUSES.DONE,
          escalations: [],
          summary: 'The approved change was implemented.',
          acceptanceCriteria: [
            {
              id: 'AC1',
              probe: 'npm test',
              probeStatus: PROBE_STATUSES.PASSED,
            },
          ],
          notes: [],
        },
      });

      return { text: 'Completed successfully', sessionFile };
    });

    const onUpdate = vi.fn<AgentToolUpdateCallback>();

    const result = await tool.execute(
      'test-call',
      { specId: SPEC_ID },
      controller.signal,
      onUpdate,
    );

    expect(onUpdate).toHaveBeenCalledWith({
      content: [{ type: 'text', text: 'Elapsed: 0m 0s' }],
      details: undefined,
    });

    const saved = await readBuilderHandoff({
      path: await paths.getActiveBuilderHandoffPath(SPEC_ID),
      specId: SPEC_ID,
    });

    expect(result.details).toEqual({
      outcome: BUILDER_HANDOFF_STATUSES.DONE,
      specId: SPEC_ID,
      phase: WORKFLOW_PHASES.READY_FOR_VERIFIER,
      handoff: saved,
    });

    const receivedRequest = vi.mocked(executeTask).mock.calls[0][0];
    expect(receivedRequest).toMatchObject({
      cwd: repository.path,
      model: 'openai-codex/gpt-6.1-sol',
      thinkingLevel: 'high',
      prompt: expect.stringContaining(SPEC_ID),
    });
    expect(receivedRequest).toMatchObject({
      prompt: expect.stringContaining(repository.path),
    });

    expect(result.details).toMatchObject({
      outcome: BUILDER_HANDOFF_STATUSES.DONE,
      specId: SPEC_ID,
      phase: WORKFLOW_PHASES.READY_FOR_VERIFIER,
      handoff: { status: BUILDER_HANDOFF_STATUSES.DONE, escalations: [] },
    });
    const input = vi.mocked(executeTask).mock.calls[0][0];
    expect(input.signal).toBe(controller.signal);
    expect(input.roleGuidance).toBe(
      await readFile(new URL('../../../agents/builder.md', import.meta.url), 'utf8'),
    );
    expect(input.additionalTools.map((tool) => tool.name)).toEqual([BUILDER_HANDOFF_TOOL.NAME]);
    expect(notify).toHaveBeenCalledWith(`Saved child session: ${sessionFile}`, 'info');
  });

  it('given an approved workflow when the builder saves an escalation report then the run returns that report and the workflow waits in escalation-decisions', async () => {
    const { paths, repository } = await createApprovedWorkflow();

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerRunBuilderTool,
    });

    vi.mocked(executeTask).mockImplementationOnce(async () => {
      const opened = await completeBuilderPass({
        config: TEST_CONFIG,
        paths,
        specId: SPEC_ID,
        handoff: csvExportEscalation,
      });

      expect(opened.state.phase).toBe(WORKFLOW_PHASES.ESCALATION_DECISIONS);

      return { text: 'Completed successfully' };
    });

    const result = await tool.execute('test-call', { specId: SPEC_ID });

    const saved = await readBuilderHandoff({
      path: await paths.getActiveBuilderHandoffPath(SPEC_ID),
      specId: SPEC_ID,
    });

    expect(result.details).toEqual({
      outcome: BUILDER_HANDOFF_STATUSES.ESCALATION,
      specId: SPEC_ID,
      phase: WORKFLOW_PHASES.ESCALATION_DECISIONS,
      handoff: saved,
    });

    expect(result.details).toMatchObject({
      outcome: BUILDER_HANDOFF_STATUSES.ESCALATION,
      phase: WORKFLOW_PHASES.ESCALATION_DECISIONS,
      handoff: { ...csvExportEscalation, version: '1.0.0', specId: SPEC_ID },
    });
  });

  it('given the builder saved no report and left builder-running unchanged when it reports completion then the run fails with an unexpected workflow phase error', async () => {
    const { paths, repository } = await createApprovedWorkflow();

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerRunBuilderTool,
    });

    vi.mocked(executeTask).mockImplementationOnce(async () => {
      return { text: 'Completed successfully' };
    });

    await expect(tool.execute('test-call', { specId: SPEC_ID })).rejects.toThrow(
      new Error(
        `Builder protocol error: Builder returned with unexpected workflow phase "${WORKFLOW_PHASES.BUILDER_RUNNING}"..`,
      ),
    );
    await expect(readWorkflowState(paths.getWorkflowPath(SPEC_ID))).resolves.toMatchObject({
      phase: WORKFLOW_PHASES.BUILDER_RUNNING,
    });
  });
});

it.each([
  { failure: 'model error', message: 'Provider unavailable', interrupted: false },
  { failure: 'interruption', message: 'Child interrupted', interrupted: true },
  { failure: 'missing handoff', message: 'Builder protocol error', interrupted: false },
])(
  'given a builder $failure with a saved session when execution stops then the path is displayed and the workflow stays builder-running without a handoff',
  async ({ failure, message, interrupted }) => {
    const { paths, repository } = await createApprovedWorkflow();

    const { tool, notify } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerRunBuilderTool,
    });

    const sessionFile = join(repository.path, 'child.jsonl');
    await writeFile(sessionFile, '{}\n');
    const cause = new Error(message);

    if (interrupted) cause.name = 'AbortError';
    vi.mocked(executeTask).mockImplementationOnce(async () => {
      if (failure === 'missing handoff') return { text: 'Completed successfully', sessionFile };
      throw new TaskExecutionError({ cause, sessionFile });
    });
    await expect(tool.execute('failed-run', { specId: SPEC_ID })).rejects.toThrow(message);
    expect(notify).toHaveBeenCalledExactlyOnceWith(`Saved child session: ${sessionFile}`, 'info');
    expect(executeTask).toHaveBeenCalledOnce();
    expect(await readWorkflowState(paths.getWorkflowPath(SPEC_ID))).toMatchObject({
      phase: WORKFLOW_PHASES.BUILDER_RUNNING,
    });
    await expect(
      access(paths.getBuilderHandoffPath({ specId: SPEC_ID, handoffPassNumber: 1 })),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  },
);

it('given a builder execution error without a saved session when execution stops then no session path is displayed', async () => {
  const { repository } = await createApprovedWorkflow();

  const { tool, notify } = await piTestSessions.createRegisteredTool({
    cwd: repository.path,
    extension: registerRunBuilderTool,
  });

  vi.mocked(executeTask).mockRejectedValueOnce(
    new TaskExecutionError({ cause: new Error('Failed before saving') }),
  );
  await expect(tool.execute('failed-run', { specId: SPEC_ID })).rejects.toThrow(
    'Failed before saving',
  );
  expect(notify).not.toHaveBeenCalled();
});

it.each([
  { simplifier: true, phase: WORKFLOW_PHASES.SIMPLIFIER_RUNNING },
  { simplifier: false, phase: WORKFLOW_PHASES.CANDIDATE_READY },
])(
  'given verifier disabled and simplifier=$simplifier when builder completes then $phase is saved without verifier delegation',
  async ({ simplifier, phase }) => {
    const { paths, repository } = await createApprovedWorkflow({
      agents: { verifier: { required: false }, simplifier: { required: simplifier } },
    });

    const { tool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: registerRunBuilderTool,
    });

    const { tool: childTool } = await piTestSessions.createRegisteredTool({
      cwd: repository.path,
      extension: (pi) => {
        pi.registerTool(recordBuilderHandoffTool);
      },
    });

    vi.mocked(executeTask).mockImplementationOnce(async () => {
      await childTool.execute('record-builder', { specId: SPEC_ID, ...doneHandoff() });

      return { text: 'Saved' };
    });
    const result = await tool.execute('builder-only', { specId: SPEC_ID });
    expect(result.details).toMatchObject({ phase, outcome: BUILDER_HANDOFF_STATUSES.DONE });
    expect(await readWorkflowState(paths.getWorkflowPath(SPEC_ID))).toMatchObject({ phase });
    expect(executeTask).toHaveBeenCalledOnce();
    expect(result.content).toEqual([
      {
        type: 'text',
        text: expect.stringContaining(
          simplifier
            ? 'Verifier skipped by configuration'
            : 'Verifier and simplifier skipped by configuration',
        ),
      },
    ]);
  },
);
