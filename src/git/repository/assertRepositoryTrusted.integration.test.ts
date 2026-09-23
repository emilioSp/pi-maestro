import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assertRepositoryTrusted } from '#git/repository/assertRepositoryTrusted.ts';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
import { createTemporaryRepository } from '#test/support/temp-repository.ts';

const cleanupFunctions: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
});

describe('repository trust inspection', () => {
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
