/**
 * Objective: Check configuration loading, path resolution, and file errors.
 * Used: In tests with temporary project configurations.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadConfiguration } from '#config/loadConfiguration.ts';
import { TEST_CONFIG } from '#tests/fixtures/config/selected-agents.ts';
import { createTemporaryProject } from '#tests/support/temp-repository.ts';

describe('configuration loading', () => {
  it('given no configuration file when configuration is loaded then the error requests interactive setup', async () => {
    const workspace = await createTemporaryProject();

    try {
      await expect(loadConfiguration(workspace.path)).rejects.toThrow(
        'Project configuration is missing',
      );
    } finally {
      await workspace.cleanup();
    }
  });

  it('given explicit agent settings when loaded then paths are resolved and settings are retained', async () => {
    const workspace = await createTemporaryProject();

    try {
      await mkdir(join(workspace.path, '.pi'));
      await writeFile(
        join(workspace.path, '.pi/maestro.json'),
        JSON.stringify({ ...TEST_CONFIG, specDirectory: 'custom-specs' }),
      );
      await expect(loadConfiguration(workspace.path)).resolves.toEqual({
        ...TEST_CONFIG,
        specDirectory: join(workspace.path, 'custom-specs'),
      });
    } finally {
      await workspace.cleanup();
    }
  });

  it('given broken JSON when loaded then the error names the configuration file', async () => {
    const workspace = await createTemporaryProject();

    try {
      await mkdir(join(workspace.path, '.pi'));

      const fixture = await readFile(
        new URL(import.meta.resolve('#tests/fixtures/config/invalid-json.json')),
        'utf8',
      );

      const path = join(workspace.path, '.pi/maestro.json');
      await writeFile(path, fixture);
      await expect(loadConfiguration(workspace.path)).rejects.toThrow(
        `Invalid JSON in configuration file "${path}"`,
      );
    } finally {
      await workspace.cleanup();
    }
  });

  it.each([
    {
      scenario: 'null byte',
      directory: 'specs\0',
      message: 'specDirectory must not contain a null byte.',
    },
    {
      scenario: 'absolute path',
      directory: '/outside',
      message: 'specDirectory must be relative to the project root.',
    },
    {
      scenario: 'project root',
      directory: 'nested/..',
      message: 'specDirectory must not be the project root.',
    },
    {
      scenario: 'outside path',
      directory: '../outside',
      message: 'specDirectory must stay inside the project root.',
    },
  ])(
    'given a $scenario directory when loaded then the path is rejected',
    async ({ directory, message }) => {
      const workspace = await createTemporaryProject();

      try {
        await mkdir(join(workspace.path, '.pi'));
        await writeFile(
          join(workspace.path, '.pi/maestro.json'),
          JSON.stringify({ ...TEST_CONFIG, specDirectory: directory }),
        );
        await expect(loadConfiguration(workspace.path)).rejects.toThrow(message);
      } finally {
        await workspace.cleanup();
      }
    },
  );
});
