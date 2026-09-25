import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runGitCommand } from '#git/command.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
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

describe('repository status inspection', () => {
  it('ignores only untracked paths below the worktree directory', async () => {
    const repository = await createTemporaryRepository();
    cleanupFunctions.push(repository.cleanup);
    const worktreeDirectory = join(repository.path, '.worktree');

    await mkdir(join(worktreeDirectory, 'builder'), { recursive: true });
    await writeFile(
      join(worktreeDirectory, 'builder', 'generated.txt'),
      'generated\n',
      'utf8',
    );
    await writeFile(join(repository.path, 'owner.txt'), 'owner\n', 'utf8');

    await expect(
      getRepositoryStatus({
        repositoryRoot: repository.path,
        worktreeDirectory,
      }),
    ).resolves.toMatchObject({
      clean: false,
      staged: [],
      unstaged: [],
      untracked: ['owner.txt'],
    });
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
});
