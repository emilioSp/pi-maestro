import { access, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  branchExists,
  createBranch,
  deleteBranch,
  fastForwardBranch,
} from '#git/branches.ts';
import { runGitCommand } from '#git/command.ts';
import {
  createWorktree,
  findWorktree,
  removeWorktree,
} from '#git/worktrees.ts';
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

describe('Git branches and worktrees', () => {
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

  it('fast-forwards a branch only to a descendant commit', async () => {
    const repository = await createRepositoryWithCommit();
    await createBranch({
      repositoryRoot: repository.path,
      branch: 'builder/20260321-143052-add-weather-alerts',
      startPoint: 'main',
    });
    await writeFile(join(repository.path, 'next.txt'), 'next\n', 'utf8');
    await repository.commit({ message: 'Next commit' });

    await fastForwardBranch({
      repositoryRoot: repository.path,
      branch: 'builder/20260321-143052-add-weather-alerts',
      target: 'main',
    });
    const result = await runGitCommand({
      arguments: ['rev-parse', 'builder/20260321-143052-add-weather-alerts'],
      cwd: repository.path,
    });
    await expect(
      runGitCommand({ arguments: ['rev-parse', 'main'], cwd: repository.path }),
    ).resolves.toMatchObject({ stdout: result.stdout });
  });
});
