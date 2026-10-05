/**
 * Objective: Identify a Git command failure with a specific exit code.
 * Used: By Maestro Git modules when handling unsuccessful commands.
 */

import { GIT_COMMAND_ERROR_CODES, GitCommandError } from '#git/command.ts';

type HasGitExitCodeInput = {
  error: unknown;
  exitCode: number;
};

export const hasGitExitCode = ({
  error,
  exitCode,
}: HasGitExitCodeInput): boolean =>
  error instanceof GitCommandError &&
  error.code === GIT_COMMAND_ERROR_CODES.COMMAND_FAILED &&
  error.exitCode === exitCode;
