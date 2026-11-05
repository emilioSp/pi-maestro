/**
 * Objective: Supply a failed task reply that contains partial text and a provider diagnostic.
 * Used: To verify that execution failure is reported instead of returning partial text.
 */

import type { TaskAssistantReply } from '#src/delegation/readTaskResult.ts';

export const taskReplyWithProviderError: TaskAssistantReply = {
  stopReason: 'error',
  content: [{ type: 'text', text: 'Partial answer' }],
  errorMessage: 'Provider unavailable.',
};
