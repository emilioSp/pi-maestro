import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createBranch } from '#git/branches/createBranch.ts';
import { fastForwardBranch } from '#git/branches/fastForwardBranch.ts';
import { runGitCommand } from '#git/command.ts';
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

describe('branch fast-forward', () => {
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
