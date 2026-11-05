/**
 * Objective: Supply a task reply containing text and non-text content blocks.
 * Used: To verify that task result reading joins only the visible text.
 */

import type { TaskAssistantReply } from '#src/delegation/readTaskResult.ts';

export const taskReplyWithTextBlocks: TaskAssistantReply = {
  stopReason: 'stop',
  content: [
    { type: 'text', text: 'First line' },
    { type: 'thinking', thinking: 'Internal reasoning' },
    { type: 'toolCall', id: 'read-1', name: 'read', arguments: { path: 'value.txt' } },
    { type: 'text', text: 'Second line' },
  ],
};
