import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '#config/defaults.ts';
import { MaestroPaths } from '#MaestroPaths.ts';

vi.mock('#workflow/state/writeWorkflowState.ts', () => ({
  writeWorkflowState: async () => {
    throw new Error('Simulated state write failure.');
  },
}));

const { createSpec } = await import('#specs/create.ts');

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe('partial spec creation failure', () => {
  it('leaves the partial directory and blocks a retry', async () => {
    const repositoryRoot = await mkdtemp(
      join(tmpdir(), 'pi-maestro-spec-failure-'),
    );
    temporaryDirectories.push(repositoryRoot);
    const paths = new MaestroPaths({
      repositoryRoot,
      config: {
        ...DEFAULT_CONFIG,
        specDirectory: join(repositoryRoot, '.specs'),
      },
    });
    const specId = '20260321-143052-add-weather-alerts';
    const specPath = paths.getSpecPath(specId);
    const input = {
      paths,
      title: 'Add Weather Alerts',
      activeWorkflowSpecId: null,
      instant: Temporal.Instant.from('2026-03-21T14:30:52Z'),
    };

    await expect(createSpec(input)).rejects.toThrow(
      `Spec creation failed after creating ${specPath}. Remove this directory before retrying.`,
    );
    await expect(access(specPath)).resolves.toBeUndefined();
    await expect(
      access(paths.getSpecFilePath(specId)),
    ).resolves.toBeUndefined();

    await expect(createSpec(input)).rejects.toThrow(
      `Spec directory already exists: ${specPath}.`,
    );
  });
});
