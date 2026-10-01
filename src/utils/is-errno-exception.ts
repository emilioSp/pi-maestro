/**
 * Objective: Identify filesystem errors that expose a Node error code.
 * Used: When filesystem operations handle specific error codes.
 */

export const isErrnoException = (
  error: unknown,
): error is NodeJS.ErrnoException =>
  error instanceof Error && 'code' in error && typeof error.code === 'string';
