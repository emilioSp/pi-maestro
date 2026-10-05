import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { GIT_COMMAND_ERROR_CODES, runGitCommand } from '#git/command.ts';
import { getCurrentBranch } from '#git/repository/getCurrentBranch.ts';
import { getHeadCommit } from '#git/repository/getHeadCommit.ts';
import { createTemporaryRepository } from '#test/support/temp-repository.ts';

const cleanupFunctions: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
});

describe('current branch inspection', () => {
  it('reads the current branch and HEAD commit', async () => {
    const repository = await createTemporaryRepository();
    cleanupFunctions.push(repository.cleanup);
    await writeFile(join(repository.path, 'README.md'), '# Test\n', 'utf8');
    const commit = await repository.commit('Initial commit');

    await expect(getCurrentBranch(repository.path)).resolves.toBe('main');
    await expect(getHeadCommit(repository.path)).resolves.toBe(commit);
  });

  it('rejects a detached HEAD', async () => {
    const repository = await createTemporaryRepository();
    cleanupFunctions.push(repository.cleanup);
    await writeFile(join(repository.path, 'README.md'), '# Test\n', 'utf8');
    await repository.commit('Initial commit');
    await runGitCommand({
      arguments: ['checkout', '--detach'],
      cwd: repository.path,
    });

    await expect(getCurrentBranch(repository.path)).rejects.toMatchObject({
      code: GIT_COMMAND_ERROR_CODES.COMMAND_FAILED,
    });
  });
});
