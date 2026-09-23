import { mkdir, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findRepositoryRoot } from '#git/repository/findRepositoryRoot.ts';
import { createTemporaryRepository } from '#test/support/temp-repository.ts';

const cleanupFunctions: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
});

describe('repository root discovery', () => {
  it('discovers the repository root from a child directory', async () => {
    const repository = await createTemporaryRepository();
    cleanupFunctions.push(repository.cleanup);
    const child = join(repository.path, 'nested', 'child');
    await mkdir(child, { recursive: true });

    await expect(findRepositoryRoot({ cwd: child })).resolves.toBe(
      await realpath(repository.path),
    );
  });
});
