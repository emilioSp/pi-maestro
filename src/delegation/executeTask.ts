/**
 * Objective: Execute one independent task in a fresh, persisted native Pi conversation.
 * Used: By internal callers that await child executions sequentially, outside workflow routing.
 */

import { readTaskResult } from '#src/delegation/readTaskResult.ts';
import {
  SubSessionManager,
  type SubSessionManagerInput,
} from '#src/delegation/SubSessionManager.ts';
import { TaskExecutionError } from '#src/delegation/TaskExecutionError.ts';

export type ExecuteTaskInput = SubSessionManagerInput & {
  prompt: string;
};

export type TaskExecutionResult = {
  text: string;
  sessionFile?: string;
};

export const executeTask = async ({
  prompt,
  roleGuidance,
  cwd,
  model,
  thinkingLevel,
  additionalTools,
  signal,
}: ExecuteTaskInput): Promise<TaskExecutionResult> => {
  const subSessionManager = new SubSessionManager({
    roleGuidance,
    cwd,
    model,
    thinkingLevel,
    additionalTools,
    signal,
  });

  try {
    try {
      const session = await subSessionManager.open();
      await session.prompt(prompt, { expandPromptTemplates: false });

      const text = readTaskResult(
        session.messages.findLast((message) => message.role === 'assistant'),
      );

      return { text, sessionFile: subSessionManager.getSavedFile() };
    } finally {
      await subSessionManager.close();
    }
  } catch (cause) {
    throw new TaskExecutionError({ cause, sessionFile: subSessionManager.getSavedFile() });
  }
};
