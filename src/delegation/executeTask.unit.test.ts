import type { AgentSession } from '@earendil-works/pi-coding-agent';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createChildServices } from '#src/delegation/createChildServices.ts';
import { executeTask, type ExecuteTaskInput } from '#src/delegation/executeTask.ts';
import * as subSessionModule from '#src/delegation/SubSession.ts';
import { TaskExecutionError } from '#src/delegation/TaskExecutionError.ts';
import { taskReplyWithTextBlocks } from '#tests/fixtures/task-reply-with-text-blocks.ts';

vi.mock('#src/delegation/createChildServices.ts', () => ({
  createChildServices: vi.fn<typeof createChildServices>(),
}));

describe('execute task', () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  it('given a successful child session when a task is executed then its final text and saved path are returned and the child is closed', async () => {
    const prompt = vi.fn<AgentSession['prompt']>().mockResolvedValue(undefined);

    const session = {
      prompt,
      messages: [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Previous answer' }],
          stopReason: 'stop',
        },
        { role: 'assistant', ...taskReplyWithTextBlocks },
      ],
    };

    const open = vi.fn<() => Promise<typeof session>>().mockResolvedValue(session);
    const close = vi.fn<subSessionModule.SubSession['close']>().mockResolvedValue(undefined);

    const getSavedFile = vi
      .fn<subSessionModule.SubSession['getSavedFile']>()
      .mockReturnValue('/sessions/project/subagents/task.jsonl');

    const constructor = vi
      .spyOn(subSessionModule, 'SubSession')
      .mockImplementationOnce(function () {
        Object.assign(this, {
          open,
          close,
          getSavedFile,
        });
      });

    const input: ExecuteTaskInput = {
      cwd: process.cwd(),
      prompt: 'Return two lines.',
      roleGuidance: 'Do not delegate.',
      model: 'unused/model',
      thinkingLevel: 'high',
      additionalTools: [],
    };

    await expect(executeTask(input)).resolves.toEqual({
      text: 'First line\nSecond line',
      sessionFile: '/sessions/project/subagents/task.jsonl',
    });
    expect(constructor).toHaveBeenCalledExactlyOnceWith(input);
    expect(open).toHaveBeenCalledOnce();
    expect(prompt).toHaveBeenCalledExactlyOnceWith('Return two lines.', {
      expandPromptTemplates: false,
    });
    expect(close).toHaveBeenCalledOnce();
    expect(prompt.mock.invocationCallOrder[0]).toBeLessThan(close.mock.invocationCallOrder[0]);
  });

  it('given resource discovery fails when a task is prepared then its diagnostic cause reaches the caller without a saved path', async () => {
    const cause = new Error('Resource discovery failed.');
    vi.mocked(createChildServices).mockRejectedValueOnce(cause);

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
