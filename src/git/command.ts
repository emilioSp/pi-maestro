/**
 * Objective: Run Git commands with consistent errors and timeouts.
 * Used: By Maestro Git modules for every Git operation.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const DEFAULT_GIT_TIMEOUT_MS = 10_000;

export type GitCommandResult = {
  arguments: readonly string[];
  cwd: string;
  stdout: string;
  stderr: string;
  exitCode: number;
};

export const GIT_COMMAND_ERROR_CODES = {
  COMMAND_FAILED: 'command-failed',
  EXECUTION_FAILED: 'execution-failed',
  NOT_FOUND: 'not-found',
  TIMEOUT: 'timeout',
} as const;

export type GitCommandErrorCode =
  (typeof GIT_COMMAND_ERROR_CODES)[keyof typeof GIT_COMMAND_ERROR_CODES];

type GitCommandErrorInput = {
  code: GitCommandErrorCode;
  message: string;
  arguments: readonly string[];
  cwd: string;
  stdout: string;
  stderr: string;
  exitCode?: number | null;
  cause: unknown;
};

export class GitCommandError extends Error {
  readonly code: GitCommandErrorCode;
  readonly arguments: readonly string[];
  readonly cwd: string;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;

  constructor({
    code,
    message,
    arguments: gitArguments,
    cwd,
    stdout,
    stderr,
    exitCode = null,
    cause,
  }: GitCommandErrorInput) {
    super(message, { cause });
    this.name = 'GitCommandError';
    this.code = code;
    this.arguments = gitArguments;
    this.cwd = cwd;
    this.stdout = stdout;
    this.stderr = stderr;
    this.exitCode = exitCode;
  }
}

type GitExecutionError = {
  message: string;
  code?: string | number;
  killed?: boolean;
  stdout?: string;
  stderr?: string;
};

const isGitExecutionError = (value: unknown): value is GitExecutionError =>
  value instanceof Error;

const isNumericExitCode = (value: unknown): value is number =>
  typeof value === 'number';

type RunGitCommandInput = {
  arguments: readonly string[];
  cwd?: string;
  timeoutMs?: number;
  environment?: NodeJS.ProcessEnv;
};

// git <arguments>
export const runGitCommand = async ({
  arguments: gitArguments,
  cwd = process.cwd(),
  timeoutMs = DEFAULT_GIT_TIMEOUT_MS,
  environment,
}: RunGitCommandInput): Promise<GitCommandResult> => {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError('Git command timeout must be a positive integer.');
  }

  try {
    const { stdout, stderr } = await execFileAsync('git', [...gitArguments], {
      cwd,
      encoding: 'utf8',
      env: environment,
      killSignal: 'SIGKILL',
      timeout: timeoutMs,
      windowsHide: true,
    });

    return {
      arguments: gitArguments,
      cwd,
      stdout,
      stderr,
      exitCode: 0,
    };
  } catch (error) {
    const executionError: GitExecutionError = isGitExecutionError(error)
      ? error
      : new Error('Git command failed with an unknown error.', {
          cause: error,
        });

    const stdout = executionError.stdout ?? '';
    const stderr = executionError.stderr ?? '';

    if (executionError.killed) {
      throw new GitCommandError({
        code: GIT_COMMAND_ERROR_CODES.TIMEOUT,
        message: `Git command timed out after ${timeoutMs} ms.`,
        arguments: gitArguments,
        cwd,
        stdout,
        stderr,
        cause: error,
      });
    }

    if (executionError.code === 'ENOENT') {
      throw new GitCommandError({
        code: GIT_COMMAND_ERROR_CODES.NOT_FOUND,
        message: 'Git executable was not found.',
        arguments: gitArguments,
        cwd,
        stdout,
        stderr,
        cause: error,
      });
    }

    const exitCode = isNumericExitCode(executionError.code)
      ? executionError.code
      : null;

    throw new GitCommandError({
      code:
        exitCode === null
          ? GIT_COMMAND_ERROR_CODES.EXECUTION_FAILED
          : GIT_COMMAND_ERROR_CODES.COMMAND_FAILED,
      message: `Git command failed: ${executionError.message}`,
      arguments: gitArguments,
      cwd,
      stdout,
      stderr,
      exitCode,
      cause: error,
    });
  }
};
