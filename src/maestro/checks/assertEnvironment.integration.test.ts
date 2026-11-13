/**
 * Objective: Check Maestro's read-only activation requirements.
 * Used: In integration tests with isolated Pi environments and offline Pi model registries.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi, onTestFinished } from 'vitest';

import {
  CONFIG_DIRECTORY_NAME,
  CONFIG_FILE_PATH,
  DEFAULT_CONFIG_VERSION,
} from '#config/defaults.ts';
import { assertEnvironment } from '#maestro/checks/assertEnvironment.ts';
import { TEST_CONFIG } from '#tests/fixtures/config/selected-agents.ts';
import piTestSessions from '#tests/support/pi-session.ts';
import { createTemporaryProject } from '#tests/support/temp-repository.ts';

afterEach(async () => {
  await piTestSessions.cleanup();
});

describe('assertEnvironment', () => {
  it('GIVEN configuration has a numeric version WHEN activation requirements are checked THEN the check fails with a configuration error', async () => {
    const repository = await createTemporaryProject();
    onTestFinished(repository.cleanup);
    await mkdir(join(repository.path, CONFIG_DIRECTORY_NAME));
    await writeFile(join(repository.path, CONFIG_FILE_PATH), JSON.stringify({ version: 999 }));

    const { session } = await piTestSessions.create({
      cwd: repository.path,
      extensions: [],
    });

    await expect(
      assertEnvironment({
        context: session.extensionRunner.createContext(),
      }),
    ).rejects.toThrow('Maestro configuration check failed:');
  });

  it.each(['builder', 'verifier', 'simplifier'])(
    'GIVEN the %s model is absent from Pi’s registry WHEN activation is checked THEN it reports the full unavailable ID',
    async (agent) => {
      const repository = await createTemporaryProject();
      onTestFinished(repository.cleanup);
      const model = 'openrouter/~openai/gpt-mini-latest';
      await mkdir(join(repository.path, CONFIG_DIRECTORY_NAME));
      await writeFile(
        join(repository.path, CONFIG_FILE_PATH),
        JSON.stringify({
          ...TEST_CONFIG,
          [agent]: { model },
        }),
      );

      const { session } = await piTestSessions.create({
        cwd: repository.path,
        extensions: [],
      });

      await expect(
        assertEnvironment({
          context: session.extensionRunner.createContext(),
        }),
      ).rejects.toThrow(`Configured model is not available: "${model}".`);
    },
  );
});

it.each([
  { verifier: false, simplifier: true },
  { verifier: true, simplifier: false },
  { verifier: false, simplifier: false },
])(
  'GIVEN verifier=$verifier and simplifier=$simplifier with only enabled models configured WHEN activation is checked THEN it succeeds without extension availability checks',
  async ({ verifier, simplifier }) => {
    const repository = await createTemporaryProject();
    onTestFinished(repository.cleanup);
    await mkdir(join(repository.path, CONFIG_DIRECTORY_NAME));
    await writeFile(
      join(repository.path, CONFIG_FILE_PATH),
      JSON.stringify({
        ...TEST_CONFIG,
        verifier: {
          ...TEST_CONFIG.verifier,
          required: verifier,
          ...(!verifier ? { model: 'missing/verifier' } : {}),
        },
        simplifier: {
          ...TEST_CONFIG.simplifier,
          required: simplifier,
          ...(!simplifier ? { model: 'missing/simplifier' } : {}),
        },
      }),
    );

    const { session } = await piTestSessions.create({
      cwd: repository.path,
      extensions: [],
    });

    await expect(
      assertEnvironment({ context: session.extensionRunner.createContext() }),
    ).resolves.toBeUndefined();
  },
);

it('GIVEN builder disabled and both later phases enabled with unavailable models WHEN activation is checked THEN it succeeds without model lookup', async () => {
  const repository = await createTemporaryProject();
  onTestFinished(repository.cleanup);
  await mkdir(join(repository.path, CONFIG_DIRECTORY_NAME));
  await writeFile(
    join(repository.path, CONFIG_FILE_PATH),
    JSON.stringify({
      version: DEFAULT_CONFIG_VERSION,
      builder: { required: false, model: 'missing/builder' },
      verifier: { required: true, model: 'missing/verifier' },
      simplifier: { required: true, model: 'missing/simplifier' },
    }),
  );

  const { session } = await piTestSessions.create({
    cwd: repository.path,
    extensions: [],
  });

  const context = session.extensionRunner.createContext();
  const available = vi.spyOn(context.modelRegistry, 'getAvailable').mockReturnValue([]);
  await expect(assertEnvironment({ context })).resolves.toBeUndefined();
  expect(available).not.toHaveBeenCalled();
});
