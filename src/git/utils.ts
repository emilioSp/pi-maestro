/**
 * Objective: Provide shared Git command helpers.
 * Used: By Maestro Git modules when handling Git command results.
 * Entrypoint: hasGitExitCode().
 */

import { GIT_COMMAND_ERROR_CODES, GitCommandError } from '#git/command.ts';

export const hasGitExitCode = ({
  error,
  exitCode,
}: {
  error: unknown;
  exitCode: number;
}): boolean =>
  error instanceof GitCommandError &&
  error.code === GIT_COMMAND_ERROR_CODES.COMMAND_FAILED &&
  error.exitCode === exitCode;
