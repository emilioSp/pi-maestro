import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { branchExists } from '#git/branches/branchExists.ts';
import { createBranch } from '#git/branches/createBranch.ts';
import { deleteBranch } from '#git/branches/deleteBranch.ts';
import { runGitCommand } from '#git/command.ts';
import { createTemporaryRepository } from '#test/support/temp-repository.ts';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

describe('deleteBranch', () => {
  it('force-deletes a workflow branch whose candidate commit is not merged', async () => {
    const repository = await createTemporaryRepository();
    cleanups.push(repository.cleanup);
    await writeFile(join(repository.path, 'base.txt'), 'base\n', 'utf8');
    await repository.commit({ message: 'base' });
    await createBranch({
      repositoryRoot: repository.path,
      branch: 'verifier/spec/1',
      startPoint: 'main',
    });
    await runGitCommand({
      arguments: ['checkout', 'verifier/spec/1'],
      cwd: repository.path,
    });
    await writeFile(
      join(repository.path, 'candidate.txt'),
      'candidate\n',
      'utf8',
    );
    await repository.commit({ message: 'candidate' });
    await runGitCommand({
      arguments: ['checkout', 'main'],
      cwd: repository.path,
    });

    await deleteBranch({
      repositoryRoot: repository.path,
      branch: 'verifier/spec/1',
      force: true,
    });

    await expect(
      branchExists({
        repositoryRoot: repository.path,
        branch: 'verifier/spec/1',
      }),
    ).resolves.toBe(false);
  });
});
