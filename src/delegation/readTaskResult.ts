/**
 * Objective: Interpret a completed assistant reply without accessing session state.
 * Used: After the child becomes idle to return text or report its terminal failure.
 */

import type { AssistantMessage } from '@earendil-works/pi-ai';

export type TaskAssistantReply = Pick<AssistantMessage, 'content' | 'stopReason' | 'errorMessage'>;

export const readTaskResult = (assistant: TaskAssistantReply | undefined): string => {
  if (assistant?.stopReason === 'error') {
    throw new Error(assistant.errorMessage || 'Child model execution failed.');
  }

  if (assistant?.stopReason === 'aborted') {
    // Node.js provides DOMException too. Use its standard AbortError name to report
    // cancellation consistently with AbortSignal-based APIs, rather than a normal failure.
    throw new DOMException(assistant.errorMessage || 'Task execution interrupted.', 'AbortError');
  }

  return (
    assistant?.content
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('\n') ?? ''
  );
};
