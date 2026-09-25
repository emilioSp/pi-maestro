import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runGitCommand } from '#git/command.ts';
import { squashCandidate } from '#git/final-review/squashCandidate.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
import { createTemporaryRepository } from '#test/support/temp-repository.ts';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

const createRepository = async () => {
  const repository = await createTemporaryRepository();
  cleanups.push(repository.cleanup);
  await writeFile(join(repository.path, 'product.txt'), 'base\n', 'utf8');
  await repository.commit({ message: 'base' });
  await runGitCommand({
    arguments: ['checkout', '-b', 'verifier/spec/1'],
    cwd: repository.path,
  });
  await writeFile(join(repository.path, 'product.txt'), 'candidate\n', 'utf8');
  await repository.commit({ message: 'candidate' });
  await runGitCommand({
    arguments: ['checkout', 'main'],
    cwd: repository.path,
  });
  return repository;
};

describe('squashCandidate', () => {
  it('stages candidate changes without creating a commit', async () => {
    const repository = await createRepository();
    const headBefore = await runGitCommand({
      arguments: ['rev-parse', 'HEAD'],
      cwd: repository.path,
    });

    await squashCandidate({
      repositoryRoot: repository.path,
      baseBranch: 'main',
      candidateBranch: 'verifier/spec/1',
      worktreeDirectory: join(repository.path, '.worktree'),
    });

    const status = await getRepositoryStatus({
      repositoryRoot: repository.path,
    });
    const headAfter = await runGitCommand({
      arguments: ['rev-parse', 'HEAD'],
      cwd: repository.path,
    });
    const content = await runGitCommand({
      arguments: ['show', ':product.txt'],
      cwd: repository.path,
    });
    expect(status.staged).toEqual(['product.txt']);
    expect(content.stdout).toBe('candidate\n');
    expect(headAfter.stdout).toBe(headBefore.stdout);
  });

  it('ignores untracked files below the managed worktree directory', async () => {
    const repository = await createRepository();
    const worktreeDirectory = join(repository.path, '.worktree');

    await mkdir(join(worktreeDirectory, 'builder', 'spec'), {
      recursive: true,
    });
    await writeFile(
      join(worktreeDirectory, 'builder', 'spec', 'generated.txt'),
      'generated\n',
      'utf8',
    );

    await squashCandidate({
      repositoryRoot: repository.path,
      baseBranch: 'main',
      candidateBranch: 'verifier/spec/1',
      worktreeDirectory,
    });

    await expect(
      getRepositoryStatus({ repositoryRoot: repository.path }),
    ).resolves.toMatchObject({ staged: ['product.txt'] });
  });

  it('rejects a dirty base branch before squashing', async () => {
    const repository = await createRepository();
    await writeFile(join(repository.path, 'owner.txt'), 'owner\n', 'utf8');

    await expect(
      squashCandidate({
        repositoryRoot: repository.path,
        baseBranch: 'main',
        candidateBranch: 'verifier/spec/1',
        worktreeDirectory: join(repository.path, '.worktree'),
      }),
    ).rejects.toThrow('dirty base branch');
  });
});
