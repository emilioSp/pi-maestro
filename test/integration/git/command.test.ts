import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runGitCommand } from '#git/command.ts';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

const createTemporaryDirectory = async (): Promise<string> => {
  const path = await mkdtemp(join(tmpdir(), 'pi-maestro-git-command-'));
  temporaryDirectories.push(path);
  return path;
};

describe('Git command execution', () => {
  it('returns stdout, stderr, and the exit status', async () => {
    const result = await runGitCommand({ arguments: ['--version'] });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/^git version \d+\.\d+/);
    expect(result.stderr).toBe('');
  });

  it('passes arguments without shell interpolation', async () => {
    const cwd = await createTemporaryDirectory();
    const marker = join(cwd, 'interpolated');
    await expect(
      runGitCommand({
        arguments: ['rev-parse', `HEAD; touch ${marker}`],
        cwd,
      }),
    ).rejects.toMatchObject({ code: 'command-failed' });
    await expect(access(marker)).rejects.toThrow();
  });

  it('returns non-zero exits with their output', async () => {
    const cwd = await createTemporaryDirectory();
    await expect(
      runGitCommand({
        arguments: ['rev-parse', '--is-inside-work-tree'],
        cwd,
      }),
    ).rejects.toMatchObject({
      code: 'command-failed',
      exitCode: expect.any(Number),
      stderr: expect.stringContaining('not a git repository'),
    });
  });

  it('returns a structured error when Git is missing', async () => {
    await expect(
      runGitCommand({
        arguments: ['--version'],
        environment: { PATH: '' },
      }),
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  it('returns a structured error when Git cannot execute', async () => {
    const path = await createTemporaryDirectory();
    await writeFile(join(path, 'git'), '', 'utf8');

    await expect(
      runGitCommand({
        arguments: ['--version'],
        environment: { PATH: path },
      }),
    ).rejects.toMatchObject({ code: 'execution-failed' });
  });

  it('terminates a command after its timeout', async () => {
    await expect(
      runGitCommand({
        arguments: ['hash-object', '--stdin'],
        timeoutMs: 20,
      }),
    ).rejects.toMatchObject({ code: 'timeout' });
  });
});
