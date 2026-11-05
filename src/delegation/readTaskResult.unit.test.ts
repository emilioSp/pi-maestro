/**
 * Objective: Check pure task reply interpretation without a session or SDK mocks.
 * Used: To verify text extraction and terminal error diagnostics.
 */

import { describe, expect, it } from 'vitest';

import { readTaskResult } from '#src/delegation/readTaskResult.ts';
import { taskReplyWithInterruption } from '#tests/fixtures/task-reply-with-interruption.ts';
import { taskReplyWithProviderError } from '#tests/fixtures/task-reply-with-provider-error.ts';
import { taskReplyWithTextBlocks } from '#tests/fixtures/task-reply-with-text-blocks.ts';

describe('task reply interpretation', () => {
  it('given a reply with mixed content when its result is read then only text blocks are joined with newlines', () => {
    expect(readTaskResult(taskReplyWithTextBlocks)).toBe('First line\nSecond line');
  });

  it('given no assistant reply when its result is read then the result is an empty string', () => {
    expect(readTaskResult(undefined)).toBe('');
  });

  it.each([
    {
      label: 'provider diagnostic',
      reply: taskReplyWithProviderError,
      message: 'Provider unavailable.',
    },
    {
      label: 'missing diagnostic',
      reply: { ...taskReplyWithProviderError, errorMessage: undefined },
      message: 'Child model execution failed.',
    },
  ])(
    'given a failed reply with $label when its result is read then its error is thrown instead of partial text',
    ({ reply, message }) => {
      expect(() => readTaskResult(reply)).toThrowError(new Error(message));
    },
  );

  it.each([
    {
      label: 'child diagnostic',
      reply: taskReplyWithInterruption,
      message: 'Child interrupted.',
    },
    {
      label: 'missing diagnostic',
      reply: { ...taskReplyWithInterruption, errorMessage: undefined },
      message: 'Task execution interrupted.',
    },
  ])(
    'given an interrupted reply with $label when its result is read then AbortError is thrown instead of partial text',
    ({ reply, message }) => {
      expect(() => readTaskResult(reply)).toThrowError(
        expect.objectContaining({ name: 'AbortError', message }),
      );
    },
  );
});
