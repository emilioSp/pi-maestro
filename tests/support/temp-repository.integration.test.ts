import { access, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTemporaryProject } from '#tests/support/temp-repository.ts';

describe('temporary project support', () => {
  it('given a temporary project when a file is written and cleanup runs then the file is writable before cleanup and the project directory no longer exists afterward', async () => {
    const project = await createTemporaryProject();

    try {
      await writeFile(join(project.path, 'message.txt'), 'hello\n', 'utf8');
      await expect(access(join(project.path, 'message.txt'))).resolves.toBeUndefined();
    } finally {
      await project.cleanup();
    }

    await expect(access(project.path)).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});
