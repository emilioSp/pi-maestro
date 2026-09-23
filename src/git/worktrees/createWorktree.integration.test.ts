import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { branchExists } from '#git/branches/branchExists.ts';
import { createBranch } from '#git/branches/createBranch.ts';
import { createWorktree } from '#git/worktrees/createWorktree.ts';
import { findWorktree } from '#git/worktrees/findWorktree.ts';
import { createTemporaryRepository } from '#test/support/temp-repository.ts';

const cleanupFunctions: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
});

const createRepositoryWithCommit = async () => {
  const repository = await createTemporaryRepository();
  cleanupFunctions.push(repository.cleanup);
  await writeFile(join(repository.path, 'README.md'), '# Test\n', 'utf8');
  await repository.commit({ message: 'Initial commit' });
  return repository;
};

describe('worktree creation', () => {
  it('creates builder and verifier worktrees with deterministic branches', async () => {
    const repository = await createRepositoryWithCommit();
    const specId = '20260321-143052-add-weather-alerts';
    const worktreeDirectory = join(repository.path, '.worktree');
    const builderBranch = `builder/${specId}`;
    const verifierBranch = `verifier/${specId}/2`;
    const builderPath = join(worktreeDirectory, 'builder', specId);
    const verifierPath = join(worktreeDirectory, 'verifier', specId, '2');

    await createBranch({
      repositoryRoot: repository.path,
      branch: builderBranch,
      startPoint: 'main',
    });
    await createWorktree({
      repositoryRoot: repository.path,
      path: builderPath,
      branch: builderBranch,
    });
    await createBranch({
      repositoryRoot: repository.path,
      branch: verifierBranch,
      startPoint: builderBranch,
    });
    await createWorktree({
      repositoryRoot: repository.path,
      path: verifierPath,
      branch: verifierBranch,
    });

    await expect(
      findWorktree({ repositoryRoot: repository.path, path: builderPath }),
    ).resolves.toMatchObject({ branch: builderBranch });
    await expect(
      findWorktree({ repositoryRoot: repository.path, path: verifierPath }),
    ).resolves.toMatchObject({ branch: verifierBranch });
  });

  it('blocks an existing worktree path without changing its branch', async () => {
    const repository = await createRepositoryWithCommit();
    const path = join(repository.path, '.worktree', 'builder', 'foreign');
    await mkdir(path, { recursive: true });

    await createBranch({
      repositoryRoot: repository.path,
      branch: 'builder/20260321-143052-add-weather-alerts',
      startPoint: 'main',
    });
    await expect(
      createWorktree({
        repositoryRoot: repository.path,
        path,
        branch: 'builder/20260321-143052-add-weather-alerts',
      }),
    ).rejects.toThrow('Worktree path already exists:');
    await expect(
      branchExists({
        repositoryRoot: repository.path,
        branch: 'builder/20260321-143052-add-weather-alerts',
      }),
    ).resolves.toBe(true);
  });
});
