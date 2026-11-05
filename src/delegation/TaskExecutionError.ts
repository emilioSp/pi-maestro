/**
 * Objective: Preserve task execution failures and their saved native session paths.
 * Used: When standalone SDK execution fails or is interrupted.
 */

type TaskExecutionErrorInput = {
  cause: unknown;
  sessionFile?: string;
};

export class TaskExecutionError extends Error {
  readonly sessionFile?: string;

  constructor({ cause, sessionFile }: TaskExecutionErrorInput) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.name =
      cause instanceof Error && cause.name === 'AbortError' ? 'AbortError' : 'TaskExecutionError';
    this.sessionFile = sessionFile;
  }
}
