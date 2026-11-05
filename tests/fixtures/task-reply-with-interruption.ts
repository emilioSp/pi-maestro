/**
 * Objective: Supply an interrupted task reply with partial text and a cancellation diagnostic.
 * Used: To verify that interruption remains an AbortError rather than a successful result.
 */

import type { TaskAssistantReply } from '#src/delegation/readTaskResult.ts';

export const taskReplyWithInterruption: TaskAssistantReply = {
  stopReason: 'aborted',
  content: [{ type: 'text', text: 'Partial answer' }],
  errorMessage: 'Child interrupted.',
};
