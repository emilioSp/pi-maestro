import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '#config/defaults.ts';
import { loadConfiguration } from '#config/loadConfiguration.ts';
import { SUPPORTED_CONFIG_VERSION, THINKING_LEVELS } from '#config/schema.ts';

const createWorkspace = async (): Promise<{
  path: string;
  cleanup: () => Promise<void>;
}> => {
  const path = await realpath(await mkdtemp(join(tmpdir(), 'pi-maestro-')));

  return {
    path,
    cleanup: async () => rm(path, { force: true, recursive: true }),
  };
};

describe('configuration loading', () => {
  it('returns defaults when the configuration file is missing', async () => {
    const workspace = await createWorkspace();

    try {
      const config = await loadConfiguration(workspace.path);

      expect(config).toEqual({
        ...DEFAULT_CONFIG,
        specDirectory: join(workspace.path, '.specs'),
      });
      await expect(lstat(config.specDirectory)).rejects.toMatchObject({
        code: 'ENOENT',
      });
    } finally {
      await workspace.cleanup();
    }
  });

  it('loads a valid custom spec directory and agent settings', async () => {
    const workspace = await createWorkspace();
    const piDirectory = join(workspace.path, '.pi');
    await mkdir(piDirectory, { recursive: true });

    const fixture = await readFile(
      new URL(import.meta.resolve('#test/fixtures/config/valid-full.json')),
      'utf8',
    );

    await writeFile(join(piDirectory, 'maestro.json'), fixture, 'utf8');

    try {
      await expect(loadConfiguration(workspace.path)).resolves.toEqual({
        version: SUPPORTED_CONFIG_VERSION,
        specDirectory: join(workspace.path, 'custom-specs'),
        builder: {
          model: 'anthropic/claude-3-7-sonnet',
          thinking: THINKING_LEVELS.MAX,
          timeoutMinutes: 120,
        },
        verifier: {
          model: 'anthropic/claude-3-5-haiku',
          thinking: 'low',
          timeoutMinutes: 30,
        },
      });
    } finally {
      await workspace.cleanup();
    }
  });

  it('reports invalid JSON with the configuration path', async () => {
    const workspace = await createWorkspace();
    const piDirectory = join(workspace.path, '.pi');
    await mkdir(piDirectory, { recursive: true });
    const configPath = join(piDirectory, 'maestro.json');

    const fixture = await readFile(
      new URL(import.meta.resolve('#test/fixtures/config/invalid-json.json')),
      'utf8',
    );

    await writeFile(configPath, fixture, 'utf8');

    try {
      await expect(loadConfiguration(workspace.path)).rejects.toThrow(
        `Invalid JSON in configuration file "${configPath}":`,
      );
    } finally {
      await workspace.cleanup();
    }
  });

  it.each([
    {
      fixture: 'valid-partial-builder-timeout.json',
      specDirectory: DEFAULT_CONFIG.specDirectory,
      builder: { ...DEFAULT_CONFIG.builder, timeoutMinutes: 90 },
    },
    {
      fixture: 'valid-partial-directories.json',
      specDirectory: 'specs-dir',
      builder: DEFAULT_CONFIG.builder,
    },
  ])(
    'given $fixture when loaded then supplied values override defaults and other settings keep their defaults',
    async ({ fixture, specDirectory, builder }) => {
      const workspace = await createWorkspace();

      try {
        const piDirectory = join(workspace.path, '.pi');
        await mkdir(piDirectory, { recursive: true });

        const content = await readFile(
          new URL(import.meta.resolve(`#test/fixtures/config/${fixture}`)),
          'utf8',
        );

        await writeFile(join(piDirectory, 'maestro.json'), content, 'utf8');

        await expect(loadConfiguration(workspace.path)).resolves.toEqual({
          version: SUPPORTED_CONFIG_VERSION,
          specDirectory: join(workspace.path, specDirectory),
          builder,
          verifier: DEFAULT_CONFIG.verifier,
        });
      } finally {
        await workspace.cleanup();
      }
    },
  );
});
