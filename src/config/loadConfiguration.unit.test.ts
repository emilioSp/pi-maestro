import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '#config/defaults.ts';
import { loadConfiguration } from '#config/loadConfiguration.ts';
import { SUPPORTED_CONFIG_VERSION, THINKING_LEVELS } from '#config/schema.ts';

const fixturePath = (fileName: string): string =>
  fileURLToPath(import.meta.resolve(`#test/fixtures/config/${fileName}`));

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
      const config = await loadConfiguration({ cwd: workspace.path });

      expect(config).toEqual({
        ...DEFAULT_CONFIG,
        specDirectory: join(workspace.path, '.specs'),
      });
    } finally {
      await workspace.cleanup();
    }
  });

  it('loads a valid custom spec directory and agent settings', async () => {
    const workspace = await createWorkspace();
    const piDirectory = join(workspace.path, '.pi');
    await mkdir(piDirectory, { recursive: true });
    await writeFile(
      join(piDirectory, 'maestro.json'),
      JSON.stringify({
        version: SUPPORTED_CONFIG_VERSION,
        specDirectory: 'custom-specs',
        builder: {
          model: 'anthropic/claude-3-7-sonnet',
          thinking: THINKING_LEVELS.MAX,
          timeoutMinutes: 120,
        },
      }),
      'utf8',
    );

    try {
      await expect(loadConfiguration({ cwd: workspace.path })).resolves.toEqual(
        {
          version: SUPPORTED_CONFIG_VERSION,
          specDirectory: join(workspace.path, 'custom-specs'),
          builder: {
            model: 'anthropic/claude-3-7-sonnet',
            thinking: THINKING_LEVELS.MAX,
            timeoutMinutes: 120,
          },
          verifier: DEFAULT_CONFIG.verifier,
        },
      );
    } finally {
      await workspace.cleanup();
    }
  });

  it('rejects an obsolete worktree configuration field', async () => {
    const workspace = await createWorkspace();
    const piDirectory = join(workspace.path, '.pi');
    await mkdir(piDirectory, { recursive: true });
    await writeFile(
      join(piDirectory, 'maestro.json'),
      JSON.stringify({
        version: SUPPORTED_CONFIG_VERSION,
        worktreeDirectory: '.worktree',
      }),
      'utf8',
    );

    try {
      await expect(loadConfiguration({ cwd: workspace.path })).rejects.toThrow(
        'Unknown configuration field: "worktreeDirectory".',
      );
    } finally {
      await workspace.cleanup();
    }
  });

  it('rejects a spec directory outside the repository root', async () => {
    const workspace = await createWorkspace();
    const piDirectory = join(workspace.path, '.pi');
    await mkdir(piDirectory, { recursive: true });
    await writeFile(
      join(piDirectory, 'maestro.json'),
      JSON.stringify({
        version: SUPPORTED_CONFIG_VERSION,
        specDirectory: '../outside',
      }),
      'utf8',
    );

    try {
      await expect(loadConfiguration({ cwd: workspace.path })).rejects.toThrow(
        'specDirectory must stay inside the Git root.',
      );
    } finally {
      await workspace.cleanup();
    }
  });

  it('reports invalid JSON with the configuration path', async () => {
    const workspace = await createWorkspace();
    const piDirectory = join(workspace.path, '.pi');
    await mkdir(piDirectory, { recursive: true });
    const configPath = join(piDirectory, 'maestro.json');
    await writeFile(configPath, '{', 'utf8');

    try {
      await expect(loadConfiguration({ cwd: workspace.path })).rejects.toThrow(
        `Invalid JSON in configuration file "${configPath}":`,
      );
    } finally {
      await workspace.cleanup();
    }
  });

  it('keeps the full fixture usable after removing worktree settings', async () => {
    const workspace = await createWorkspace();
    const piDirectory = join(workspace.path, '.pi');
    await mkdir(piDirectory, { recursive: true });
    const fixture = await readFile(fixturePath('valid-full.json'), 'utf8');
    await writeFile(join(piDirectory, 'maestro.json'), fixture, 'utf8');

    try {
      await expect(
        loadConfiguration({ cwd: workspace.path }),
      ).resolves.toMatchObject({
        specDirectory: join(workspace.path, 'custom-specs'),
      });
    } finally {
      await workspace.cleanup();
    }
  });
});
