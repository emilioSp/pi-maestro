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

const runGit = async ({
  repositoryRoot,
  arguments: gitArguments,
}: {
  repositoryRoot: string;
  arguments: string[];
}): Promise<string> => {
  const result = await runGitCommand({
    arguments: gitArguments,
    cwd: repositoryRoot,
  });
  return result.stdout.trim();
};

const createRepositoryWithCommit = async () => {
  const repository = await createTemporaryRepository();
  cleanupFunctions.push(repository.cleanup);
  await writeFile(join(repository.path, 'README.md'), '# Test\n', 'utf8');
  await repository.commit({ message: 'Initial commit' });
  return repository;
};

describe('checkpoint creation', () => {
  it('creates and finds a checkpoint that stages only expected paths', async () => {
    const repository = await createRepositoryWithCommit();
    await runGit({
      repositoryRoot: repository.path,
      arguments: [
        'checkout',
        '-b',
        'builder/20260321-143052-add-weather-alerts',
      ],
    });
    await writeFile(join(repository.path, 'workflow.json'), '{}\n', 'utf8');

    const commit = await createCommit({
      repositoryRoot: repository.path,
      expectedPaths: ['workflow.json'],
      message: 'maestro checkpoint B1',
    });

    await expect(
      findCommitByMessage({
        repositoryRoot: repository.path,
        message: 'maestro checkpoint B1',
      }),
    ).resolves.toBe(commit);
    await expect(
      getStagedPaths({ repositoryRoot: repository.path }),
    ).resolves.toEqual([]);
    await expect(
      getParentCommit({ repositoryRoot: repository.path, commit }),
    ).resolves.toBe(
      await runGit({
        repositoryRoot: repository.path,
        arguments: ['rev-parse', 'main'],
      }),
    );
  });

  it('refuses a checkpoint on the base branch and staged paths outside its expected set', async () => {
    const repository = await createRepositoryWithCommit();
    await writeFile(join(repository.path, 'workflow.json'), '{}\n', 'utf8');

    await expect(
      createCommit({
        repositoryRoot: repository.path,
        expectedPaths: ['workflow.json'],
      }),
    ).rejects.toThrow('non-workflow branch: main');

    await runGit({
      repositoryRoot: repository.path,
      arguments: [
        'checkout',
        '-b',
        'builder/20260321-143052-add-weather-alerts',
      ],
    });
    await writeFile(join(repository.path, 'outside.txt'), 'outside\n', 'utf8');
    await runGit({
      repositoryRoot: repository.path,
      arguments: ['add', 'outside.txt'],
    });

    await expect(
      createCommit({
        repositoryRoot: repository.path,
        expectedPaths: ['workflow.json'],
      }),
    ).rejects.toThrow('outside the expected set');
  });
});
