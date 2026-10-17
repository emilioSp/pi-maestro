/**
 * Objective: Check configuration loading, defaults, and file errors.
 * Used: In tests with temporary project configuration files.
 */

import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DEFAULT_CONFIG } from '#config/defaults.ts';
import { loadConfiguration } from '#config/loadConfiguration.ts';
import { SUPPORTED_CONFIG_VERSION, THINKING_LEVELS } from '#config/schema.ts';
import { createTemporaryProject } from '#tests/support/temp-repository.ts';

describe('configuration loading', () => {
  it('given no configuration file when configuration is loaded then defaults use the project spec path without creating its directory', async () => {
    const workspace = await createTemporaryProject();

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

  it('given custom configuration for the spec directory, builder, and verifier when loaded then those values are used and the simplifier keeps its defaults', async () => {
    const workspace = await createTemporaryProject();
    const piDirectory = join(workspace.path, '.pi');
    await mkdir(piDirectory, { recursive: true });

    const fixture = await readFile(
      new URL(import.meta.resolve('#tests/fixtures/config/valid-full.json')),
      'utf8',
    );

    await writeFile(join(piDirectory, 'maestro.json'), fixture, 'utf8');

    try {
      await expect(loadConfiguration(workspace.path)).resolves.toEqual({
        version: SUPPORTED_CONFIG_VERSION,
        specDirectory: join(workspace.path, 'custom-specs'),
        simplifier: DEFAULT_CONFIG.simplifier,
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

  it.each([
    {
      scenario: 'no simplifier settings',
      simplifier: undefined,
      timeoutMinutes: 60,
    },
    {
      scenario: 'only a 90-minute simplifier timeout',
      simplifier: { timeoutMinutes: 90 },
      timeoutMinutes: 90,
    },
  ])(
    'given configuration with $scenario when loaded then the simplifier uses its default model and thinking with a $timeoutMinutes-minute timeout and other agents keep their defaults',
    async ({ simplifier, timeoutMinutes }) => {
      const workspace = await createTemporaryProject();

      try {
        await mkdir(join(workspace.path, '.pi'));
        await writeFile(
          join(workspace.path, '.pi/maestro.json'),
          JSON.stringify({ version: '1.0.0', simplifier }),
        );
        const config = await loadConfiguration(workspace.path);
        expect(config.simplifier).toEqual({
          model: 'openai-codex/gpt-6.1-sol',
          thinking: 'high',
          timeoutMinutes,
        });
        expect(config.builder).toEqual(DEFAULT_CONFIG.builder);
        expect(config.verifier).toEqual(DEFAULT_CONFIG.verifier);
      } finally {
        await workspace.cleanup();
      }
    },
  );

  it('given a simplifier timeout of zero when configuration is loaded then loading fails and identifies simplifier.timeoutMinutes', async () => {
    const workspace = await createTemporaryProject();

    try {
      await mkdir(join(workspace.path, '.pi'));
      await writeFile(
        join(workspace.path, '.pi/maestro.json'),
        JSON.stringify({ version: '1.0.0', simplifier: { timeoutMinutes: 0 } }),
      );
      await expect(loadConfiguration(workspace.path)).rejects.toThrow(
        'Invalid timeout at "simplifier.timeoutMinutes"',
      );
    } finally {
      await workspace.cleanup();
    }
  });

  it('given a configuration file with broken JSON when configuration is loaded then loading fails and the error names the file path', async () => {
    const workspace = await createTemporaryProject();
    const piDirectory = join(workspace.path, '.pi');
    await mkdir(piDirectory, { recursive: true });
    const configPath = join(piDirectory, 'maestro.json');

    const fixture = await readFile(
      new URL(import.meta.resolve('#tests/fixtures/config/invalid-json.json')),
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
      scenario: 'a null byte in the spec directory',
      specDirectory: 'specs\0',
      message: 'specDirectory must not contain a null byte.',
    },
    {
      scenario: 'an absolute spec directory',
      specDirectory: '/outside',
      message: 'specDirectory must be relative to the project root.',
    },
    {
      scenario: 'a spec directory equal to project root',
      specDirectory: 'nested/..',
      message: 'specDirectory must not be the project root.',
    },
    {
      scenario: 'a spec directory outside the project',
      specDirectory: '../outside',
      message: 'specDirectory must stay inside the project root.',
    },
  ])(
    'given $scenario when configuration is loaded then loading fails with the specific spec directory error',
    async ({ specDirectory, message }) => {
      const workspace = await createTemporaryProject();

      try {
        const piDirectory = join(workspace.path, '.pi');
        await mkdir(piDirectory, { recursive: true });
        await writeFile(
          join(piDirectory, 'maestro.json'),
          JSON.stringify({ version: SUPPORTED_CONFIG_VERSION, specDirectory }),
          'utf8',
        );

        await expect(loadConfiguration(workspace.path)).rejects.toThrow(message);
      } finally {
        await workspace.cleanup();
      }
    },
  );

  it.each([
    {
      scenario: 'only a custom builder timeout',
      fixture: 'valid-partial-builder-timeout.json',
      specDirectory: DEFAULT_CONFIG.specDirectory,
      builder: { ...DEFAULT_CONFIG.builder, timeoutMinutes: 90 },
    },
    {
      scenario: 'only a custom spec directory',
      fixture: 'valid-partial-directories.json',
      specDirectory: 'specs-dir',
      builder: DEFAULT_CONFIG.builder,
    },
  ])(
    'given configuration with $scenario when loaded then the supplied value overrides its default and all other settings keep their defaults',
    async ({ fixture, specDirectory, builder }) => {
      const workspace = await createTemporaryProject();

      try {
        const piDirectory = join(workspace.path, '.pi');
        await mkdir(piDirectory, { recursive: true });

        const content = await readFile(
          new URL(import.meta.resolve(`#tests/fixtures/config/${fixture}`)),
          'utf8',
        );

        await writeFile(join(piDirectory, 'maestro.json'), content, 'utf8');

        await expect(loadConfiguration(workspace.path)).resolves.toEqual({
          version: SUPPORTED_CONFIG_VERSION,
          specDirectory: join(workspace.path, specDirectory),
          builder,
          verifier: DEFAULT_CONFIG.verifier,
          simplifier: DEFAULT_CONFIG.simplifier,
        });
      } finally {
        await workspace.cleanup();
      }
    },
  );
});
