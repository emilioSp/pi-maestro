import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getRepositoryStatus } from '#git/repository/getRepositoryStatus.ts';
import { createTemporaryRepository } from '#test/support/temp-repository.ts';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

describe('getRepositoryStatus', () => {
  it('reports staged, unstaged, and untracked files in the current checkout', async () => {
    const repository = await createTemporaryRepository();
    cleanups.push(repository.cleanup);
    await writeFile(join(repository.path, 'tracked.txt'), 'initial\n', 'utf8');
    await repository.commit({ message: 'Add tracked file' });
    await writeFile(join(repository.path, 'tracked.txt'), 'changed\n', 'utf8');
    await writeFile(
      join(repository.path, 'unstaged.txt'),
      'unstaged\n',
      'utf8',
    );
    await mkdir(join(repository.path, 'nested'), { recursive: true });
    await writeFile(
      join(repository.path, 'nested/untracked.txt'),
      'new\n',
      'utf8',
    );
    const status = await getRepositoryStatus({
      repositoryRoot: repository.path,
    });

    expect(status.clean).toBe(false);
    expect(status.unstaged).toContain('tracked.txt');
    expect(status.untracked).toContain('unstaged.txt');
    expect(status.untracked).toContain('nested/untracked.txt');
  });
});
