import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CONFIG_DIRECTORY_NAME,
  CONFIG_FILE_PATH,
  DEFAULT_CONFIG_VERSION,
  DEFAULT_SPEC_DIRECTORY,
} from '#config/defaults.ts';
import { AGENTS } from '#config/schema.ts';
import { assertEnvironment } from '#maestro/checks/assertEnvironment.ts';
import piTestSessions from '#test/support/pi-session.ts';
import { createTemporaryProject } from '#test/support/temp-repository.ts';

const cleanupFunctions: Array<() => Promise<void>> = [];

afterEach(async () => {
  await piTestSessions.cleanup();
  await Promise.all(cleanupFunctions.splice(0).map((cleanup) => cleanup()));
});

describe('assertEnvironment', () => {
  it('given an untrusted project when the environment is checked then activation is rejected', async () => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);

    const { session } = await piTestSessions.create({
      cwd: repository.path,
      extensions: [],
      projectTrusted: false,
    });

    await expect(
      assertEnvironment(session.extensionRunner.createContext()),
    ).rejects.toThrow(`Project is not trusted: "${repository.path}".`);
  });

  it('given missing Maestro agents when the environment is checked then the agent error is reported', async () => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);

    const { session } = await piTestSessions.create({
      cwd: repository.path,
      extensions: [],
      maestroAgentsAvailable: false,
    });

    await expect(
      assertEnvironment(session.extensionRunner.createContext()),
    ).rejects.toThrow(
      `Builder or verifier agent check failed: Unknown agent: ${AGENTS.BUILDER}`,
    );
  });

  it('given invalid configuration when the environment is checked then the configuration error is reported', async () => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);
    await mkdir(join(repository.path, CONFIG_DIRECTORY_NAME));
    await writeFile(
      join(repository.path, CONFIG_FILE_PATH),
      JSON.stringify({ version: 999 }),
    );

    const { session } = await piTestSessions.create({
      cwd: repository.path,
      extensions: [],
    });

    await expect(
      assertEnvironment(session.extensionRunner.createContext()),
    ).rejects.toThrow('Maestro configuration check failed:');
  });

  it('given an unavailable configured model when the environment is checked then its exact name is reported', async () => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);
    await mkdir(join(repository.path, CONFIG_DIRECTORY_NAME));
    await writeFile(
      join(repository.path, CONFIG_FILE_PATH),
      JSON.stringify({
        version: DEFAULT_CONFIG_VERSION,
        builder: { model: 'openai-codex/missing' },
      }),
    );

    const { session } = await piTestSessions.create({
      cwd: repository.path,
      extensions: [],
    });

    await expect(
      assertEnvironment(session.extensionRunner.createContext()),
    ).rejects.toThrow(
      'Configured model is not available: "openai-codex/missing".',
    );
  });

  it('given a dirty repository and absent spec directory when checks pass then no files change', async () => {
    const repository = await createTemporaryProject();
    cleanupFunctions.push(repository.cleanup);
    await writeFile(join(repository.path, 'README.md'), '# Original\n');

    await writeFile(
      join(repository.path, 'README.md'),
      '# Uncommitted change\n',
    );

    const { session } = await piTestSessions.create({
      cwd: repository.path,
      extensions: [],
    });

    await expect(
      assertEnvironment(session.extensionRunner.createContext()),
    ).resolves.toBeUndefined();

    expect(await readFile(join(repository.path, 'README.md'), 'utf8')).toBe(
      '# Uncommitted change\n',
    );
    await expect(
      access(join(repository.path, DEFAULT_SPEC_DIRECTORY)),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
