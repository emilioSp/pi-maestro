import { mkdir, realpath, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runGitCommand } from '#git/command.ts';
import {
  assertRepositoryTrusted,
  findRepositoryRoot,
  getCurrentBranch,
  getHeadCommit,
  getRepositoryStatus,
} from '#git/repository.ts';
import { createTemporaryRepository } from '#test/support/temp-repository.ts';

const cleanupFunctions: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
});

const runGit = async ({
  arguments: gitArguments,
  cwd,
}: {
  arguments: string[];
  cwd: string;
}): Promise<void> => {
  const result = await runGitCommand({ arguments: gitArguments, cwd });
  expect(result.exitCode).toBe(0);
};

describe('Git repository inspection', () => {
  it('discovers the repository root from a child directory', async () => {
    const repository = await createTemporaryRepository();
    cleanupFunctions.push(repository.cleanup);
    const child = join(repository.path, 'nested', 'child');
    await mkdir(child, { recursive: true });

    await expect(findRepositoryRoot({ cwd: child })).resolves.toBe(
      await realpath(repository.path),
    );
  });

  it('reads the current branch and HEAD commit', async () => {
    const repository = await createTemporaryRepository();
    cleanupFunctions.push(repository.cleanup);
    await writeFile(join(repository.path, 'README.md'), '# Test\n', 'utf8');
    const commit = await repository.commit({ message: 'Initial commit' });

    await expect(
      getCurrentBranch({ repositoryRoot: repository.path }),
    ).resolves.toBe('main');
    await expect(
      getHeadCommit({ repositoryRoot: repository.path }),
    ).resolves.toBe(commit);
  });

  it('rejects a detached HEAD', async () => {
    const repository = await createTemporaryRepository();
    cleanupFunctions.push(repository.cleanup);
    await writeFile(join(repository.path, 'README.md'), '# Test\n', 'utf8');
    await repository.commit({ message: 'Initial commit' });
    await runGit({
      arguments: ['checkout', '--detach'],
      cwd: repository.path,
    });

    await expect(
      getCurrentBranch({ repositoryRoot: repository.path }),
    ).rejects.toMatchObject({ code: 'command-failed' });
  });

  it('rejects an unavailable HEAD before the first commit', async () => {
    const repository = await createTemporaryRepository();
    cleanupFunctions.push(repository.cleanup);

    await expect(
      getHeadCommit({ repositoryRoot: repository.path }),
    ).rejects.toMatchObject({ code: 'command-failed' });
  });

  it('distinguishes staged, unstaged, and untracked state without changing it', async () => {
    const repository = await createTemporaryRepository();
    cleanupFunctions.push(repository.cleanup);
    const tracked = join(repository.path, 'tracked.txt');
    await writeFile(tracked, 'initial\n', 'utf8');
    await repository.commit({ message: 'Initial commit' });

    await expect(
      getRepositoryStatus({ repositoryRoot: repository.path }),
    ).resolves.toEqual({
      clean: true,
      staged: [],
      unstaged: [],
      untracked: [],
    });

    await writeFile(tracked, 'staged\n', 'utf8');
    await runGit({ arguments: ['add', 'tracked.txt'], cwd: repository.path });
    await writeFile(tracked, 'unstaged\n', 'utf8');
    await writeFile(join(repository.path, 'untracked.txt'), 'new\n', 'utf8');

    const status = await getRepositoryStatus({
      repositoryRoot: repository.path,
    });
    expect(status).toEqual({
      clean: false,
      staged: ['tracked.txt'],
      unstaged: ['tracked.txt'],
      untracked: ['untracked.txt'],
    });

    const statusAgain = await getRepositoryStatus({
      repositoryRoot: repository.path,
    });
    expect(statusAgain).toEqual(status);
  });

  it('checks repository trust without modifying repository state', async () => {
    const repository = await createTemporaryRepository();
    cleanupFunctions.push(repository.cleanup);
    await writeFile(join(repository.path, 'untracked.txt'), 'new\n', 'utf8');
    const before = await getRepositoryStatus({
      repositoryRoot: repository.path,
    });

    await expect(
      assertRepositoryTrusted({ repositoryRoot: repository.path }),
    ).resolves.toBeUndefined();
    await expect(
      getRepositoryStatus({ repositoryRoot: repository.path }),
    ).resolves.toEqual(before);
  });
});
