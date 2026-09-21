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

export type GitCommandErrorCode =
  | 'command-failed'
  | 'execution-failed'
  | 'not-found'
  | 'timeout';

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
  }: {
    code: GitCommandErrorCode;
    message: string;
    arguments: readonly string[];
    cwd: string;
    stdout: string;
    stderr: string;
    exitCode?: number | null;
    cause: unknown;
  }) {
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
  } catch (cause) {
    const error = cause as Error & {
      code?: string | number;
      killed?: boolean;
      stdout?: string;
      stderr?: string;
    };
    const stdout = error.stdout ?? '';
    const stderr = error.stderr ?? '';

    if (error.killed) {
      throw new GitCommandError({
        code: 'timeout',
        message: `Git command timed out after ${timeoutMs} ms.`,
        arguments: gitArguments,
        cwd,
        stdout,
        stderr,
        cause,
      });
    }

    if (error.code === 'ENOENT') {
      throw new GitCommandError({
        code: 'not-found',
        message: 'Git executable was not found.',
        arguments: gitArguments,
        cwd,
        stdout,
        stderr,
        cause,
      });
    }

    const exitCode = typeof error.code === 'number' ? error.code : null;
    throw new GitCommandError({
      code: exitCode === null ? 'execution-failed' : 'command-failed',
      message: `Git command failed: ${error.message}`,
      arguments: gitArguments,
      cwd,
      stdout,
      stderr,
      exitCode,
      cause,
    });
  }
};
