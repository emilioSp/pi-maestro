import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createTemporaryRepository } from '#test/support/temp-repository.ts';
import { getChildContext } from '#tools/child/utils/getChildContext.ts';

const SPEC_ID = '20260321-143052-add-weather-alerts';
const cleanupFunctions: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
});

describe('child context', () => {
  it('resolves the current repository from a nested child working directory', async () => {
    const repository = await createTemporaryRepository();
    cleanupFunctions.push(repository.cleanup);
    const childDirectory = join(repository.path, 'nested', 'child');
    await mkdir(childDirectory, { recursive: true });

    const context = await getChildContext({
      cwd: childDirectory,
      specId: SPEC_ID,
    });

    expect(context.repositoryRoot).toBe(repository.path);
    expect(context.paths.getRepositoryRoot()).toBe(repository.path);
    expect(context.specId).toBe(SPEC_ID);
  });

  it('rejects an invalid spec ID before resolving repository context', async () => {
    const repository = await createTemporaryRepository();
    cleanupFunctions.push(repository.cleanup);

    await expect(
      getChildContext({ cwd: repository.path, specId: 'invalid' }),
    ).rejects.toThrow('Invalid spec ID: "invalid".');
  });
});
