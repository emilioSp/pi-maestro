import { access, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTemporaryProject } from '#test/support/temp-repository.ts';

describe('temporary project support', () => {
  it('creates an isolated project and removes it during cleanup', async () => {
    const project = await createTemporaryProject();

    try {
      await writeFile(join(project.path, 'message.txt'), 'hello\n', 'utf8');
      await expect(
        access(join(project.path, 'message.txt')),
      ).resolves.toBeUndefined();
    } finally {
      await project.cleanup();
    }

    await expect(access(project.path)).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});
