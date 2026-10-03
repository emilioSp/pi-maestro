import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createTemporaryRepository } from '#test/support/temp-repository.ts';
import { isProtectedSpecPath } from '#tools/child/utils/isProtectedSpecPath.ts';

const SPEC_ID = '20260321-143052-add-weather-alerts';

const cleanupFunctions: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
});

describe('protected spec path', () => {
  it('matches relative, absolute, prefixed, normalized, parent, and symlink paths', async () => {
    const repository = await createTemporaryRepository();
    cleanupFunctions.push(repository.cleanup);

    const specDirectory = join(repository.path, '.specs', SPEC_ID);
    const specPath = join(specDirectory, 'spec.md');
    const linkedDirectory = join(repository.path, 'linked-spec');

    await mkdir(specDirectory, { recursive: true });
    await writeFile(specPath, '# Approved specification\n', 'utf8');
    await symlink(specDirectory, linkedDirectory, 'dir');

    const protectedPaths = [
      `.specs/${SPEC_ID}/spec.md`,
      specPath,
      `@.specs/${SPEC_ID}/spec.md`,
      `@${specPath}`,
      `.specs/${SPEC_ID}/nested/../spec.md`,
      `.specs/${SPEC_ID}/../${SPEC_ID}/spec.md`,
      join(linkedDirectory, 'spec.md'),
    ];

    for (const targetPath of protectedPaths) {
      await expect(
        isProtectedSpecPath({
          repositoryRoot: repository.path,
          specPath,
          targetPath,
        }),
      ).resolves.toBe(true);
    }

    await expect(
      isProtectedSpecPath({
        repositoryRoot: repository.path,
        specPath,
        targetPath: 'README.md',
      }),
    ).resolves.toBe(false);
  });
});
