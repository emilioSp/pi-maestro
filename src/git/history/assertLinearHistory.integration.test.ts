import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runGitCommand } from '#git/command.ts';
import { assertLinearHistory } from '#git/history/assertLinearHistory.ts';
import { canFastForward } from '#git/history/canFastForward.ts';
import { getMergeBase } from '#git/history/getMergeBase.ts';
import { isAncestor } from '#git/history/isAncestor.ts';
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

describe('commit history verification', () => {
  it('verifies linear, divergent, and unrelated histories', async () => {
    const repository = await createRepositoryWithCommit();
    const initial = await runGit({
      repositoryRoot: repository.path,
      arguments: ['rev-parse', 'HEAD'],
    });
    await runGit({
      repositoryRoot: repository.path,
      arguments: ['branch', 'feature'],
    });
    await writeFile(join(repository.path, 'main.txt'), 'main\n', 'utf8');
    const main = await repository.commit({ message: 'Main commit' });

    await expect(
      assertLinearHistory({
        repositoryRoot: repository.path,
        base: initial,
        branch: main,
      }),
    ).resolves.toBeUndefined();
    await expect(
      canFastForward({
        repositoryRoot: repository.path,
        branch: initial,
        target: main,
      }),
    ).resolves.toBe(true);
    await expect(
      getMergeBase({
        repositoryRoot: repository.path,
        first: initial,
        second: main,
      }),
    ).resolves.toBe(initial);

    await runGit({
      repositoryRoot: repository.path,
      arguments: ['checkout', 'feature'],
    });
    await writeFile(join(repository.path, 'feature.txt'), 'feature\n', 'utf8');
    const feature = await repository.commit({ message: 'Feature commit' });
    await expect(
      assertLinearHistory({
        repositoryRoot: repository.path,
        base: main,
        branch: feature,
      }),
    ).rejects.toThrow('divergent histories');
    await expect(
      canFastForward({
        repositoryRoot: repository.path,
        branch: main,
        target: feature,
      }),
    ).resolves.toBe(false);
    await expect(
      isAncestor({
        repositoryRoot: repository.path,
        ancestor: initial,
        descendant: feature,
      }),
    ).resolves.toBe(true);

    await runGit({
      repositoryRoot: repository.path,
      arguments: ['checkout', '--orphan', 'unrelated'],
    });
    await runGit({
      repositoryRoot: repository.path,
      arguments: ['rm', '--cached', '--ignore-unmatch', '-r', '.'],
    });
    await writeFile(
      join(repository.path, 'unrelated.txt'),
      'unrelated\n',
      'utf8',
    );
    const unrelated = await repository.commit({ message: 'Unrelated commit' });
    await expect(
      assertLinearHistory({
        repositoryRoot: repository.path,
        base: main,
        branch: unrelated,
      }),
    ).rejects.toThrow('unrelated histories');
  });
});
