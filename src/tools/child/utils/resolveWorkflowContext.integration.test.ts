import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createTemporaryProject } from '#test/support/temp-repository.ts';
import { resolveWorkflowContext } from '#tools/child/utils/resolveWorkflowContext.ts';

const SPEC_ID = '20260321-143052-add-weather-alerts';

const cleanupFunctions: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
});

describe('workflow context', () => {
  it('uses the canonical child working directory without searching ancestors', async () => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);
    const childDirectory = join(repository.path, 'nested', 'child');
    await mkdir(childDirectory, { recursive: true });

    await mkdir(join(repository.path, '.pi'));
    await writeFile(
      join(repository.path, '.pi/maestro.json'),
      JSON.stringify({ version: '1.0.0', specDirectory: 'parent-specs' }),
    );
    const alias = join(repository.path, 'cwd-alias');
    await symlink(childDirectory, alias);

    const context = await resolveWorkflowContext({
      cwd: alias,
      specId: SPEC_ID,
    });

    expect(context.projectRoot).toBe(childDirectory);
    expect(context.paths.getProjectRoot()).toBe(childDirectory);
    expect(context.specId).toBe(SPEC_ID);
    expect(context.paths.getSpecDirectory()).toBe(
      join(childDirectory, '.specs'),
    );
  });

  it('rejects an invalid spec ID before resolving repository context', async () => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);

    await expect(
      resolveWorkflowContext({ cwd: repository.path, specId: 'invalid' }),
    ).rejects.toThrow('Invalid spec ID: "invalid".');
  });
});
