/**
 * Objective: Execute one independent task in a fresh, persisted native Pi conversation.
 * Used: By internal callers that await child executions sequentially, outside workflow routing.
 */

import { readTaskResult } from '#src/delegation/readTaskResult.ts';
import { SubSession, type SubSessionInput } from '#src/delegation/SubSession.ts';
import { TaskExecutionError } from '#src/delegation/TaskExecutionError.ts';

export type ExecuteTaskInput = SubSessionInput & {
  prompt: string;
};

export type TaskExecutionResult = {
  text: string;
  sessionFile?: string;
};

export const executeTask = async (input: ExecuteTaskInput): Promise<TaskExecutionResult> => {
  const subSession = new SubSession(input);

  try {
    try {
      const session = await subSession.open();
      await session.prompt(input.prompt, { expandPromptTemplates: false });

      const text = readTaskResult(
        session.messages.findLast((message) => message.role === 'assistant'),
      );

      return { text, sessionFile: subSession.getSavedFile() };
    } finally {
      await subSession.close();
    }
  } catch (cause) {
    throw new TaskExecutionError({ cause, sessionFile: subSession.getSavedFile() });
  }
};
