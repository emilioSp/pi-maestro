import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runGitCommand } from '#git/command.ts';
import { createCommit } from '#git/commits/createCommit.ts';
import { findCommitByMessage } from '#git/commits/findCommitByMessage.ts';
import { getStagedPaths } from '#git/commits/getStagedPaths.ts';
import { getParentCommit } from '#git/history/getParentCommit.ts';
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

describe('checkpoint creation', () => {
  it('creates a checkpoint on the current branch with only expected paths', async () => {
    const repository = await createRepositoryWithCommit();
    await writeFile(join(repository.path, 'workflow.json'), '{}\n', 'utf8');
    const parent = await runGitCommand({
      arguments: ['rev-parse', 'HEAD'],
      cwd: repository.path,
    }).then(({ stdout }) => stdout.trim());

    const commit = await createCommit({
      repositoryRoot: repository.path,
      expectedPaths: [join(repository.path, 'workflow.json')],
      message: 'maestro checkpoint current',
    });

    await expect(
      findCommitByMessage({
        repositoryRoot: repository.path,
        message: 'maestro checkpoint current',
      }),
    ).resolves.toBe(commit);
    await expect(
      getStagedPaths({ repositoryRoot: repository.path }),
    ).resolves.toEqual([]);
    await expect(
      getParentCommit({ repositoryRoot: repository.path, commit }),
    ).resolves.toBe(parent);
  });

  it('rejects relative and outside checkpoint paths before staging', async () => {
    const repository = await createRepositoryWithCommit();

    await expect(
      createCommit({
        repositoryRoot: repository.path,
        expectedPaths: ['workflow.json'],
      }),
    ).rejects.toThrow('Checkpoint path must be inside the repository');
    await expect(
      createCommit({
        repositoryRoot: repository.path,
        expectedPaths: [join(repository.path, '..', 'outside.txt')],
      }),
    ).rejects.toThrow('Checkpoint path must be inside the repository');
    await expect(
      getStagedPaths({ repositoryRoot: repository.path }),
    ).resolves.toEqual([]);
  });

  it('rejects already staged paths outside the expected set on any branch', async () => {
    const repository = await createRepositoryWithCommit();
    await writeFile(join(repository.path, 'outside.txt'), 'outside\n', 'utf8');
    await writeFile(join(repository.path, 'workflow.json'), '{}\n', 'utf8');
    await runGitCommand({
      arguments: ['add', 'outside.txt'],
      cwd: repository.path,
    });

    await expect(
      createCommit({
        repositoryRoot: repository.path,
        expectedPaths: [join(repository.path, 'workflow.json')],
      }),
    ).rejects.toThrow('outside the expected set');
  });
});
