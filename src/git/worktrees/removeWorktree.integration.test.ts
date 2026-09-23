import { access, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { branchExists } from '#git/branches/branchExists.ts';
import { createBranch } from '#git/branches/createBranch.ts';
import { deleteBranch } from '#git/branches/deleteBranch.ts';
import { createWorktree } from '#git/worktrees/createWorktree.ts';
import { removeWorktree } from '#git/worktrees/removeWorktree.ts';
import { createTemporaryRepository } from '#test/support/temp-repository.ts';

const cleanupFunctions: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
});

const expectMissing = async (path: string): Promise<void> => {
  await expect(access(path)).rejects.toMatchObject({ code: 'ENOENT' });
};

const createRepositoryWithCommit = async () => {
  const repository = await createTemporaryRepository();
  cleanupFunctions.push(repository.cleanup);
  await writeFile(join(repository.path, 'README.md'), '# Test\n', 'utf8');
  await repository.commit({ message: 'Initial commit' });
  return repository;
};

describe('worktree cleanup', () => {
  it('refuses dirty, mismatched, and foreign worktree cleanup', async () => {
    const repository = await createRepositoryWithCommit();
    const worktreeDirectory = join(repository.path, '.worktree');
    const path = join(
      worktreeDirectory,
      'builder',
      '20260321-143052-add-weather-alerts',
    );
    const branch = 'builder/20260321-143052-add-weather-alerts';
    await createBranch({
      repositoryRoot: repository.path,
      branch,
      startPoint: 'main',
    });
    await createWorktree({ repositoryRoot: repository.path, path, branch });
    await writeFile(join(path, 'dirty.txt'), 'dirty\n', 'utf8');

    await expect(
      removeWorktree({
        repositoryRoot: repository.path,
        path,
        branch,
        worktreeDirectory,
      }),
    ).rejects.toThrow('Refusing to remove dirty worktree at');
    await expect(
      removeWorktree({
        repositoryRoot: repository.path,
        path,
        branch: 'builder/other',
        worktreeDirectory,
      }),
    ).rejects.toThrow('expected branch builder/other');
    await expect(
      removeWorktree({
        repositoryRoot: repository.path,
        path: repository.path,
        branch: 'main',
        worktreeDirectory,
      }),
    ).rejects.toThrow('outside Maestro directory');
  });

  it('removes a clean worktree in a custom directory', async () => {
    const repository = await createRepositoryWithCommit();
    const worktreeDirectory = join(repository.path, 'custom-worktrees');
    const path = join(
      worktreeDirectory,
      'verifier',
      '20260321-143052-add-weather-alerts',
      '1',
    );
    const branch = 'verifier/20260321-143052-add-weather-alerts/1';
    await createBranch({
      repositoryRoot: repository.path,
      branch,
      startPoint: 'main',
    });
    await createWorktree({ repositoryRoot: repository.path, path, branch });

    await removeWorktree({
      repositoryRoot: repository.path,
      path,
      branch,
      worktreeDirectory,
    });
    await expectMissing(path);
    await expect(access(worktreeDirectory)).resolves.toBeUndefined();
    await deleteBranch({ repositoryRoot: repository.path, branch });
    await expect(
      branchExists({ repositoryRoot: repository.path, branch }),
    ).resolves.toBe(false);
  });
});
