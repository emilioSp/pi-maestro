import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it, onTestFinished } from 'vitest';

import { saveConfiguration } from '#config/saveConfiguration.ts';
import { TEST_CONFIG } from '#tests/fixtures/config/selected-agents.ts';
import { createTemporaryProject } from '#tests/support/temp-repository.ts';
import { resolveWorkflowContext } from '#tools/child/utils/resolveWorkflowContext.ts';

const SPEC_ID = '20260321-143052-add-weather-alerts';

describe('workflow context', () => {
  it('GIVEN a working directory symlink to a nested directory WHEN workflow context is loaded THEN the real nested directory is the project root and parent configuration is not inherited', async () => {
    const repository = await createTemporaryProject();
    onTestFinished(repository.cleanup);
    const childDirectory = join(repository.path, 'nested', 'child');
    await mkdir(childDirectory, { recursive: true });

    await mkdir(join(repository.path, '.pi'));
    await writeFile(
      join(repository.path, '.pi/maestro.json'),
      JSON.stringify({ version: '1.0.0', specDirectory: 'parent-specs' }),
    );
    await saveConfiguration({
      cwd: childDirectory,
      agentModelSelections: {
        builder: TEST_CONFIG.builder,
        verifier: TEST_CONFIG.verifier,
        simplifier: TEST_CONFIG.simplifier,
      },
    });
    const alias = join(repository.path, 'cwd-alias');
    await symlink(childDirectory, alias);

    const context = await resolveWorkflowContext({
      cwd: alias,
      specId: SPEC_ID,
    });

    expect(context.projectRoot).toBe(childDirectory);
    expect(context.paths.getProjectRoot()).toBe(childDirectory);
    expect(context.specId).toBe(SPEC_ID);
    expect(context.paths.getSpecDirectory()).toBe(join(childDirectory, '.specs'));
  });

  it('GIVEN an invalid spec ID WHEN workflow context is requested THEN loading fails with an invalid spec ID error', async () => {
    const repository = await createTemporaryProject();
    onTestFinished(repository.cleanup);

    await expect(
      resolveWorkflowContext({ cwd: repository.path, specId: 'invalid' }),
    ).rejects.toThrow('Invalid spec ID: "invalid".');
  });
});
