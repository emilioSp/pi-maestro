import { afterEach, describe, expect, it } from 'vitest';
import { GIT_COMMAND_ERROR_CODES } from '#git/command.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import { createTemporaryRepository } from '#test/support/temp-repository.ts';

const cleanupFunctions: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
});

describe('HEAD inspection', () => {
  it('rejects an unavailable HEAD before the first commit', async () => {
    const repository = await createTemporaryRepository();
    cleanupFunctions.push(repository.cleanup);

    await expect(
      getHeadCommit({ repositoryRoot: repository.path }),
    ).rejects.toMatchObject({
      code: GIT_COMMAND_ERROR_CODES.COMMAND_FAILED,
    });
  });
});
